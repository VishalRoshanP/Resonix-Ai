package com.resonixai.citizen.mesh

import android.annotation.SuppressLint
import android.bluetooth.*
import android.bluetooth.le.*
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.os.ParcelUuid
import android.util.Log
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean

/**
 * RESONIX AI — Dual-Role GATT Client Manager (Central)
 * Scans for nearby Resonix mesh peers, prioritizes Internet Gateways,
 * negotiates MTU, and streams emergency packet fragments.
 */
@SuppressLint("MissingPermission")
class ResonixGattClientManager(
    private val context: Context,
    private val bluetoothAdapter: BluetoothAdapter,
    private val onPeerDiscovered: (DiscoveredPeer) -> Unit,
    private val onDeliveryAck: ((String, String?) -> Unit)? = null
) {
    private val TAG = "ResonixGattClient"

    data class DiscoveredPeer(
        val device: BluetoothDevice,
        val address: String,
        val rssi: Int,
        val isGateway: Boolean,
        val lastSeen: Long = System.currentTimeMillis()
    )

    private var scanner: BluetoothLeScanner? = null
    private var isScanning = false
    private val discoveredPeers = ConcurrentHashMap<String, DiscoveredPeer>()
    private val quarantinedPeers = ConcurrentHashMap<String, Long>()
    private val mainHandler = Handler(Looper.getMainLooper())

    private val scanCallback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult?) {
            if (result == null) return
            val device = result.device ?: return
            val address = device.address

            // Skip quarantined peers
            val quarantinedUntil = quarantinedPeers[address]
            if (quarantinedUntil != null && System.currentTimeMillis() < quarantinedUntil) {
                return
            }

            val scanRecord = result.scanRecord
            val serviceData = scanRecord?.getServiceData(ParcelUuid(ResonixBleConstants.RESONIX_SERVICE_UUID))
            val isGateway = if (serviceData != null && serviceData.size >= 2) {
                (serviceData[1].toInt() and ResonixBleConstants.CAP_INTERNET_GATEWAY.toInt()) != 0
            } else {
                false
            }

            val peer = DiscoveredPeer(
                device = device,
                address = address,
                rssi = result.rssi,
                isGateway = isGateway
            )
            discoveredPeers[address] = peer
            onPeerDiscovered(peer)
        }

        override fun onScanFailed(errorCode: Int) {
            Log.e(TAG, "BLE Scan failed: errorCode=$errorCode")
            isScanning = false
        }
    }

    fun startScanning() {
        try {
            if (isScanning || !bluetoothAdapter.isEnabled) return
            scanner = bluetoothAdapter.bluetoothLeScanner
            if (scanner == null) {
                Log.w(TAG, "BluetoothLeScanner not available.")
                return
            }

            val filter = ScanFilter.Builder()
                .setServiceUuid(ParcelUuid(ResonixBleConstants.RESONIX_SERVICE_UUID))
                .build()

            val settings = ScanSettings.Builder()
                .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
                .setReportDelay(0)
                .build()

            scanner?.startScan(listOf(filter), settings, scanCallback)
            isScanning = true
            Log.i(TAG, "✅ Resonix BLE Scanner started for service ${ResonixBleConstants.RESONIX_SERVICE_UUID}")
        } catch (e: SecurityException) {
            Log.e(TAG, "SecurityException starting BLE scanner (missing permissions): ${e.message}")
            isScanning = false
        } catch (e: Exception) {
            Log.e(TAG, "Exception starting BLE scanner: ${e.message}")
            isScanning = false
        }
    }

    fun stopScanning() {
        if (!isScanning) return
        try {
            scanner?.stopScan(scanCallback)
        } catch (e: Exception) {
            Log.w(TAG, "Error stopping scan: ${e.message}")
        }
        isScanning = false
        Log.i(TAG, "Resonix BLE Scanner stopped.")
    }

    fun getBestPeer(excludeAddresses: Set<String> = emptySet(), excludeDeviceIds: Set<String> = emptySet()): DiscoveredPeer? {
        val now = System.currentTimeMillis()
        val normalizedExclude = excludeAddresses.map { it.uppercase() }.toSet()
        return discoveredPeers.values
            .filter {
                (now - it.lastSeen) < 60_000L &&
                (quarantinedPeers[it.address] ?: 0L) < now &&
                !normalizedExclude.contains(it.address.uppercase())
            }
            .sortedWith(
                compareByDescending<DiscoveredPeer> { it.isGateway }
                    .thenByDescending { it.rssi }
            )
            .firstOrNull()
    }

    fun getDiscoveredPeersList(): List<DiscoveredPeer> = discoveredPeers.values.toList()

    /**
     * Connects to a target peer, negotiates MTU, bursts fragments, and awaits ACK_HOP.
     */
    fun transmitPacket(
        peer: DiscoveredPeer,
        model: ResonixPacketChunker.EmergencyPacketModel,
        onComplete: (success: Boolean, errorMsg: String?) -> Unit
    ) {
        val serialized = ResonixPacketChunker.serialize(model)
        val completed = AtomicBoolean(false)
        val streamStarted = java.util.concurrent.atomic.AtomicBoolean(false)
        var activeGatt: BluetoothGatt? = null
        var effectiveMtu = ResonixBleConstants.DEFAULT_MTU

        val timeoutRunnable = Runnable {
            if (completed.compareAndSet(false, true)) {
                Log.w(TAG, "GATT Transmission timed out after ${ResonixBleConstants.GATT_TIMEOUT_MS}ms")
                quarantinePeer(peer.address)
                activeGatt?.disconnect()
                activeGatt?.close()
                onComplete(false, "TRANSFER_TIMEOUT")
            }
        }
        mainHandler.postDelayed(timeoutRunnable, ResonixBleConstants.GATT_TIMEOUT_MS)

        val gattCallback = object : BluetoothGattCallback() {
            override fun onConnectionStateChange(gatt: BluetoothGatt?, status: Int, newState: Int) {
                if (status != BluetoothGatt.GATT_SUCCESS) {
                    Log.w(TAG, "GATT connection failed with status=$status")
                    if (completed.compareAndSet(false, true)) {
                        mainHandler.removeCallbacks(timeoutRunnable)
                        quarantinePeer(peer.address)
                        gatt?.close()
                        onComplete(false, "CONNECTION_FAILED (status $status)")
                    }
                    return
                }

                if (newState == BluetoothProfile.STATE_CONNECTED) {
                    Log.i(TAG, "Connected to peer ${peer.address}. Requesting MTU ${ResonixBleConstants.TARGET_MTU}...")
                    gatt?.requestMtu(ResonixBleConstants.TARGET_MTU)
                } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                    gatt?.close()
                }
            }

            override fun onMtuChanged(gatt: BluetoothGatt?, mtu: Int, status: Int) {
                effectiveMtu = if (status == BluetoothGatt.GATT_SUCCESS) mtu else ResonixBleConstants.DEFAULT_MTU
                Log.i(TAG, "Negotiated MTU=$effectiveMtu. Discovering services...")
                gatt?.discoverServices()
            }

            override fun onServicesDiscovered(gatt: BluetoothGatt?, status: Int) {
                if (status != BluetoothGatt.GATT_SUCCESS) {
                    if (completed.compareAndSet(false, true)) {
                        mainHandler.removeCallbacks(timeoutRunnable)
                        quarantinePeer(peer.address)
                        gatt?.close()
                        onComplete(false, "SERVICE_DISCOVERY_FAILED")
                    }
                    return
                }

                val service = gatt?.getService(ResonixBleConstants.RESONIX_SERVICE_UUID)
                val dataChar = service?.getCharacteristic(ResonixBleConstants.RESONIX_CHAR_DATA)
                val controlChar = service?.getCharacteristic(ResonixBleConstants.RESONIX_CHAR_CONTROL)

                if (service == null || dataChar == null || controlChar == null) {
                    if (completed.compareAndSet(false, true)) {
                        mainHandler.removeCallbacks(timeoutRunnable)
                        gatt?.close()
                        onComplete(false, "MISSING_RESONIX_CHARACTERISTICS")
                    }
                    return
                }

                // Enable notifications on control characteristic to receive ACK_HOP
                gatt.setCharacteristicNotification(controlChar, true)
                val cccd = controlChar.getDescriptor(ResonixBleConstants.CCCD_UUID)
                if (cccd != null) {
                    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
                        gatt.writeDescriptor(cccd, BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE)
                    } else {
                        cccd.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
                        gatt.writeDescriptor(cccd)
                    }
                } else {
                    // Fallback if no CCCD: start streaming immediately
                    if (streamStarted.compareAndSet(false, true)) {
                        streamFragments(gatt, dataChar, serialized, effectiveMtu, completed)
                    }
                }
            }

            override fun onDescriptorWrite(gatt: BluetoothGatt?, descriptor: BluetoothGattDescriptor?, status: Int) {
                Log.i(TAG, "CCCD descriptor written with status=$status. Starting fragment stream...")
                val service = gatt?.getService(ResonixBleConstants.RESONIX_SERVICE_UUID)
                val dataChar = service?.getCharacteristic(ResonixBleConstants.RESONIX_CHAR_DATA)
                if (dataChar != null && gatt != null) {
                    if (streamStarted.compareAndSet(false, true)) {
                        streamFragments(gatt, dataChar, serialized, effectiveMtu, completed)
                    }
                }
            }

            override fun onCharacteristicChanged(
                gatt: BluetoothGatt,
                characteristic: BluetoothGattCharacteristic,
                value: ByteArray
            ) {
                handleInboundControl(gatt, characteristic, value)
            }

            @Deprecated("Deprecated in Java")
            override fun onCharacteristicChanged(
                gatt: BluetoothGatt?,
                characteristic: BluetoothGattCharacteristic?
            ) {
                val value = characteristic?.value ?: return
                if (gatt != null && characteristic != null) {
                    handleInboundControl(gatt, characteristic, value)
                }
            }

            private fun handleInboundControl(
                gatt: BluetoothGatt,
                characteristic: BluetoothGattCharacteristic,
                value: ByteArray
            ) {
                Log.i(TAG, "Inbound control notification from ${peer.address}: ${value.size} bytes [${value.take(6).joinToString(" ") { "0x%02X".format(it) }}]")
                if (characteristic.uuid == ResonixBleConstants.RESONIX_CHAR_CONTROL) {
                    if (value.contains(ResonixBleConstants.PKT_TYPE_ACK_HOP)) {
                        Log.i(TAG, "🎉 Received ACK_HOP from peer ${peer.address} for packet ${model.packetId}!")
                        if (completed.compareAndSet(false, true)) {
                            mainHandler.removeCallbacks(timeoutRunnable)
                            gatt.disconnect()
                            gatt.close()
                            onComplete(true, null)
                        }
                    } else if (value.contains(ResonixBleConstants.PKT_TYPE_ACK_DELIVERY)) {
                        Log.i(TAG, "🏆 Received ACK_DELIVERY from peer ${peer.address} for packet ${model.packetId}!")
                        onDeliveryAck?.invoke(model.packetId, null)
                    }
                }
            }
        }

        activeGatt = peer.device.connectGatt(context, false, gattCallback, BluetoothDevice.TRANSPORT_LE)
    }

    private fun streamFragments(
        gatt: BluetoothGatt,
        dataChar: BluetoothGattCharacteristic,
        serialized: ByteArray,
        effectiveMtu: Int,
        completed: AtomicBoolean
    ) {
        Thread {
            try {
                val fragments = ResonixPacketChunker.chunkPacket(serialized, effectiveMtu)
                Log.i(TAG, "Streaming ${fragments.size} fragments (effectiveMtu $effectiveMtu, packet ${serialized.size}B) to ${gatt.device.address}...")

                for ((idx, frag) in fragments.withIndex()) {
                    if (completed.get()) break
                    val res = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
                        gatt.writeCharacteristic(dataChar, frag, BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE)
                    } else {
                        dataChar.writeType = BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE
                        dataChar.value = frag
                        gatt.writeCharacteristic(dataChar)
                    }
                    Log.i(TAG, "Wrote fragment ${idx + 1}/${fragments.size} (${frag.size} bytes), res=$res")
                    Thread.sleep(ResonixBleConstants.INTER_FRAGMENT_DELAY_MS)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error writing fragments: ${e.message}")
            }
        }.start()
    }

    private fun quarantinePeer(address: String) {
        quarantinedPeers[address] = System.currentTimeMillis() + ResonixBleConstants.PEER_QUARANTINE_MS
        Log.w(TAG, "Quarantined peer $address for ${ResonixBleConstants.PEER_QUARANTINE_MS}ms.")
    }

    fun stop() {
        stopScanning()
        discoveredPeers.clear()
        quarantinedPeers.clear()
    }
}
