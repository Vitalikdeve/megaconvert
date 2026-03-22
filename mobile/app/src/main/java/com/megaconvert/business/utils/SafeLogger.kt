package com.megaconvert.business.utils

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.util.Log
import com.google.firebase.crashlytics.FirebaseCrashlytics

object SafeLogger {

    @Volatile
    private var appContext: Context? = null

    fun initialize(context: Context) {
        appContext = context.applicationContext
    }

    fun recordException(
        e: Throwable,
        contextData: Map<String, String> = emptyMap()
    ) {
        val crashlytics = runCatching { FirebaseCrashlytics.getInstance() }.getOrNull()
        val sanitizedContext = sanitizeContextData(contextData)

        runCatching {
            crashlytics?.setCustomKey("android_version", Build.VERSION.RELEASE ?: "unknown")
            crashlytics?.setCustomKey("api_level", Build.VERSION.SDK_INT)
            crashlytics?.setCustomKey("network_status", resolveNetworkStatus())
            sanitizedContext.forEach { (key, value) ->
                crashlytics?.setCustomKey(key, value)
            }

            crashlytics?.recordException(sanitizeThrowable(e))
        }.onFailure { crashlyticsError ->
            Log.w(TAG, "Crashlytics record failed: ${crashlyticsError.message}")
        }

        Log.e(TAG, "Exception captured: ${e::class.java.simpleName}: ${sanitizeString(e.message)}")
    }

    private fun sanitizeContextData(input: Map<String, String>): Map<String, String> {
        if (input.isEmpty()) return emptyMap()

        val output = LinkedHashMap<String, String>()
        input.forEach { (rawKey, rawValue) ->
            val key = rawKey.trim()
            if (key.isEmpty()) return@forEach
            val keyNormalized = key.lowercase()

            if (containsBlockedIdentityKey(keyNormalized)) {
                return@forEach
            }

            val value = if (containsSensitiveKey(keyNormalized)) {
                REDACTED_VALUE
            } else {
                sanitizeString(rawValue)
            }

            output[key.take(MAX_KEY_LENGTH)] = value
        }

        return output
    }

    private fun sanitizeThrowable(e: Throwable): Throwable {
        val safe = RuntimeException(
            "${e::class.java.simpleName}: ${sanitizeString(e.message)}"
        )
        safe.stackTrace = e.stackTrace
        return safe
    }

    private fun sanitizeString(value: String?): String {
        if (value.isNullOrBlank()) return "n/a"
        var out = value

        // Redact potential phone-like values.
        out = out.replace(Regex("\\+?\\d{7,15}"), REDACTED_PHONE)

        // If message explicitly references sensitive crypto material, redact entirely.
        if (SENSITIVE_KEYWORDS.any { out.contains(it, ignoreCase = true) }) {
            return REDACTED_VALUE
        }

        return out.take(MAX_VALUE_LENGTH)
    }

    private fun containsSensitiveKey(keyNormalized: String): Boolean {
        return SENSITIVE_KEYWORDS.any { keyword ->
            keyNormalized.contains(keyword, ignoreCase = true)
        }
    }

    private fun containsBlockedIdentityKey(keyNormalized: String): Boolean {
        return BLOCKED_IDENTITY_KEYS.any { token ->
            keyNormalized.contains(token, ignoreCase = true)
        }
    }

    private fun resolveNetworkStatus(): String {
        val context = appContext ?: return "unknown"
        val connectivity = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
            ?: return "unknown"

        val network = connectivity.activeNetwork ?: return "offline"
        val capabilities = connectivity.getNetworkCapabilities(network) ?: return "offline"

        return when {
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "wifi"
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "cellular"
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "ethernet"
            else -> "connected"
        }
    }

    private const val TAG = "MegaConvert-SafeLogger"
    private const val MAX_KEY_LENGTH = 40
    private const val MAX_VALUE_LENGTH = 120
    private const val REDACTED_VALUE = "[REDACTED]"
    private const val REDACTED_PHONE = "[REDACTED_PHONE]"
    private val SENSITIVE_KEYWORDS = listOf(
        "sharedsecret",
        "aeskey",
        "plaintext",
        "privatekey"
    )
    private val BLOCKED_IDENTITY_KEYS = listOf(
        "phone",
        "phonenumber",
        "user",
        "userid",
        "user_id",
        "uid",
        "msisdn"
    )
}
