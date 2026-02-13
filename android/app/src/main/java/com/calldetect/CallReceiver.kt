package com.calldetect

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.telephony.TelephonyManager
import android.provider.CallLog
import android.util.Log
import android.database.Cursor

class CallReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != TelephonyManager.ACTION_PHONE_STATE_CHANGED) return

        val state = intent.getStringExtra(TelephonyManager.EXTRA_STATE)

        if (state == TelephonyManager.EXTRA_STATE_IDLE) {
            saveLastCall(context)
        }
    }

    private fun saveLastCall(context: Context) {
        try {
            val cursor: Cursor? = context.contentResolver.query(
                CallLog.Calls.CONTENT_URI,
                null,
                null,
                null,
                CallLog.Calls.DATE + " DESC LIMIT 1"
            )

            cursor?.use {
                if (it.moveToFirst()) {

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

                    val prefs =
                        context.getSharedPreferences("CALL_LOGS", Context.MODE_PRIVATE)

                    prefs.edit()
                        .putString("number", number)
                        .putInt("duration", duration)
                        .putString("type", type)
                        .putLong("date", date)
                        .apply()

                    Log.d("CALL_DETECT", "Saved: $number $type $duration")
                }
            }

        } catch (e: Exception) {
            Log.e("CALL_DETECT", "Error reading call log", e)
        }
    }
}
