package com.megaconvert.business.crypto

import android.util.Log
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import com.megaconvert.business.utils.SafeLogger
import java.io.InputStream
import java.io.OutputStream
import java.security.KeyFactory
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.MessageDigest
import java.security.PrivateKey
import java.security.SecureRandom
import java.security.spec.NamedParameterSpec
import java.security.spec.X509EncodedKeySpec
import javax.crypto.Cipher
import javax.crypto.KeyAgreement
import javax.crypto.Mac
import javax.crypto.SecretKey
import javax.crypto.AEADBadTagException
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec
import javax.crypto.CipherInputStream
import javax.crypto.CipherOutputStream
import javax.crypto.KeyGenerator

class CryptoManager(
    private val identityAlias: String = DEFAULT_IDENTITY_ALIAS
) {

    private val keyStore: KeyStore by lazy {
        KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
    }

    fun generateIdentityKeyPair(): KeyPair {
        return try {
            getExistingIdentityKeyPair()?.let { return it }

            val keyPairGenerator = KeyPairGenerator.getInstance("XDH", ANDROID_KEYSTORE)
            val spec = KeyGenParameterSpec.Builder(identityAlias, KeyProperties.PURPOSE_AGREE_KEY)
                .setAlgorithmParameterSpec(NamedParameterSpec("X25519"))
                .setUserAuthenticationRequired(true)
                .setUserAuthenticationParameters(
                    0,
                    KeyProperties.AUTH_BIOMETRIC_STRONG or KeyProperties.AUTH_DEVICE_CREDENTIAL
                )
                .build()

            keyPairGenerator.initialize(spec)
            keyPairGenerator.generateKeyPair().also {
                Log.i(TAG, "🔑 X25519 KeyPair generated in hardware TEE")
            }
        } catch (e: Exception) {
            SafeLogger.recordException(
                e,
                contextData = mapOf(
                    "component" to TAG,
                    "operation" to "generateIdentityKeyPair"
                )
            )
            throw e
        }
    }

    fun getMyPublicKey(): ByteArray {
        if (!keyStore.containsAlias(identityAlias)) {
            generateIdentityKeyPair()
        }

        return keyStore.getCertificate(identityAlias)
            ?.publicKey
            ?.encoded
            ?: error("Identity public key is unavailable for alias: $identityAlias")
    }

    fun getMyPublicKeyHex(): String {
        return getMyPublicKey().joinToString(separator = "") { byte -> "%02x".format(byte) }
    }

    fun generateBotKeyPair(): Pair<String, String> {
        val generator = KeyPairGenerator.getInstance(ALGO_XDH).apply {
            initialize(NamedParameterSpec("X25519"))
        }
        val keyPair = generator.generateKeyPair()
        val privateHex = keyPair.private.encoded.toHex()
        val publicHex = keyPair.public.encoded.toHex()
        return privateHex to publicHex
    }

    fun calculateSharedSecret(peerPublicKeyBytes: ByteArray): ByteArray {
        if (!keyStore.containsAlias(identityAlias)) {
            generateIdentityKeyPair()
        }

        val privateKey = keyStore.getKey(identityAlias, null) as? PrivateKey
            ?: error("Identity private key is unavailable for alias: $identityAlias")

        val peerPublicKey = KeyFactory.getInstance(ALGO_XDH)
            .generatePublic(X509EncodedKeySpec(peerPublicKeyBytes))

        val keyAgreement = KeyAgreement.getInstance(ALGO_XDH)
        keyAgreement.init(privateKey)
        keyAgreement.doPhase(peerPublicKey, true)
        return keyAgreement.generateSecret()
    }

    fun deriveAesKey(sharedSecret: ByteArray): SecretKey {
        require(sharedSecret.isNotEmpty()) { "Shared secret must not be empty." }

        val prk = hkdfExtract(HKDF_SALT, sharedSecret)
        val okm = hkdfExpand(prk, HKDF_INFO, AES_KEY_SIZE_BYTES)
        prk.fill(0)

        return SecretKeySpec(okm, "AES")
    }

    fun generateFileKey(): SecretKey {
        return KeyGenerator.getInstance("AES").apply {
            init(AES_KEY_SIZE_BITS)
        }.generateKey()
    }

    fun generateChannelSenderKey(): SecretKey {
        return KeyGenerator.getInstance("AES").apply {
            init(AES_KEY_SIZE_BITS)
        }.generateKey()
    }

    fun encryptFileStream(
        inputStream: InputStream,
        outputStream: OutputStream,
        fileKey: SecretKey
    ) {
        val iv = ByteArray(FILE_IV_SIZE_BYTES).also(SecureRandom()::nextBytes)
        val cipher = Cipher.getInstance(AES_GCM_NO_PADDING)
        cipher.init(
            Cipher.ENCRYPT_MODE,
            fileKey,
            GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv)
        )

        inputStream.use { input ->
            outputStream.use { output ->
                output.write(iv)
                CipherOutputStream(output, cipher).use { cipherOutput ->
                    val buffer = ByteArray(FILE_STREAM_BUFFER_BYTES)
                    while (true) {
                        val read = input.read(buffer)
                        if (read <= 0) break
                        cipherOutput.write(buffer, 0, read)
                    }
                }
            }
        }
    }

    fun decryptFileStream(
        inputStream: InputStream,
        outputStream: OutputStream,
        fileKey: SecretKey
    ) {
        inputStream.use { input ->
            outputStream.use { output ->
                val iv = ByteArray(FILE_IV_SIZE_BYTES)
                var bytesRead = 0
                while (bytesRead < iv.size) {
                    val read = input.read(iv, bytesRead, iv.size - bytesRead)
                    if (read == -1) break
                    bytesRead += read
                }
                require(bytesRead == FILE_IV_SIZE_BYTES) {
                    "Encrypted stream is too short. Missing IV."
                }

                val cipher = Cipher.getInstance(AES_GCM_NO_PADDING)
                cipher.init(
                    Cipher.DECRYPT_MODE,
                    fileKey,
                    GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv)
                )

                CipherInputStream(input, cipher).use { cipherInput ->
                    val buffer = ByteArray(FILE_STREAM_BUFFER_BYTES)
                    while (true) {
                        val read = cipherInput.read(buffer)
                        if (read == -1) break
                        output.write(buffer, 0, read)
                    }
                }
            }
        }
    }

    fun encryptMessage(plaintext: String, aesKey: SecretKey): ByteArray {
        val iv = ByteArray(GCM_IV_SIZE_BYTES).also(SecureRandom()::nextBytes)
        val cipher = Cipher.getInstance(AES_GCM_NO_PADDING)
        val spec = GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv)

        cipher.init(Cipher.ENCRYPT_MODE, aesKey, spec)
        val ciphertextWithTag = cipher.doFinal(plaintext.toByteArray(Charsets.UTF_8))

        return ByteArray(iv.size + ciphertextWithTag.size).apply {
            System.arraycopy(iv, 0, this, 0, iv.size)
            System.arraycopy(ciphertextWithTag, 0, this, iv.size, ciphertextWithTag.size)
        }.also {
            Log.d(TAG, "🔒 Message encrypted successfully")
        }
    }

    fun encryptForChannel(plaintext: String, channelKey: SecretKey): ByteArray {
        val iv = ByteArray(GCM_IV_SIZE_BYTES).also(SecureRandom()::nextBytes)
        val cipher = Cipher.getInstance(AES_GCM_NO_PADDING)
        val spec = GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv)

        cipher.init(Cipher.ENCRYPT_MODE, channelKey, spec)
        val ciphertextWithTag = cipher.doFinal(plaintext.toByteArray(Charsets.UTF_8))

        return ByteArray(iv.size + ciphertextWithTag.size).apply {
            System.arraycopy(iv, 0, this, 0, iv.size)
            System.arraycopy(ciphertextWithTag, 0, this, iv.size, ciphertextWithTag.size)
        }
    }

    fun decryptMessage(encryptedData: ByteArray, aesKey: SecretKey): String {
        return try {
            require(encryptedData.size > GCM_IV_SIZE_BYTES) {
                "Encrypted payload is too short."
            }

            val iv = encryptedData.copyOfRange(0, GCM_IV_SIZE_BYTES)
            val ciphertextWithTag = encryptedData.copyOfRange(GCM_IV_SIZE_BYTES, encryptedData.size)

            val cipher = Cipher.getInstance(AES_GCM_NO_PADDING)
            val spec = GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv)
            cipher.init(Cipher.DECRYPT_MODE, aesKey, spec)

            val plaintextBytes = cipher.doFinal(ciphertextWithTag)
            plaintextBytes.toString(Charsets.UTF_8)
        } catch (e: AEADBadTagException) {
            SafeLogger.recordException(
                e,
                contextData = mapOf(
                    "component" to TAG,
                    "operation" to "decryptMessage",
                    "integrity" to "mac_failed"
                )
            )
            throw e
        }
    }

    fun decryptFromChannel(ciphertext: ByteArray, channelKey: SecretKey): String {
        return try {
            require(ciphertext.size > GCM_IV_SIZE_BYTES) {
                "Encrypted channel payload is too short."
            }

            val iv = ciphertext.copyOfRange(0, GCM_IV_SIZE_BYTES)
            val ciphertextWithTag = ciphertext.copyOfRange(GCM_IV_SIZE_BYTES, ciphertext.size)

            val cipher = Cipher.getInstance(AES_GCM_NO_PADDING)
            val spec = GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv)
            cipher.init(Cipher.DECRYPT_MODE, channelKey, spec)

            val plaintextBytes = cipher.doFinal(ciphertextWithTag)
            plaintextBytes.toString(Charsets.UTF_8)
        } catch (e: AEADBadTagException) {
            SafeLogger.recordException(
                e,
                contextData = mapOf(
                    "component" to TAG,
                    "operation" to "decryptFromChannel",
                    "integrity" to "mac_failed"
                )
            )
            throw e
        }
    }

    fun getVerificationEmojis(sharedSecret: ByteArray): List<String> {
        require(sharedSecret.isNotEmpty()) { "Shared secret must not be empty." }

        val digest = MessageDigest.getInstance(SHA_256).digest(sharedSecret)
        return List(SAS_EMOJI_COUNT) { index ->
            val emojiIndex = (digest[index].toInt() and 0xFF) % VERIFICATION_EMOJIS.size
            VERIFICATION_EMOJIS[emojiIndex]
        }
    }

    fun clearAllMegaConvertKeys() {
        val aliases = keyStore.aliases()
        while (aliases.hasMoreElements()) {
            val alias = aliases.nextElement()
            if (alias == identityAlias || alias.startsWith(KEY_ALIAS_PREFIX)) {
                runCatching { keyStore.deleteEntry(alias) }
                    .onFailure { error ->
                        SafeLogger.recordException(
                            error,
                            contextData = mapOf(
                                "component" to TAG,
                                "operation" to "clearAllMegaConvertKeys",
                                "alias" to alias
                            )
                        )
                    }
            }
        }
    }

    private fun getExistingIdentityKeyPair(): KeyPair? {
        if (!keyStore.containsAlias(identityAlias)) return null

        val privateKey = keyStore.getKey(identityAlias, null) as? PrivateKey ?: return null
        val publicKey = keyStore.getCertificate(identityAlias)?.publicKey ?: return null
        return KeyPair(publicKey, privateKey)
    }

    private fun hkdfExtract(salt: ByteArray, ikm: ByteArray): ByteArray {
        val mac = Mac.getInstance(HMAC_SHA256)
        mac.init(SecretKeySpec(salt, HMAC_SHA256))
        return mac.doFinal(ikm)
    }

    private fun hkdfExpand(prk: ByteArray, info: ByteArray, outputLength: Int): ByteArray {
        require(outputLength in 1..(255 * 32)) { "Invalid HKDF output length: $outputLength" }

        val mac = Mac.getInstance(HMAC_SHA256)
        mac.init(SecretKeySpec(prk, HMAC_SHA256))

        var generated = 0
        var counter = 1
        var previousBlock = ByteArray(0)
        val output = ByteArray(outputLength)

        while (generated < outputLength) {
            mac.reset()
            mac.update(previousBlock)
            mac.update(info)
            mac.update(counter.toByte())

            val block = mac.doFinal()
            val toCopy = minOf(block.size, outputLength - generated)
            System.arraycopy(block, 0, output, generated, toCopy)

            previousBlock.fill(0)
            previousBlock = block
            generated += toCopy
            counter++
        }

        previousBlock.fill(0)
        return output
    }

    private companion object {
        private const val TAG = "MegaConvert-Crypto"
        private const val ANDROID_KEYSTORE = "AndroidKeyStore"
        private const val DEFAULT_IDENTITY_ALIAS = "mc_identity_x25519"
        private const val KEY_ALIAS_PREFIX = "mc_"
        private const val ALGO_XDH = "XDH"
        private const val HMAC_SHA256 = "HmacSHA256"
        private const val SHA_256 = "SHA-256"
        private const val AES_KEY_SIZE_BITS = 256
        private const val AES_KEY_SIZE_BYTES = 32
        private const val AES_GCM_NO_PADDING = "AES/GCM/NoPadding"
        private const val GCM_IV_SIZE_BYTES = 12
        private const val GCM_TAG_LENGTH_BITS = 128
        private const val FILE_IV_SIZE_BYTES = 12
        private const val FILE_STREAM_BUFFER_BYTES = 4096
        private const val SAS_EMOJI_COUNT = 4
        private val HKDF_SALT = "megaconvert-hkdf-salt-v1".toByteArray()
        private val HKDF_INFO = "megaconvert-e2ee-aes-256".toByteArray()
        private val VERIFICATION_EMOJIS = arrayOf(
            "🐶", "🐱", "🐭", "🐹", "🦊", "🐻", "🐼", "🐨",
            "🦁", "🐯", "🐮", "🐷", "🐸", "🐵", "🐔", "🐧",
            "🐢", "🐙", "🦋", "🐞", "🍎", "🍋", "🍇", "🍉",
            "🥕", "🌽", "🍕", "🍔", "🍩", "🍪", "⚽", "🏀",
            "🏈", "⚾", "🎾", "🎲", "🎯", "🎮", "🚗", "🚕",
            "🚙", "🚌", "🚎", "🚲", "✈️", "🚀", "🚁", "🚢",
            "⌚", "📱", "💡", "🔒", "🔑", "💎", "🌈", "☀️",
            "🌙", "⭐", "🔥", "💧", "🎵", "🎬", "📚", "🧩"
        )
    }
}

private fun ByteArray.toHex(): String = joinToString(separator = "") { byte -> "%02x".format(byte) }
