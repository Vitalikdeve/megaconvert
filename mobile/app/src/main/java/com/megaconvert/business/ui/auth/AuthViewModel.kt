package com.megaconvert.business.ui.auth

import android.app.Activity
import android.app.Application
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.FirebaseException
import com.google.firebase.auth.PhoneAuthCredential
import com.google.firebase.auth.PhoneAuthProvider
import com.megaconvert.business.data.auth.AccountAnnihilationManager
import com.megaconvert.business.data.auth.AuthRepository
import com.megaconvert.business.data.auth.AuthSessionStore
import com.megaconvert.business.utils.SafeLogger
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

enum class AuthStep {
    LEGAL_AGREEMENT,
    ONBOARDING,
    PHONE_INPUT,
    SMS_CODE,
    AUTHORIZED
}

data class AuthUiState(
    val step: AuthStep = AuthStep.LEGAL_AGREEMENT,
    val phoneInput: String = "",
    val verificationId: String? = null,
    val smsCode: String = "",
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val isAuthorized: Boolean = false,
    val hasAcceptedLegal: Boolean = false,
    val legalAcceptedAt: Long? = null
)

class AuthViewModel(
    application: Application
) : AndroidViewModel(application) {

    private val authRepository = AuthRepository()
    private val authSessionStore = AuthSessionStore(application)
    private val accountAnnihilationManager = AccountAnnihilationManager(
        context = application,
        authSessionStore = authSessionStore
    )

    private val _uiState = MutableStateFlow(AuthUiState())
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()
    private val _toastEvents = MutableSharedFlow<String>(extraBufferCapacity = 4)
    val toastEvents: SharedFlow<String> = _toastEvents.asSharedFlow()

    init {
        viewModelScope.launch {
            combine(
                authSessionStore.isAuthorizedFlow,
                authSessionStore.hasAcceptedLegalFlow,
                authSessionStore.legalAcceptedAtFlow
            ) { isAuthorized, hasAcceptedLegal, legalAcceptedAt ->
                Triple(isAuthorized, hasAcceptedLegal, legalAcceptedAt)
            }.collect { (isAuthorized, hasAcceptedLegal, legalAcceptedAt) ->
                _uiState.update { state ->
                    val nextStep = when {
                        !hasAcceptedLegal -> AuthStep.LEGAL_AGREEMENT
                        isAuthorized -> AuthStep.AUTHORIZED
                        state.step == AuthStep.LEGAL_AGREEMENT -> AuthStep.ONBOARDING
                        else -> state.step
                    }
                    state.copy(
                        isAuthorized = isAuthorized,
                        hasAcceptedLegal = hasAcceptedLegal,
                        legalAcceptedAt = legalAcceptedAt,
                        step = nextStep
                    )
                }
            }
        }
    }

    fun onLegalAccepted(timestamp: Long = System.currentTimeMillis()) {
        viewModelScope.launch {
            authSessionStore.setLegalAccepted(timestamp)
            _uiState.update {
                it.copy(
                    hasAcceptedLegal = true,
                    legalAcceptedAt = timestamp,
                    step = if (it.isAuthorized) AuthStep.AUTHORIZED else AuthStep.ONBOARDING,
                    errorMessage = null
                )
            }
        }
    }

    fun onContinueFromOnboarding() {
        if (!_uiState.value.hasAcceptedLegal) {
            _uiState.update {
                it.copy(
                    step = AuthStep.LEGAL_AGREEMENT,
                    errorMessage = "Нужно принять юридические документы."
                )
            }
            return
        }
        _uiState.update { it.copy(step = AuthStep.PHONE_INPUT, errorMessage = null) }
    }

    fun onBackToOnboarding() {
        _uiState.update { it.copy(step = AuthStep.ONBOARDING, errorMessage = null) }
    }

    fun onBackToPhoneInput() {
        _uiState.update { it.copy(step = AuthStep.PHONE_INPUT, errorMessage = null) }
    }

    fun onPhoneChanged(phone: String) {
        _uiState.update {
            it.copy(phoneInput = phone, errorMessage = null)
        }
    }

    suspend fun annihilateAccount(): Result<Unit> {
        _uiState.update { it.copy(isLoading = true, errorMessage = null) }
        val result = accountAnnihilationManager.annihilateAccount()

        result.onFailure { error ->
            SafeLogger.recordException(
                error,
                contextData = mapOf(
                    "component" to TAG,
                    "operation" to "annihilateAccount"
                )
            )
        }

        _uiState.update {
            it.copy(
                step = AuthStep.LEGAL_AGREEMENT,
                phoneInput = "",
                verificationId = null,
                smsCode = "",
                isLoading = false,
                errorMessage = result.exceptionOrNull()?.message,
                isAuthorized = false,
                hasAcceptedLegal = false,
                legalAcceptedAt = null
            )
        }

        _toastEvents.tryEmit(
            if (result.isSuccess) {
                "Аккаунт удален навсегда"
            } else {
                "Аккаунт удален локально, проверьте логи сервера"
            }
        )
        return result
    }

    fun startPhoneNumberVerification(activity: Activity) {
        val e164Phone = toE164Phone(_uiState.value.phoneInput)
        if (e164Phone == null) {
            _uiState.update {
                it.copy(errorMessage = "Введите корректный номер телефона.")
            }
            return
        }

        _uiState.update { it.copy(isLoading = true, errorMessage = null) }

        viewModelScope.launch {
            val sendResult = authRepository.sendVerificationCode(
                phoneNumber = e164Phone,
                activity = activity,
                callbacks = object : PhoneAuthProvider.OnVerificationStateChangedCallbacks() {
                    override fun onVerificationCompleted(credential: PhoneAuthCredential) {
                        viewModelScope.launch {
                            runCatching { authRepository.signInWithCredential(credential) }
                                .onSuccess { user ->
                                    if (user != null) {
                                        authSessionStore.setAuthorized(true)
                                    } else {
                                        _uiState.update {
                                            it.copy(
                                                isLoading = false,
                                                errorMessage = "Не удалось завершить авторизацию."
                                            )
                                        }
                                    }
                                }
                                .onFailure { error ->
                                    SafeLogger.recordException(
                                        error,
                                        contextData = mapOf(
                                            "component" to TAG,
                                            "operation" to "auto_verification"
                                        )
                                    )
                                    _toastEvents.tryEmit(TOAST_NETWORK_FAILURE)
                                    _uiState.update {
                                        it.copy(
                                            isLoading = false,
                                            errorMessage = error.message ?: "Ошибка авторизации."
                                        )
                                    }
                                }
                        }
                    }

                    override fun onVerificationFailed(error: FirebaseException) {
                        SafeLogger.recordException(
                            error,
                            contextData = mapOf(
                                "component" to TAG,
                                "operation" to "onVerificationFailed"
                            )
                        )
                        _toastEvents.tryEmit(TOAST_NETWORK_FAILURE)
                        _uiState.update {
                            it.copy(
                                isLoading = false,
                                errorMessage = error.message ?: "Не удалось отправить SMS."
                            )
                        }
                    }

                    override fun onCodeSent(
                        verificationId: String,
                        token: PhoneAuthProvider.ForceResendingToken
                    ) {
                        Log.d(TAG, "SMS code sent. verificationId=$verificationId")
                        _uiState.update {
                            it.copy(
                                verificationId = verificationId,
                                smsCode = "",
                                isLoading = false,
                                errorMessage = null,
                                step = AuthStep.SMS_CODE
                            )
                        }
                    }
                }
            )

            sendResult.onFailure { error ->
                SafeLogger.recordException(
                    error,
                    contextData = mapOf(
                        "component" to TAG,
                        "operation" to "sendVerificationCode"
                    )
                )
                _toastEvents.tryEmit(TOAST_NETWORK_FAILURE)
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = error.message ?: "Сбой сети, проверьте логи"
                    )
                }
            }
        }
    }

    fun onSmsCodeChanged(code: String) {
        val normalizedCode = code.filter(Char::isDigit).take(SMS_CODE_LENGTH)
        _uiState.update { it.copy(smsCode = normalizedCode, errorMessage = null) }

        val verificationId = _uiState.value.verificationId
        if (normalizedCode.length == SMS_CODE_LENGTH && verificationId != null && !_uiState.value.isLoading) {
            verifyCode(verificationId, normalizedCode)
        }
    }

    private fun verifyCode(verificationId: String, code: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }

            runCatching {
                authRepository.verifyCode(verificationId, code)
            }.onSuccess { user ->
                if (user != null) {
                    authSessionStore.setAuthorized(true)
                    _uiState.update { it.copy(step = AuthStep.AUTHORIZED, isLoading = false) }
                } else {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            errorMessage = "Неверный код подтверждения."
                        )
                    }
                }
            }.onFailure { error ->
                SafeLogger.recordException(
                    error,
                    contextData = mapOf(
                        "component" to TAG,
                        "operation" to "verifyCode"
                    )
                )
                _toastEvents.tryEmit(TOAST_NETWORK_FAILURE)
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = error.message ?: "Ошибка проверки кода."
                    )
                }
            }
        }
    }

    private fun toE164Phone(localPhoneInput: String): String? {
        val digits = localPhoneInput.filter(Char::isDigit)
        if (digits.length < 7) return null
        return DEFAULT_COUNTRY_CODE + digits
    }

    companion object {
        private const val TAG = "MegaConvert-Auth"
        private const val TOAST_NETWORK_FAILURE = "Сбой сети, проверьте логи"
        private const val SMS_CODE_LENGTH = 5
        private const val DEFAULT_COUNTRY_CODE = "+375"
    }
}
