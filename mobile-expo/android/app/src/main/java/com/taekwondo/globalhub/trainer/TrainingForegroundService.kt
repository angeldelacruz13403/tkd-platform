package com.taekwondo.globalhub.trainer

import android.app.*
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat

/**
 * Foreground Service that keeps the app process alive when the screen is off.
 * This prevents Android from killing the BLE connection and pausing JS timers.
 *
 * Shows a persistent notification while a training session is in progress.
 */
class TrainingForegroundService : Service() {

    companion object {
        const val CHANNEL_ID = "tkd_training_channel"
        const val NOTIFICATION_ID = 1001
        const val ACTION_START = "com.taekwondo.globalhub.trainer.START_TRAINING"
        const val ACTION_STOP = "com.taekwondo.globalhub.trainer.STOP_TRAINING"
    }

    private var wakeLock: PowerManager.WakeLock? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                releaseWakeLock()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }
            else -> {
                val notification = buildNotification()
                startForeground(NOTIFICATION_ID, notification)
                acquireWakeLock()
                return START_STICKY
            }
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        releaseWakeLock()
        super.onDestroy()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Entrenamiento TKD",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Mantiene el pulsómetro BLE conectado durante el entrenamiento"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification {
        // Intent to open the app when tapping the notification
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 0, launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Entrenamiento en curso")
            .setContentText("TKD Global Hub · Pulsómetro BLE activo")
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun acquireWakeLock() {
        if (wakeLock == null) {
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = pm.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "TKDGlobalHub::TrainingWakeLock"
            ).apply {
                acquire(4 * 60 * 60 * 1000L) // Max 4 hours
            }
        }
    }

    private fun releaseWakeLock() {
        wakeLock?.let {
            if (it.isHeld) it.release()
        }
        wakeLock = null
    }
}
