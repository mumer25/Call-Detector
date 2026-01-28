package com.calldetect

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.telephony.TelephonyManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

class CallReceiver : BroadcastReceiver() {

    private var callStartTime: Long = 0

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != TelephonyManager.ACTION_PHONE_STATE_CHANGED) return

        val stateStr = intent.getStringExtra(TelephonyManager.EXTRA_STATE)
        val phoneNumber = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER)

        val event: WritableMap = Arguments.createMap()

        when (stateStr) {
            TelephonyManager.EXTRA_STATE_RINGING -> {
                event.putString("state", "Incoming")
                event.putString("number", phoneNumber)
                sendEvent(context, event)
            }
            TelephonyManager.EXTRA_STATE_OFFHOOK -> {
                callStartTime = System.currentTimeMillis()
                event.putString("state", "Connected")
                event.putString("number", phoneNumber)
                sendEvent(context, event)
            }
            TelephonyManager.EXTRA_STATE_IDLE -> {
                val duration = if (callStartTime > 0)
                    ((System.currentTimeMillis() - callStartTime) / 1000).toInt()
                else 0
                event.putString("state", "Disconnected")
                event.putString("number", phoneNumber)
                event.putInt("duration", duration)
                sendEvent(context, event)
            }
        }
    }

    private fun sendEvent(context: Context, params: WritableMap) {
        val reactContext = (context.applicationContext as? ReactApplicationContextHolder)?.reactContext
        reactContext?.let {
            if (it.hasActiveCatalystInstance()) {
                Handler(Looper.getMainLooper()).post {
                    it
                        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                        .emit("CallEvent", params)
                }
            }
        }
    }
}
