package com.megaconvert.business.domain.model

import java.util.UUID

data class MeshPacket(
    val packetId: ByteArray,
    val ttl: Byte,
    val recipientHash: ByteArray,
    val ciphertext: ByteArray
) {
    init {
        require(packetId.size == PACKET_ID_BYTES) {
            "packetId must be exactly $PACKET_ID_BYTES bytes."
        }
        require(recipientHash.size == RECIPIENT_HASH_BYTES) {
            "recipientHash must be exactly $RECIPIENT_HASH_BYTES bytes."
        }
    }

    fun toByteArray(): ByteArray {
        return ByteArray(HEADER_BYTES + ciphertext.size).apply {
            var offset = 0
            System.arraycopy(packetId, 0, this, offset, packetId.size)
            offset += packetId.size
            this[offset] = ttl
            offset += TTL_BYTES
            System.arraycopy(recipientHash, 0, this, offset, recipientHash.size)
            offset += recipientHash.size
            System.arraycopy(ciphertext, 0, this, offset, ciphertext.size)
        }
    }

    fun packetIdHex(): String {
        return packetId.joinToString(separator = "") { byte -> "%02x".format(byte) }
    }

    fun packetUuid(): UUID {
        val msb = packetId.copyOfRange(0, 8).fold(0L) { acc, byte ->
            (acc shl 8) or (byte.toLong() and 0xFFL)
        }
        val lsb = packetId.copyOfRange(8, 16).fold(0L) { acc, byte ->
            (acc shl 8) or (byte.toLong() and 0xFFL)
        }
        return UUID(msb, lsb)
    }

    fun ttlAsInt(): Int = ttl.toInt() and 0xFF

    fun decrementTtl(): MeshPacket? {
        val current = ttlAsInt()
        if (current <= 0) return null
        return copy(ttl = (current - 1).toByte())
    }

    companion object {
        const val PACKET_ID_BYTES = 16
        const val TTL_BYTES = 1
        const val RECIPIENT_HASH_BYTES = 32
        const val HEADER_BYTES = PACKET_ID_BYTES + TTL_BYTES + RECIPIENT_HASH_BYTES
        const val DEFAULT_TTL = 5

        fun create(
            packetId: UUID,
            recipientHash: ByteArray,
            ciphertext: ByteArray,
            ttl: Int = DEFAULT_TTL
        ): MeshPacket {
            require(ttl in 0..255) { "ttl must be in 0..255" }
            return MeshPacket(
                packetId = uuidToBytes(packetId),
                ttl = ttl.toByte(),
                recipientHash = recipientHash.copyOf(),
                ciphertext = ciphertext.copyOf()
            )
        }

        fun fromByteArray(raw: ByteArray): MeshPacket {
            require(raw.size >= HEADER_BYTES) {
                "Mesh packet is too short. Need at least $HEADER_BYTES bytes."
            }

            val packetId = raw.copyOfRange(0, PACKET_ID_BYTES)
            val ttl = raw[PACKET_ID_BYTES]
            val hashStart = PACKET_ID_BYTES + TTL_BYTES
            val recipientHash = raw.copyOfRange(hashStart, hashStart + RECIPIENT_HASH_BYTES)
            val ciphertext = raw.copyOfRange(HEADER_BYTES, raw.size)

            return MeshPacket(
                packetId = packetId,
                ttl = ttl,
                recipientHash = recipientHash,
                ciphertext = ciphertext
            )
        }

        private fun uuidToBytes(uuid: UUID): ByteArray {
            return ByteArray(PACKET_ID_BYTES).apply {
                var msb = uuid.mostSignificantBits
                var lsb = uuid.leastSignificantBits
                for (index in 7 downTo 0) {
                    this[index] = (msb and 0xFFL).toByte()
                    msb = msb shr 8
                }
                for (index in 15 downTo 8) {
                    this[index] = (lsb and 0xFFL).toByte()
                    lsb = lsb shr 8
                }
            }
        }
    }
}
