package com.resonixai.citizen.mesh

import android.annotation.SuppressLint
import android.bluetooth.*
import android.bluetooth.le.*
import android.content.Context
import android.os.ParcelUuid
import android.util.Log

/**
 * RESONIX AI — Dual-Role GATT Server Manager (Peripheral)
 * Hosts the Resonix Emergency GATT Service and accepts incoming emergency packet fragments.
 */
@SuppressLint("MissingPermission")
class ResonixGattServerManager(
    private val context: Context,
    private val bluetoothAdapter: BluetoothAdapter,
    private val onPacketReceived: (ResonixPacketChunker.EmergencyPacketModel, String) -> Unit
) {
    private val TAG = "ResonixGattServer"
    private var gattServer: BluetoothGattServer? = null
    private var advertiser: BluetoothLeAdvertiser? = null
    private var isAdvertising = false
    private val reassemblyBuffer = ResonixReassemblyBuffer()

    private var controlChar: BluetoothGattCharacteristic? = null
    private var dataChar: BluetoothGattCharacteristic? = null

    private val advertiseCallback = object : AdvertiseCallback() {
        override fun onStartSuccess(settingsInEffect: AdvertiseSettings?) {
            isAdvertising = true
            Log.i(TAG, "✅ BLE Advertising started successfully for Resonix Emergency Service.")
        }

        override fun onStartFailure(errorCode: Int) {
            isAdvertising = false
            Log.e(TAG, "❌ BLE Advertising failed to start: errorCode=$errorCode")
        }
    }

    private val gattServerCallback = object : BluetoothGattServerCallback() {
        override fun onConnectionStateChange(device: BluetoothDevice?, status: Int, newState: Int) {
            Log.d(TAG, "Peer ${device?.address} connection state changed: status=$status, newState=$newState")
        }

        override fun onMtuChanged(device: BluetoothDevice?, mtu: Int) {
            Log.d(TAG, "Peer ${device?.address} negotiated MTU=$mtu")
        }

        override fun onCharacteristicWriteRequest(
            device: BluetoothDevice?,
            requestId: Int,
            characteristic: BluetoothGattCharacteristic?,
            preparedWrite: Boolean,
            responseNeeded: Boolean,
            offset: Int,
            value: ByteArray?
        ) {
            if (responseNeeded) {
                gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, value)
            }

            if (value == null || device == null) return

            when (characteristic?.uuid) {
                ResonixBleConstants.RESONIX_CHAR_DATA -> {
                    Log.i(TAG, "📥 Ingesting fragment (${value.size} bytes) from ${device.address}")
                    val completedPacket = reassemblyBuffer.ingestFragment(value)
                    if (completedPacket != null) {
                        Log.i(TAG, "🎯 Complete emergency packet reassembled! ID=${completedPacket.packetId}, Category=${completedPacket.categoryCode}")
                        onPacketReceived(completedPacket, device.address)
                        sendHopAck(device, completedPacket.packetId)
                    }
                }
                ResonixBleConstants.RESONIX_CHAR_CONTROL -> {
                    Log.d(TAG, "Control write from ${device.address}: size=${value.size}")
                }
            }
        }

        override fun onDescriptorWriteRequest(
            device: BluetoothDevice?,
            requestId: Int,
            descriptor: BluetoothGattDescriptor?,
            preparedWrite: Boolean,
            responseNeeded: Boolean,
            offset: Int,
            value: ByteArray?
        ) {
            if (responseNeeded) {
                gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, value)
            }
            Log.d(TAG, "CCCD Descriptor write from ${device?.address}, notifications enabled.")
        }
    }

    fun start(hasInternetGateway: Boolean): Boolean {
        try {
            if (!bluetoothAdapter.isEnabled) {
                Log.w(TAG, "Cannot start GATT server: Bluetooth is disabled.")
                return false
            }

            val bluetoothManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
            gattServer = bluetoothManager?.openGattServer(context, gattServerCallback)
            if (gattServer == null) {
                Log.e(TAG, "Failed to open BluetoothGattServer.")
                return false
            }

            setupGattService()
            startAdvertising(hasInternetGateway)
            return true
        } catch (e: SecurityException) {
            Log.e(TAG, "SecurityException opening GATT server (missing permissions): ${e.message}")
            return false
        } catch (e: Exception) {
            Log.e(TAG, "Exception opening GATT server: ${e.message}")
            return false
        }
    }

    private fun setupGattService() {
        val service = BluetoothGattService(
            ResonixBleConstants.RESONIX_SERVICE_UUID,
            BluetoothGattService.SERVICE_TYPE_PRIMARY
        )

        controlChar = BluetoothGattCharacteristic(
            ResonixBleConstants.RESONIX_CHAR_CONTROL,
            BluetoothGattCharacteristic.PROPERTY_WRITE or
                    BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE or
                    BluetoothGattCharacteristic.PROPERTY_NOTIFY or
                    BluetoothGattCharacteristic.PROPERTY_INDICATE,
            BluetoothGattCharacteristic.PERMISSION_WRITE or BluetoothGattCharacteristic.PERMISSION_READ
        )

        val cccd = BluetoothGattDescriptor(
            ResonixBleConstants.CCCD_UUID,
            BluetoothGattDescriptor.PERMISSION_WRITE or BluetoothGattDescriptor.PERMISSION_READ
        )
        controlChar?.addDescriptor(cccd)

        dataChar = BluetoothGattCharacteristic(
            ResonixBleConstants.RESONIX_CHAR_DATA,
            BluetoothGattCharacteristic.PROPERTY_WRITE or
                    BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE or
                    BluetoothGattCharacteristic.PROPERTY_NOTIFY,
            BluetoothGattCharacteristic.PERMISSION_WRITE
        )

        service.addCharacteristic(controlChar)
        service.addCharacteristic(dataChar)

        gattServer?.addService(service)
        Log.i(TAG, "✅ Resonix Emergency GATT Service registered with control & data characteristics.")
    }

    private fun startAdvertising(hasInternetGateway: Boolean) {
        advertiser = bluetoothAdapter.bluetoothLeAdvertiser
        if (advertiser == null) {
            Log.w(TAG, "BLE Advertising not supported on this device.")
            return
        }

        val settings = AdvertiseSettings.Builder()
            .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
            .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
            .setConnectable(true)
            .setTimeout(0)
            .build()

        val serviceDataPayload = ByteArray(2)
        serviceDataPayload[0] = ResonixBleConstants.PROTOCOL_VERSION
        serviceDataPayload[1] = if (hasInternetGateway) ResonixBleConstants.CAP_INTERNET_GATEWAY else 0x00

        val pUuid = ParcelUuid(ResonixBleConstants.RESONIX_SERVICE_UUID)
        val advertiseData = AdvertiseData.Builder()
            .setIncludeDeviceName(false)
            .setIncludeTxPowerLevel(false)
            .addServiceUuid(pUuid)
            .build()

        val scanResponseData = AdvertiseData.Builder()
            .setIncludeDeviceName(false)
            .setIncludeTxPowerLevel(false)
            .addServiceData(pUuid, serviceDataPayload)
            .build()

        advertiser?.startAdvertising(settings, advertiseData, scanResponseData, advertiseCallback)
    }

    private fun sendHopAck(device: BluetoothDevice, packetId: String) {
        val ackChar = controlChar ?: return
        val ackPayload = ByteArray(18)
        ackPayload[0] = (ResonixBleConstants.MAGIC_HEADER.toInt() ushr 8).toByte()
        ackPayload[1] = (ResonixBleConstants.MAGIC_HEADER.toInt() and 0xFF).toByte()
        ackPayload[2] = ResonixBleConstants.PKT_TYPE_ACK_HOP
        val idBytes = packetId.replace("-", "").take(15).toByteArray(Charsets.UTF_8)
        System.arraycopy(idBytes, 0, ackPayload, 3, minOf(idBytes.size, 15))

        val result = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            gattServer?.notifyCharacteristicChanged(device, ackChar, false, ackPayload)
        } else {
            ackChar.value = ackPayload
            gattServer?.notifyCharacteristicChanged(device, ackChar, false)
        }
        Log.i(TAG, "Sent ACK_HOP for packet '$packetId' to ${device.address}, result=$result")
    }

    fun stop() {
        try {
            if (isAdvertising) {
                advertiser?.stopAdvertising(advertiseCallback)
                isAdvertising = false
            }
            gattServer?.clearServices()
            gattServer?.close()
            gattServer = null
            reassemblyBuffer.clear()
            Log.i(TAG, "Resonix GATT Server stopped cleanly.")
        } catch (e: Exception) {
            Log.w(TAG, "Error stopping GATT server: ${e.message}")
        }
    }

    fun isRunning(): Boolean = gattServer != null
}
