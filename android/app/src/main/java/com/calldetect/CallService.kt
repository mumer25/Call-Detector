package com.calldetect

import android.app.*
import android.content.Intent
import android.os.Build
import android.os.IBinder

class CallService : Service() {

  override fun onCreate() {
    super.onCreate()
    val channelId = "CALL_SERVICE"

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        channelId,
        "Call Detector",
        NotificationManager.IMPORTANCE_LOW
      )
      getSystemService(NotificationManager::class.java)
        .createNotificationChannel(channel)
    }

    val notification = Notification.Builder(this, channelId)
      .setContentTitle("Call Detector Running")
      .setSmallIcon(android.R.drawable.sym_call_incoming)
      .build()

    startForeground(1, notification)
  }

  override fun onBind(intent: Intent?): IBinder? = null
}
