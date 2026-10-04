package com.resonixai.citizen.notification

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.resonixai.citizen.MainActivity

class ResonixNotificationModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val TAG = "ResonixNotification"
        const val CHANNEL_ID = "resonix_emergency"
        const val CHANNEL_NAME = "Resonix Emergency Alerts"

        @Volatile
        private var instance: ResonixNotificationModule? = null

        @Volatile
        private var pendingNotificationData: WritableMap? = null

        fun handleIntent(intent: Intent?) {
            if (intent == null) return
            val screen = intent.getStringExtra("screen")
            val incidentId = intent.getStringExtra("incidentId")
            val status = intent.getStringExtra("status")

            if (screen != null || incidentId != null) {
                val data = Arguments.createMap().apply {
                    putString("screen", screen ?: "STATUS")
                    putString("incidentId", incidentId ?: "")
                    putString("status", status ?: "")
                }
                pendingNotificationData = data
                Log.i(TAG, "Notification tap received: screen=$screen, incidentId=$incidentId, status=$status")

                instance?.emitNotificationTapped(data)
            }
        }
    }

    init {
        instance = this
        createNotificationChannel()
    }

    override fun getName(): String = "ResonixNotificationModule"

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
                val audioAttributes = AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .build()

                val channel = NotificationChannel(
                    CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Emergency SOS and real-time incident response notifications."
                    enableVibration(true)
                    vibrationPattern = longArrayOf(0, 300, 200, 300)
                    enableLights(true)
                    setShowBadge(true)
                    setSound(soundUri, audioAttributes)
                }

                val manager = reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
                manager?.createNotificationChannel(channel)
                Log.i(TAG, "✅ Notification channel '$CHANNEL_ID' registered with IMPORTANCE_HIGH.")
            } catch (e: Exception) {
                Log.e(TAG, "Error creating notification channel: ${e.message}")
            }
        }
    }

    @ReactMethod
    fun checkPermission(promise: Promise) {
        try {
            val isGranted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                ContextCompat.checkSelfPermission(
                    reactContext,
                    Manifest.permission.POST_NOTIFICATIONS
                ) == PackageManager.PERMISSION_GRANTED
            } else {
                NotificationManagerCompat.from(reactContext).areNotificationsEnabled()
            }
            promise.resolve(isGranted)
        } catch (e: Exception) {
            promise.reject("PERMISSION_CHECK_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun showNotification(
        id: Int,
        title: String,
        message: String,
        data: ReadableMap?,
        promise: Promise?
    ) {
        try {
            createNotificationChannel()

            val intent = Intent(reactContext, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra("screen", if (data != null && data.hasKey("screen")) data.getString("screen") else "STATUS")
                putExtra("incidentId", if (data != null && data.hasKey("incidentId")) data.getString("incidentId") else "")
                putExtra("status", if (data != null && data.hasKey("status")) data.getString("status") else "")
            }

            val pendingIntent = PendingIntent.getActivity(
                reactContext,
                id,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

            val builder = NotificationCompat.Builder(reactContext, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_alert)
                .setContentTitle(title)
                .setContentText(message)
                .setStyle(NotificationCompat.BigTextStyle().bigText(message))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .setSound(soundUri)
                .setVibrate(longArrayOf(0, 300, 200, 300))

            with(NotificationManagerCompat.from(reactContext)) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    if (ContextCompat.checkSelfPermission(
                            reactContext,
                            Manifest.permission.POST_NOTIFICATIONS
                        ) == PackageManager.PERMISSION_GRANTED
                    ) {
                        notify(id, builder.build())
                        Log.i(TAG, "🔔 Notification #$id posted: '$title'")
                    } else {
                        Log.w(TAG, "POST_NOTIFICATIONS permission not granted; notification skipped.")
                    }
                } else {
                    notify(id, builder.build())
                    Log.i(TAG, "🔔 Notification #$id posted: '$title'")
                }
            }

            promise?.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to show notification: ${e.message}", e)
            promise?.reject("SHOW_NOTIFICATION_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun getInitialNotification(promise: Promise) {
        try {
            val data = pendingNotificationData
            pendingNotificationData = null
            promise.resolve(data)
        } catch (e: Exception) {
            promise.reject("GET_INITIAL_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun clearNotification(id: Int, promise: Promise?) {
        try {
            NotificationManagerCompat.from(reactContext).cancel(id)
            promise?.resolve(true)
        } catch (e: Exception) {
            promise?.reject("CLEAR_NOTIFICATION_ERROR", e.message, e)
        }
    }

    fun emitNotificationTapped(data: WritableMap) {
        try {
            if (reactContext.hasActiveReactInstance()) {
                reactContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit("onNotificationTapped", data)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to emit onNotificationTapped event: ${e.message}")
        }
    }
}
