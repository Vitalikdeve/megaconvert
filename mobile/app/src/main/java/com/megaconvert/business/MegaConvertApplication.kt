package com.megaconvert.business

import android.app.Application
import android.content.pm.ApplicationInfo
import android.os.StrictMode
import com.megaconvert.business.utils.SafeLogger
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader

class MegaConvertApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        val isDebuggable = (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0
        if (isDebuggable) {
            StrictMode.setThreadPolicy(
                StrictMode.ThreadPolicy.Builder()
                    .detectAll()
                    .penaltyLog()
                    .build()
            )
            StrictMode.setVmPolicy(
                StrictMode.VmPolicy.Builder()
                    .detectLeakedClosableObjects()
                    .penaltyLog()
                    .build()
            )
        }
        PDFBoxResourceLoader.init(applicationContext)
        SafeLogger.initialize(applicationContext)
    }
}
