package com.calldetect

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.provider.CallLog
import androidx.core.app.ActivityCompat
import com.facebook.react.bridge.*
import android.database.Cursor

class CallDetectorModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "CallDetector"
    }

    @ReactMethod
    fun getCallsSince(lastDate: Double, promise: Promise) {

        if (ActivityCompat.checkSelfPermission(
                reactContext,
                Manifest.permission.READ_CALL_LOG
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            promise.reject("NO_PERMISSION", "READ_CALL_LOG not granted")
            return
        }

        val callsArray = Arguments.createArray()

        val selection = "${CallLog.Calls.DATE} > ?"
        val selectionArgs = arrayOf(lastDate.toLong().toString())

        val cursor: Cursor? = reactContext.contentResolver.query(
            CallLog.Calls.CONTENT_URI,
            null,
            selection,
            selectionArgs,
            CallLog.Calls.DATE + " ASC"
        )

        cursor?.use {
            while (it.moveToNext()) {

                val number =
                    it.getString(it.getColumnIndexOrThrow(CallLog.Calls.NUMBER))
                val duration =
                    it.getInt(it.getColumnIndexOrThrow(CallLog.Calls.DURATION))
                val typeInt =
                    it.getInt(it.getColumnIndexOrThrow(CallLog.Calls.TYPE))
                val date =
                    it.getLong(it.getColumnIndexOrThrow(CallLog.Calls.DATE))

                val type = when (typeInt) {
                    CallLog.Calls.INCOMING_TYPE -> "incoming"
                    CallLog.Calls.OUTGOING_TYPE -> "outgoing"
                    CallLog.Calls.MISSED_TYPE -> "missed"
                    else -> "unknown"
                }

                val map = Arguments.createMap()
                map.putString("number", number)
                map.putInt("duration", duration)
                map.putString("type", type)
                map.putDouble("date", date.toDouble())

                callsArray.pushMap(map)
            }
        }

        promise.resolve(callsArray)
    }
}
