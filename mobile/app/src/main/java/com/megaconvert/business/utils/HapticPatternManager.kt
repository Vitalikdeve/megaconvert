package com.megaconvert.business.utils

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager

object HapticPatternManager {
    private val DOUBLE_CLICK_PATTERN = longArrayOf(0, 20, 50, 20)

    @Suppress("DEPRECATION")
    fun performDoubleClick(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val manager = context.getSystemService(VibratorManager::class.java) ?: return
            val vibrator = manager.defaultVibrator
            if (!vibrator.hasVibrator()) return
            vibrator.vibrate(VibrationEffect.createWaveform(DOUBLE_CLICK_PATTERN, -1))
            return
        }

        val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator ?: return
        if (!vibrator.hasVibrator()) return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createWaveform(DOUBLE_CLICK_PATTERN, -1))
        } else {
            vibrator.vibrate(DOUBLE_CLICK_PATTERN, -1)
        }
    }
}
