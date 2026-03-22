package com.megaconvert.business.crypto

import android.util.Base64

class E2EESessionManager(
    private val cryptoManager: CryptoManager
) {

    fun prepareMessageForSending(text: String, recipientPublicKeyHex: String): String {
        val recipientPublicKeyBytes = hexToByteArray(recipientPublicKeyHex)
        val sharedSecret = cryptoManager.calculateSharedSecret(recipientPublicKeyBytes)

        return try {
            val aesKey = cryptoManager.deriveAesKey(sharedSecret)
            val encrypted = cryptoManager.encryptMessage(text, aesKey)
            Base64.encodeToString(encrypted, Base64.NO_WRAP)
        } finally {
            sharedSecret.fill(0)
        }
    }

    fun processReceivedMessage(base64Ciphertext: String, senderPublicKeyHex: String): String {
        val encryptedData = Base64.decode(base64Ciphertext.trim(), Base64.DEFAULT)
        val senderPublicKeyBytes = hexToByteArray(senderPublicKeyHex)
        val sharedSecret = cryptoManager.calculateSharedSecret(senderPublicKeyBytes)

        return try {
            val aesKey = cryptoManager.deriveAesKey(sharedSecret)
            cryptoManager.decryptMessage(encryptedData, aesKey)
        } finally {
            sharedSecret.fill(0)
        }
    }

    private fun hexToByteArray(hex: String): ByteArray {
        val normalized = hex.trim().removePrefix("0x").removePrefix("0X")
        require(normalized.isNotEmpty()) { "Hex key must not be empty." }
        require(normalized.length % 2 == 0) { "Hex key length must be even." }

        val out = ByteArray(normalized.length / 2)
        var i = 0
        while (i < normalized.length) {
            val high = normalized[i].digitToIntOrNull(16)
                ?: throw IllegalArgumentException("Invalid hex symbol at index $i.")
            val low = normalized[i + 1].digitToIntOrNull(16)
                ?: throw IllegalArgumentException("Invalid hex symbol at index ${i + 1}.")
            out[i / 2] = ((high shl 4) or low).toByte()
            i += 2
        }
        return out
    }
}
