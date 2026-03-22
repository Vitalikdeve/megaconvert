package com.megaconvert.business.macrobenchmark

import androidx.benchmark.macro.junit4.BaselineProfileRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.uiautomator.By
import androidx.test.uiautomator.Until
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class BaselineProfileGenerator {
    @get:Rule
    val baselineProfileRule = BaselineProfileRule()

    @Test
    fun generateBaselineProfile() = baselineProfileRule.collect(
        packageName = TARGET_PACKAGE,
        includeInStartupProfile = true
    ) {
        pressHome()
        startActivityAndWait()

        device.wait(Until.hasObject(By.textContains("Чаты")), TIMEOUT_MS)

        device.findObject(By.textContains("MegaStore Support"))?.click()
        device.waitForIdle()

        repeat(3) {
            device.swipe(
                device.displayWidth / 2,
                (device.displayHeight * 0.80f).toInt(),
                device.displayWidth / 2,
                (device.displayHeight * 0.30f).toInt(),
                20
            )
        }

        device.pressBack()
        device.waitForIdle()
    }

    private companion object {
        private const val TARGET_PACKAGE = "com.megaconvert.business"
        private const val TIMEOUT_MS = 5_000L
    }
}
