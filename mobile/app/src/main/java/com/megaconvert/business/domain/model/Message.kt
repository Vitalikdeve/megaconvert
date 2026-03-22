package com.megaconvert.business.domain.model

import androidx.compose.runtime.Immutable

@Immutable
data class Message(
    val id: String,
    val text: String,
    val isMine: Boolean,
    val timestamp: Long,
    val buttons: List<BotButton>? = null,
    val ciphertextBase64: String? = null,
    val ivBase64: String? = null,
    val senderPublicKey: String? = null
)

@Immutable
data class BotButton(
    val text: String,
    val action: String
)
