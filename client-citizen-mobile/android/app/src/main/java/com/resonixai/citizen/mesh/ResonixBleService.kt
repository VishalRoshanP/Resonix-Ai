package com.resonixai.citizen.mesh

import android.annotation.SuppressLint
import android.app.*
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Binder
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat

/**
 * RESONIX AI — Android 14+ Connected Device Foreground Service
 * Keeps BLE Scanner, GATT Server, and Mesh Relay alive across Doze and lock screen.
 */
class ResonixBleService : Service() {

    private val TAG = "ResonixBleService"
    private val binder = LocalBinder()

    var gattServerManager: ResonixGattServerManager? = null
        private set
    var gattClientManager: ResonixGattClientManager? = null
        private set

    var onPacketReceivedCallback: ((ResonixPacketChunker.EmergencyPacketModel, String) -> Unit)? = null
    var onPeerDiscoveredCallback: ((ResonixGattClientManager.DiscoveredPeer) -> Unit)? = null
    var onDeliveryAckCallback: ((String, String?) -> Unit)? = null
    var onNetworkStatusChangedCallback: ((Boolean) -> Unit)? = null

    inner class LocalBinder : Binder() {
        fun getService(): ResonixBleService = this@ResonixBleService
    }

    override fun onBind(intent: Intent?): IBinder = binder

    companion object {
        var latestPhysicalLocation: android.location.Location? = null
    }

    private var locationManager: android.location.LocationManager? = null
    private var connectivityManager: android.net.ConnectivityManager? = null
    private var networkCallback: android.net.ConnectivityManager.NetworkCallback? = null

    private val locationListener = object : android.location.LocationListener {
        override fun onLocationChanged(location: android.location.Location) {
            latestPhysicalLocation = location
            Log.i(TAG, "📍 Updated physical location in service: ${location.latitude}, ${location.longitude} (acc: ${location.accuracy}m)")
        }
        override fun onStatusChanged(provider: String?, status: Int, extras: android.os.Bundle?) {}
        override fun onProviderEnabled(provider: String) {}
        override fun onProviderDisabled(provider: String) {}
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForegroundServiceNotification()
        initLocationListener()
        initNetworkMonitoring()

        val bluetoothManager = getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
        val adapter = bluetoothManager?.adapter

        if (adapter != null) {
            gattServerManager = ResonixGattServerManager(this, adapter) { model, senderAddress ->
                onPacketReceivedCallback?.invoke(model, senderAddress)
            }

            gattClientManager = ResonixGattClientManager(
                this,
                adapter,
                { peer -> onPeerDiscoveredCallback?.invoke(peer) },
                { packetId, serverId -> onDeliveryAckCallback?.invoke(packetId, serverId) }
            )
            startMesh(false)
        } else {
            Log.e(TAG, "BluetoothAdapter is null on this device.")
        }
    }

    private fun initNetworkMonitoring() {
        try {
            connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as? android.net.ConnectivityManager
            val cm = connectivityManager ?: return

            networkCallback = object : android.net.ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: android.net.Network) {
                    Log.i(TAG, "🌐 Network AVAILABLE in ResonixBleService")
                    onNetworkStatusChangedCallback?.invoke(true)
                    startMesh(true)
                }

                override fun onLost(network: android.net.Network) {
                    Log.i(TAG, "⚠️ Network LOST in ResonixBleService")
                    onNetworkStatusChangedCallback?.invoke(false)
                    startMesh(false)
                }

                override fun onCapabilitiesChanged(network: android.net.Network, capabilities: android.net.NetworkCapabilities) {
                    val hasInternet = capabilities.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
                                      capabilities.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_VALIDATED)
                    if (hasInternet) {
                        onNetworkStatusChangedCallback?.invoke(true)
                        startMesh(true)
                    }
                }
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                cm.registerDefaultNetworkCallback(networkCallback!!)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Notice registering network callback: ${e.message}")
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val hasGateway = intent?.getBooleanExtra("hasInternetGateway", false) ?: false
        startMesh(hasGateway)
        return START_STICKY
    }

    fun startMesh(hasInternetGateway: Boolean) {
        try {
            gattServerManager?.start(hasInternetGateway)
            gattClientManager?.startScanning()
            Log.i(TAG, "✅ Resonix BLE Mesh Service active (Gateway mode: $hasInternetGateway)")
        } catch (e: SecurityException) {
            Log.e(TAG, "Cannot start BLE Mesh: missing runtime permissions (${e.message})")
        } catch (e: Exception) {
            Log.e(TAG, "Error starting BLE Mesh: ${e.message}")
        }
    }

    fun stopMesh() {
        gattClientManager?.stop()
        gattServerManager?.stop()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
        Log.i(TAG, "Resonix BLE Mesh Service stopped.")
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                ResonixBleConstants.NOTIFICATION_CHANNEL_ID,
                ResonixBleConstants.NOTIFICATION_CHANNEL_NAME,
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Monitors and relays Resonix emergency SOS signals over Bluetooth mesh."
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }

    @SuppressLint("ForegroundServiceType")
    private fun startForegroundServiceNotification() {
        val notificationIntent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            notificationIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val notification = NotificationCompat.Builder(this, ResonixBleConstants.NOTIFICATION_CHANNEL_ID)
            .setContentTitle("Resonix Emergency Mesh Active")
            .setContentText("Relaying emergency signals to nearby citizen devices.")
            .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                ResonixBleConstants.NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE
            )
        } else {
            startForeground(ResonixBleConstants.NOTIFICATION_ID, notification)
        }
    }

    @SuppressLint("MissingPermission")
    private fun initLocationListener() {
        try {
            locationManager = getSystemService(Context.LOCATION_SERVICE) as? android.location.LocationManager
            val mgr = locationManager ?: return
            val providers = listOf("fused", android.location.LocationManager.GPS_PROVIDER, android.location.LocationManager.NETWORK_PROVIDER, android.location.LocationManager.PASSIVE_PROVIDER)
            for (p in providers) {
                try {
                    if (mgr.isProviderEnabled(p)) {
                        val last = mgr.getLastKnownLocation(p)
                        if (last != null) {
                            if (latestPhysicalLocation == null || (last.accuracy > 0 && last.accuracy < (latestPhysicalLocation?.accuracy ?: Float.MAX_VALUE))) {
                                latestPhysicalLocation = last
                            }
                        }
                        mgr.requestLocationUpdates(p, 5000L, 5f, locationListener, mainLooper)
                    }
                } catch (_: Exception) {}
            }
        } catch (e: Exception) {
            Log.w(TAG, "Notice initializing location updates in service: ${e.message}")
        }
    }

    override fun onDestroy() {
        try {
            locationManager?.removeUpdates(locationListener)
            networkCallback?.let { connectivityManager?.unregisterNetworkCallback(it) }
        } catch (_: Exception) {}
        stopMesh()
        super.onDestroy()
    }
}
