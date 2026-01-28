package com.calldetect

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Handler
import android.os.Looper
import android.telephony.PhoneStateListener
import android.telephony.TelephonyManager
import androidx.core.app.ActivityCompat
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class CallDetectorModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var telephonyManager: TelephonyManager? = null
    private var listener: PhoneStateListener? = null

    override fun getName(): String {
        return "CallDetector"
    }

    @ReactMethod
    fun startListening() {
        val context = reactApplicationContext

        // Check permission
        if (ActivityCompat.checkSelfPermission(
                context,
                Manifest.permission.READ_PHONE_STATE
            ) != PackageManager.PERMISSION_GRANTED
        ) return

        Handler(Looper.getMainLooper()).post {
            telephonyManager = context.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
            listener = object : PhoneStateListener() {
                private var callStartTime: Long = 0

                override fun onCallStateChanged(state: Int, phoneNumber: String?) {
                    val event = Arguments.createMap()

                    when (state) {
                        TelephonyManager.CALL_STATE_RINGING -> {
                            event.putString("state", "Incoming")
                            event.putString("number", phoneNumber)
                            sendEvent("CallEvent", event)
                        }
                        TelephonyManager.CALL_STATE_OFFHOOK -> {
                            callStartTime = System.currentTimeMillis()
                            event.putString("state", "Connected")
                            event.putString("number", phoneNumber)
                            sendEvent("CallEvent", event)
                        }
                        TelephonyManager.CALL_STATE_IDLE -> {
                            val duration = if (callStartTime > 0)
                                ((System.currentTimeMillis() - callStartTime) / 1000).toInt()
                            else 0
                            event.putString("state", "Disconnected")
                            event.putString("number", phoneNumber)
                            event.putInt("duration", duration)
                            sendEvent("CallEvent", event)
                        }
                    }
                }
            }
            telephonyManager?.listen(listener, PhoneStateListener.LISTEN_CALL_STATE)
        }
    }

    @ReactMethod
    fun stopListening() {
        Handler(Looper.getMainLooper()).post {
            telephonyManager?.listen(listener, PhoneStateListener.LISTEN_NONE)
        }
    }

    private fun sendEvent(eventName: String, params: WritableMap) {
        val context = reactApplicationContext
        if (context.hasActiveCatalystInstance()) {
            Handler(Looper.getMainLooper()).post {
                context
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit(eventName, params)
            }
        }
    }
}
