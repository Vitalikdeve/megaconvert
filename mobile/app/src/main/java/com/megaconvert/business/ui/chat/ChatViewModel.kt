package com.megaconvert.business.ui.chat

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.megaconvert.business.data.repository.ChatRepositoryEvent
import com.megaconvert.business.data.repository.ChatRepository
import com.megaconvert.business.data.repository.CompanyVerificationStatus
import com.megaconvert.business.domain.model.Message
import com.megaconvert.business.domain.model.ReportReason
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class ChatUiState(
    val messages: List<Message> = emptyList(),
    val isChannel: Boolean = false,
    val isAdmin: Boolean = false,
    val isBot: Boolean = false,
    val verifiedCompany: Boolean = false,
    val verificationBadge: String? = null,
    val subscriberCount: Int = 0,
    val isSending: Boolean = false,
    val errorMessage: String? = null
)

class ChatViewModel(
    private val chatRepository: ChatRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(ChatUiState())
    val uiState: StateFlow<ChatUiState> = _uiState.asStateFlow()
    private val _events = MutableSharedFlow<ChatUiEvent>(extraBufferCapacity = 16)
    val events: SharedFlow<ChatUiEvent> = _events.asSharedFlow()

    init {
        observeMessages()
        observeCompanyVerification()
        observeRepositoryEvents()
    }

    private fun observeMessages() {
        viewModelScope.launch {
            chatRepository.messages.collect { messages ->
                _uiState.update { it.copy(messages = messages) }
            }
        }
    }

    private fun observeRepositoryEvents() {
        viewModelScope.launch {
            chatRepository.events.collect { event ->
                when (event) {
                    ChatRepositoryEvent.MessageSentViaWebSocket -> {
                        _events.tryEmit(ChatUiEvent.MessageSentViaWebSocket)
                    }
                    ChatRepositoryEvent.ReportSent -> {
                        _events.tryEmit(ChatUiEvent.ReportSent)
                    }
                    is ChatRepositoryEvent.ReportFailed -> {
                        _events.tryEmit(ChatUiEvent.ReportFailed(event.reason))
                    }
                    is ChatRepositoryEvent.VerificationSuccess -> {
                        _events.tryEmit(ChatUiEvent.VerificationSuccess(event.badge))
                    }
                }
            }
        }
    }

    private fun observeCompanyVerification() {
        viewModelScope.launch {
            chatRepository.companyVerification.collect { status ->
                applyVerificationStatus(status)
            }
        }
    }

    private fun applyVerificationStatus(status: CompanyVerificationStatus) {
        _uiState.update {
            it.copy(
                verifiedCompany = status.verifiedCompany,
                verificationBadge = status.badge
            )
        }
    }

    fun sendMessage(
        text: String,
        actionPayload: String? = null
    ) {
        val normalized = text.trim()
        if (normalized.isBlank()) return

        viewModelScope.launch {
            _uiState.update { it.copy(isSending = true, errorMessage = null) }

            runCatching {
                chatRepository.sendMessage(
                    text = normalized,
                    actionPayload = actionPayload
                )
            }.onSuccess {
                _uiState.update { it.copy(isSending = false, errorMessage = null) }
            }.onFailure { error ->
                _uiState.update {
                    it.copy(
                        isSending = false,
                        errorMessage = error.message ?: "Не удалось отправить сообщение."
                    )
                }
            }
        }
    }

    fun updateChannelMode(
        isChannel: Boolean,
        isAdmin: Boolean,
        subscriberCount: Int
    ) {
        _uiState.update {
            it.copy(
                isChannel = isChannel,
                isAdmin = isAdmin,
                subscriberCount = subscriberCount.coerceAtLeast(0)
            )
        }
    }

    fun updateBotMode(isBot: Boolean) {
        _uiState.update { it.copy(isBot = isBot) }
    }

    fun reportMessage(
        message: Message,
        reason: ReportReason
    ) {
        viewModelScope.launch {
            chatRepository.reportMessage(
                message = message,
                reason = reason
            ).onFailure { error ->
                _uiState.update {
                    it.copy(errorMessage = error.message ?: "Не удалось отправить жалобу.")
                }
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        chatRepository.disconnect()
    }

    class Factory(
        private val chatRepository: ChatRepository
    ) : ViewModelProvider.Factory {
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            if (modelClass.isAssignableFrom(ChatViewModel::class.java)) {
                @Suppress("UNCHECKED_CAST")
                return ChatViewModel(
                    chatRepository = chatRepository
                ) as T
            }
            throw IllegalArgumentException("Unknown ViewModel class: ${modelClass.name}")
        }
    }
}

sealed interface ChatUiEvent {
    data object MessageSentViaWebSocket : ChatUiEvent
    data object ReportSent : ChatUiEvent
    data class ReportFailed(val reason: String) : ChatUiEvent
    data class VerificationSuccess(val badge: String) : ChatUiEvent
}
