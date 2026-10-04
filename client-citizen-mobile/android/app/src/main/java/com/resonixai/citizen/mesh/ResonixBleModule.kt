package com.resonixai.citizen.mesh

import android.annotation.SuppressLint
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * RESONIX AI — React Native Native Module Bridge
 * Bridges native Android Kotlin BLE Mesh engine to the JavaScript layer.
 */
class ResonixBleModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val TAG = "ResonixBleModule"
    private var bleService: ResonixBleService? = null
    private var isBound = false

    private val serviceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
            val binder = service as? ResonixBleService.LocalBinder
            bleService = binder?.getService()
            isBound = true

            bleService?.onPacketReceivedCallback = { model, senderAddress ->
                val params = Arguments.createMap().apply {
                    putString("packetId", model.packetId)
                    putString("senderAddress", senderAddress)
                    putString("receivedFromAddress", senderAddress)
                    putInt("categoryCode", model.categoryCode.toInt())
                    putInt("priorityCode", model.priorityCode.toInt())
                    putDouble("latitude", model.latitude)
                    putDouble("longitude", model.longitude)
                    putString("payloadJson", model.payloadJson)
                    putInt("hopCount", model.hopCount.toInt())
                    putInt("ttl", model.ttl.toInt())
                    putDouble("timestamp", model.timestamp.toDouble())
                }
                sendEvent("onPacketReceived", params)
            }

            bleService?.onPeerDiscoveredCallback = { peer ->
                val params = Arguments.createMap().apply {
                    putString("nodeId", peer.address)
                    putString("address", peer.address)
                    putInt("rssi", peer.rssi)
                    putBoolean("isGateway", peer.isGateway)
                }
                sendEvent("onPeerDiscovered", params)
            }

            bleService?.onDeliveryAckCallback = { packetId, serverId ->
                val params = Arguments.createMap().apply {
                    putString("packetId", packetId)
                    putString("serverId", serverId ?: packetId)
                }
                sendEvent("onDeliveryAck", params)
            }

            bleService?.onNetworkStatusChangedCallback = { isOnline ->
                val params = Arguments.createMap().apply {
                    putBoolean("isOnline", isOnline)
                }
                sendEvent("onNetworkStatusChanged", params)
            }

            Log.i(TAG, "Connected to ResonixBleService.")
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            bleService = null
            isBound = false
            Log.w(TAG, "Disconnected from ResonixBleService.")
        }
    }

    override fun getName(): String = "ResonixBleModule"

    @ReactMethod
    fun startMesh(options: ReadableMap?, promise: Promise) {
        try {
            val hasGateway = options?.hasKey("hasInternetGateway") == true && options.getBoolean("hasInternetGateway")

            val intent = Intent(reactContext, ResonixBleService::class.java).apply {
                putExtra("hasInternetGateway", hasGateway)
            }

            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                reactContext.startForegroundService(intent)
            } else {
                reactContext.startService(intent)
            }

            reactContext.bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Error starting mesh: ${e.message}")
            promise.reject("START_MESH_ERROR", e.message)
        }
    }

    @ReactMethod
    fun stopMesh(promise: Promise) {
        try {
            bleService?.stopMesh()
            if (isBound) {
                reactContext.unbindService(serviceConnection)
                isBound = false
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("STOP_MESH_ERROR", e.message)
        }
    }

    @ReactMethod
    fun sendPacket(payload: ReadableMap, promise: Promise) {
        val service = bleService
        if (service == null) {
            promise.reject("SERVICE_NOT_RUNNING", "ResonixBleService is not bound or active.")
            return
        }

        val client = service.gattClientManager
        val excludeAddresses = mutableSetOf<String>()
        if (payload.hasKey("excludeAddresses")) {
            val arr = payload.getArray("excludeAddresses")
            if (arr != null) {
                for (i in 0 until arr.size()) {
                    arr.getString(i)?.let { if (it.isNotBlank()) excludeAddresses.add(it) }
                }
            }
        }
        if (payload.hasKey("excludeAddress")) {
            payload.getString("excludeAddress")?.let { if (it.isNotBlank()) excludeAddresses.add(it) }
        }
        if (payload.hasKey("receivedFromAddress")) {
            payload.getString("receivedFromAddress")?.let { if (it.isNotBlank()) excludeAddresses.add(it) }
        }

        val bestPeer = client?.getBestPeer(excludeAddresses)
        if (bestPeer == null) {
            promise.reject("NO_PEERS_AVAILABLE", "No reachable Resonix mesh peers discovered in BLE range (after exclusions: $excludeAddresses).")
            return
        }

        val packetId = if (payload.hasKey("packetId")) payload.getString("packetId") ?: "" else "pkt_${System.currentTimeMillis()}"
        val lat = if (payload.hasKey("latitude")) payload.getDouble("latitude") else 0.0
        val lng = if (payload.hasKey("longitude")) payload.getDouble("longitude") else 0.0
        val categoryCode = if (payload.hasKey("categoryCode")) payload.getInt("categoryCode").toByte() else 0xFF.toByte()
        val priorityCode = if (payload.hasKey("priorityCode")) payload.getInt("priorityCode").toByte() else 0x01.toByte()
        val hopCount = if (payload.hasKey("hopCount")) payload.getInt("hopCount").toByte() else 0.toByte()
        val ttl = if (payload.hasKey("ttl")) payload.getInt("ttl").toByte() else ResonixBleConstants.INITIAL_TTL
        val payloadJson = if (payload.hasKey("payloadJson")) payload.getString("payloadJson") ?: "" else ""

        val model = ResonixPacketChunker.EmergencyPacketModel(
            packetId = packetId,
            timestamp = System.currentTimeMillis(),
            ttl = ttl,
            hopCount = hopCount,
            latitude = lat,
            longitude = lng,
            categoryCode = categoryCode,
            priorityCode = priorityCode,
            payloadJson = payloadJson
        )

        client.transmitPacket(bestPeer, model) { success, errorMsg ->
            if (success) {
                val relayEvent = Arguments.createMap().apply {
                    putString("packetId", packetId)
                    putString("targetAddress", bestPeer.address)
                    putBoolean("success", true)
                }
                sendEvent("onPacketRelayed", relayEvent)
                promise.resolve(packetId)
            } else {
                promise.reject("TRANSMIT_FAILED", errorMsg ?: "Unknown transmission failure")
            }
        }
    }

    @ReactMethod
    fun getMeshStatus(promise: Promise) {
        val service = bleService
        val map = Arguments.createMap().apply {
            putBoolean("isRunning", service?.gattServerManager?.isRunning() ?: false)
            putBoolean("isBound", isBound)
            putInt("peerCount", service?.gattClientManager?.getDiscoveredPeersList()?.size ?: 0)
        }
        promise.resolve(map)
    }

    @ReactMethod
    fun getDiscoveredPeers(promise: Promise) {
        val peers = bleService?.gattClientManager?.getDiscoveredPeersList() ?: emptyList()
        val array = Arguments.createArray()
        for (p in peers) {
            val m = Arguments.createMap().apply {
                putString("address", p.address)
                putInt("rssi", p.rssi)
                putBoolean("isGateway", p.isGateway)
                putDouble("lastSeen", p.lastSeen.toDouble())
            }
            array.pushMap(m)
        }
        promise.resolve(array)
    }

    @SuppressLint("MissingPermission")
    @ReactMethod
    fun getCurrentLocation(promise: Promise) {
        try {
            val locationManager = reactContext.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
            if (locationManager == null) {
                val map = Arguments.createMap().apply {
                    putBoolean("hasLocation", false)
                    putNull("latitude")
                    putNull("longitude")
                    putNull("accuracy")
                }
                promise.resolve(map)
                return
            }

            var bestLocation: Location? = ResonixBleService.latestPhysicalLocation
            val providers = mutableListOf<String>()
            try {
                providers.addAll(locationManager.getProviders(true))
            } catch (e: Exception) {
                Log.w(TAG, "Error getting enabled providers: ${e.message}")
            }
            if (!providers.contains(LocationManager.GPS_PROVIDER)) providers.add(LocationManager.GPS_PROVIDER)
            if (!providers.contains(LocationManager.NETWORK_PROVIDER)) providers.add(LocationManager.NETWORK_PROVIDER)
            if (!providers.contains(LocationManager.PASSIVE_PROVIDER)) providers.add(LocationManager.PASSIVE_PROVIDER)

            for (provider in providers) {
                try {
                    val loc = locationManager.getLastKnownLocation(provider)
                    if (loc != null) {
                        if (bestLocation == null || (loc.accuracy > 0 && loc.accuracy < bestLocation!!.accuracy)) {
                            bestLocation = loc
                        }
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "Notice checking provider $provider: ${e.message}")
                }
            }

            if (bestLocation != null) {
                ResonixBleService.latestPhysicalLocation = bestLocation
                val map = Arguments.createMap().apply {
                    putBoolean("hasLocation", true)
                    putDouble("latitude", bestLocation.latitude)
                    putDouble("longitude", bestLocation.longitude)
                    putDouble("accuracy", bestLocation.accuracy.toDouble())
                    putDouble("time", bestLocation.time.toDouble())
                }
                promise.resolve(map)
                return
            }

            // Fallback: register quick one-shot listener
            val mainLooper = Looper.getMainLooper()
            val handler = Handler(mainLooper)
            val isResolved = java.util.concurrent.atomic.AtomicBoolean(false)

            val locationListener = object : LocationListener {
                override fun onLocationChanged(location: Location) {
                    if (isResolved.compareAndSet(false, true)) {
                        try {
                            locationManager.removeUpdates(this)
                        } catch (_: Exception) {}
                        ResonixBleService.latestPhysicalLocation = location
                        val map = Arguments.createMap().apply {
                            putBoolean("hasLocation", true)
                            putDouble("latitude", location.latitude)
                            putDouble("longitude", location.longitude)
                            putDouble("accuracy", location.accuracy.toDouble())
                            putDouble("time", location.time.toDouble())
                        }
                        promise.resolve(map)
                    }
                }
                override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
                override fun onProviderEnabled(provider: String) {}
                override fun onProviderDisabled(provider: String) {}
            }

            // On modern Android (API 30+), try the modern one-shot API
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                for (p in providers) {
                    try {
                        if (locationManager.isProviderEnabled(p)) {
                            locationManager.getCurrentLocation(
                                p,
                                null,
                                reactContext.mainExecutor
                            ) { loc ->
                                if (loc != null && isResolved.compareAndSet(false, true)) {
                                    try {
                                        locationManager.removeUpdates(locationListener)
                                    } catch (_: Exception) {}
                                    ResonixBleService.latestPhysicalLocation = loc
                                    val map = Arguments.createMap().apply {
                                        putBoolean("hasLocation", true)
                                        putDouble("latitude", loc.latitude)
                                        putDouble("longitude", loc.longitude)
                                        putDouble("accuracy", loc.accuracy.toDouble())
                                        putDouble("time", loc.time.toDouble())
                                    }
                                    promise.resolve(map)
                                }
                            }
                        }
                    } catch (e: Exception) {
                        Log.w(TAG, "Error in modern getCurrentLocation for $p: ${e.message}")
                    }
                }
            }

            var requestedAny = false
            for (p in providers) {
                try {
                    if (locationManager.isProviderEnabled(p)) {
                        locationManager.requestLocationUpdates(p, 100L, 0f, locationListener, mainLooper)
                        requestedAny = true
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "Error requesting updates for $p: ${e.message}")
                }
            }

            if (!requestedAny && !isResolved.get()) {
                val map = Arguments.createMap().apply {
                    putBoolean("hasLocation", false)
                    putNull("latitude")
                    putNull("longitude")
                    putNull("accuracy")
                }
                promise.resolve(map)
                return
            }

            handler.postDelayed({
                if (isResolved.compareAndSet(false, true)) {
                    try {
                        locationManager.removeUpdates(locationListener)
                    } catch (_: Exception) {}
                    val fallback = ResonixBleService.latestPhysicalLocation
                    if (fallback != null) {
                        val map = Arguments.createMap().apply {
                            putBoolean("hasLocation", true)
                            putDouble("latitude", fallback.latitude)
                            putDouble("longitude", fallback.longitude)
                            putDouble("accuracy", fallback.accuracy.toDouble())
                            putDouble("time", fallback.time.toDouble())
                        }
                        promise.resolve(map)
                    } else {
                        val map = Arguments.createMap().apply {
                            putBoolean("hasLocation", false)
                            putNull("latitude")
                            putNull("longitude")
                            putNull("accuracy")
                        }
                        promise.resolve(map)
                    }
                }
            }, 7000L)

        } catch (e: Exception) {
            Log.e(TAG, "getCurrentLocation exception: ${e.message}")
            val map = Arguments.createMap().apply {
                putBoolean("hasLocation", false)
                putNull("latitude")
                putNull("longitude")
                putNull("accuracy")
            }
            promise.resolve(map)
        }
    }

    private fun sendEvent(eventName: String, params: WritableMap?) {
        try {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
        } catch (e: Exception) {
            Log.w(TAG, "Error emitting event '$eventName': ${e.message}")
        }
    }
}
