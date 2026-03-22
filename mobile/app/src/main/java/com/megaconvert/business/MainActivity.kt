package com.megaconvert.business

import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.widget.Toast
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.compose.animation.AnimatedContentTransitionScope
import androidx.compose.animation.ExperimentalSharedTransitionApi
import androidx.compose.animation.SharedTransitionLayout
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.scaleIn
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.lifecycleScope
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.megaconvert.business.crypto.CryptoManager
import com.megaconvert.business.data.auth.AuthSessionStore
import com.megaconvert.business.data.billing.BillingManager
import com.megaconvert.business.data.local.MegaConvertDatabase
import com.megaconvert.business.data.network.SignalingClient
import com.megaconvert.business.data.repository.ChatRepository
import com.megaconvert.business.data.security.KeyManager
import com.megaconvert.business.ui.auth.AuthStep
import com.megaconvert.business.ui.auth.AuthViewModel
import com.megaconvert.business.ui.chat.ChatViewModel
import com.megaconvert.business.ui.screens.BotDashboardScreen
import com.megaconvert.business.ui.screens.ChatListItem
import com.megaconvert.business.ui.screens.ChatListScreen
import com.megaconvert.business.ui.screens.ChatScreen
import com.megaconvert.business.ui.screens.MeshRadarScreen
import com.megaconvert.business.ui.screens.LegalAgreementScreen
import com.megaconvert.business.ui.screens.OnboardingScreen
import com.megaconvert.business.ui.screens.PhoneInputScreen
import com.megaconvert.business.ui.screens.PaywallScreen
import com.megaconvert.business.ui.screens.SettingsScreen
import com.megaconvert.business.ui.screens.SmsCodeScreen
import com.megaconvert.business.ui.screens.VerificationScreen
import com.megaconvert.business.ui.components.NeonButton
import com.megaconvert.business.ui.theme.DeepSpaceBlack
import com.megaconvert.business.ui.theme.MegaConvertBusinessTheme
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.concurrent.atomic.AtomicBoolean

class MainActivity : FragmentActivity() {
    private val keyManager by lazy { KeyManager(applicationContext) }
    private val cryptoManager by lazy { CryptoManager() }
    private val authSessionStore by lazy { AuthSessionStore(applicationContext) }
    private val billingManager by lazy { BillingManager(applicationContext) }
    private val signalingClient by lazy { SignalingClient(cryptoManager) }
    private val database by lazy {
        MegaConvertDatabase.getInstance(applicationContext, keyManager)
    }
    private val chatRepository by lazy {
        ChatRepository(
            signalingClient = signalingClient,
            cryptoManager = cryptoManager,
            authSessionStore = authSessionStore,
            chatDao = database.chatDao(),
            channelKeyDao = database.channelKeyDao()
        )
    }

    private val authViewModel: AuthViewModel by viewModels()
    private val chatViewModel: ChatViewModel by viewModels {
        ChatViewModel.Factory(
            chatRepository = chatRepository
        )
    }
    private var isAppUnlocked by mutableStateOf(false)
    private var biometricLockMessage by mutableStateOf<String?>(null)
    private val isPromptVisible = AtomicBoolean(false)
    private val secureLayerInitialized = AtomicBoolean(false)

    private val biometricPrompt by lazy {
        BiometricPrompt(
            this,
            ContextCompat.getMainExecutor(this),
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    isPromptVisible.set(false)
                    isAppUnlocked = true
                    biometricLockMessage = null
                    initializeSecureLayerIfNeeded()
                }

                override fun onAuthenticationFailed() {
                    biometricLockMessage = "Биометрия не распознана. Попробуйте снова."
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    isPromptVisible.set(false)
                    isAppUnlocked = false
                    biometricLockMessage = when (errorCode) {
                        BiometricPrompt.ERROR_NEGATIVE_BUTTON,
                        BiometricPrompt.ERROR_USER_CANCELED,
                        BiometricPrompt.ERROR_CANCELED -> "Разблокировка отменена."
                        BiometricPrompt.ERROR_LOCKOUT,
                        BiometricPrompt.ERROR_LOCKOUT_PERMANENT -> "Слишком много попыток. Попробуйте позже."
                        else -> errString.toString()
                    }
                }
            }
        )
    }

    private val biometricPromptInfo by lazy {
        BiometricPrompt.PromptInfo.Builder()
            .setTitle("Разблокируйте MegaConvert")
            .setSubtitle("Подтвердите личность для доступа к ключам и базе данных")
            .setAllowedAuthenticators(BIOMETRIC_AUTHENTICATORS)
            .setConfirmationRequired(false)
            .build()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            MegaConvertBusinessTheme {
                val context = LocalContext.current
                LaunchedEffect(authViewModel) {
                    authViewModel.toastEvents.collect { message ->
                        Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
                    }
                }

                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .statusBarsPadding()
                ) {
                    if (isAppUnlocked) {
                        MegaConvertAppFlow(
                            authViewModel = authViewModel,
                            chatViewModelProvider = { chatViewModel },
                            activity = this@MainActivity,
                            onExportData = { chatRepository.buildDataPortabilityExportJson() },
                            billingManager = billingManager
                        )
                    } else {
                        AppLockedScreen(
                            lockMessage = biometricLockMessage,
                            onUnlockClick = ::requestBiometricUnlock
                        )
                    }
                }
            }
        }
    }

    override fun onStart() {
        super.onStart()
        if (!isAppUnlocked) {
            requestBiometricUnlock()
        }
    }

    override fun onStop() {
        super.onStop()
        if (!isChangingConfigurations && !isFinishing) {
            isAppUnlocked = false
        }
    }

    private fun requestBiometricUnlock() {
        if (isFinishing || isDestroyed) return
        if (isPromptVisible.get()) return

        val biometricManager = BiometricManager.from(this)
        val availability = biometricManager.canAuthenticate(BIOMETRIC_AUTHENTICATORS)
        if (availability != BiometricManager.BIOMETRIC_SUCCESS) {
            biometricLockMessage = when (availability) {
                BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED ->
                    "Добавьте отпечаток или Face Unlock в системных настройках."
                BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE ->
                    "На устройстве нет биометрического модуля."
                BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE ->
                    "Биометрический модуль временно недоступен."
                else -> "Биометрическая аутентификация недоступна."
            }
            return
        }

        biometricLockMessage = null
        if (!isPromptVisible.compareAndSet(false, true)) return
        biometricPrompt.authenticate(biometricPromptInfo)
    }

    private fun initializeSecureLayerIfNeeded() {
        if (!secureLayerInitialized.compareAndSet(false, true)) return

        lifecycleScope.launch {
            val initializationResult = withContext(Dispatchers.IO) {
                runCatching {
                    cryptoManager.generateIdentityKeyPair()
                    database.openHelper.writableDatabase
                }
            }

            initializationResult.onFailure {
                secureLayerInitialized.set(false)
                isAppUnlocked = false
                biometricLockMessage = "Не удалось открыть защищенное хранилище."
            }
        }
    }
}

@Composable
private fun AppLockedScreen(
    lockMessage: String?,
    onUnlockClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(DeepSpaceBlack)
            .wrapContentSize(Alignment.Center)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth(0.9f)
                .widthIn(max = 420.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "🔒 MegaConvert Locked",
                color = Color.White,
                fontSize = 24.sp,
                fontWeight = FontWeight.SemiBold
            )

            Spacer(modifier = Modifier.padding(top = 8.dp))

            Text(
                text = lockMessage ?: "Подтвердите биометрию, чтобы получить доступ к ключам и базе.",
                color = Color.White.copy(alpha = 0.78f),
                fontSize = 14.sp
            )

            Spacer(modifier = Modifier.padding(top = 18.dp))

            NeonButton(
                text = "Разблокировать",
                onClick = onUnlockClick,
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

@Composable
private fun MegaConvertAppFlow(
    authViewModel: AuthViewModel,
    chatViewModelProvider: () -> ChatViewModel,
    activity: MainActivity,
    onExportData: suspend () -> Result<String>,
    billingManager: BillingManager
) {
    val uiState by authViewModel.uiState.collectAsState()

    when (uiState.step) {
        AuthStep.LEGAL_AGREEMENT -> LegalAgreementScreen(
            onContinue = authViewModel::onLegalAccepted,
            onTermsClick = { },
            onPrivacyClick = { },
            onLawClick = { }
        )

        AuthStep.ONBOARDING -> OnboardingScreen(
            onContinue = authViewModel::onContinueFromOnboarding
        )

        AuthStep.PHONE_INPUT -> PhoneInputScreen(
            initialPhone = uiState.phoneInput,
            onPhoneChanged = authViewModel::onPhoneChanged,
            onNextClick = { authViewModel.startPhoneNumberVerification(activity) },
            onCancelClick = authViewModel::onBackToOnboarding
        )

        AuthStep.SMS_CODE -> SmsCodeScreen(
            maskedPhone = "+375 ${uiState.phoneInput}",
            onCodeChange = authViewModel::onSmsCodeChanged,
            onBackClick = authViewModel::onBackToPhoneInput,
            onWrongNumberClick = authViewModel::onBackToPhoneInput
        )

        AuthStep.AUTHORIZED -> AuthorizedNavHost(
            chatViewModel = chatViewModelProvider(),
            authViewModel = authViewModel,
            onExportData = onExportData,
            billingManager = billingManager
        )
    }
}

@OptIn(ExperimentalSharedTransitionApi::class)
@Composable
private fun AuthorizedNavHost(
    chatViewModel: ChatViewModel,
    authViewModel: AuthViewModel,
    onExportData: suspend () -> Result<String>,
    billingManager: BillingManager
) {
    val navController = rememberNavController()
    val haptic = LocalHapticFeedback.current
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route.orEmpty()
    val showBottomBar = !currentRoute.startsWith("$ROUTE_CHAT/") &&
        currentRoute != ROUTE_VERIFICATION &&
        currentRoute != ROUTE_PAYWALL

    val chats = remember {
        listOf(
            ChatListItem(
                id = "megastore-support",
                title = "MegaStore Support",
                subtitle = "Нажми, чтобы открыть чат с ботом",
                avatarEmoji = "🤖",
                isBot = true
            ),
            ChatListItem(
                id = "alex",
                title = "Алексей",
                subtitle = "Личный диалог",
                avatarEmoji = "🧑‍💻",
                isBot = false
            )
        )
    }
    val bottomNavItems = remember {
        listOf(
            BottomNavItem(route = ROUTE_CHAT_LIST, label = "Чаты", icon = "💬"),
            BottomNavItem(route = ROUTE_BOT_DASHBOARD, label = "Боты", icon = "🤖"),
            BottomNavItem(route = ROUTE_MESH_RADAR, label = "Радар", icon = "📡"),
            BottomNavItem(route = ROUTE_SETTINGS, label = "Настройки", icon = "⚙️")
        )
    }

    val openChat: (ChatListItem) -> Unit = { chat ->
        navController.navigate(
            "$ROUTE_CHAT/${Uri.encode(chat.id)}" +
                "?name=${Uri.encode(chat.title)}" +
                "&avatar=${Uri.encode(chat.avatarEmoji)}" +
                "&isBot=${chat.isBot}"
        )
    }

    Scaffold(
        containerColor = Color.Transparent,
        bottomBar = {
            if (showBottomBar) {
                NavigationBar(
                    modifier = Modifier.navigationBarsPadding()
                ) {
                    bottomNavItems.forEach { item ->
                        val selected = navBackStackEntry
                            ?.destination
                            ?.hierarchy
                            ?.any { destination -> destination.route == item.route } == true

                        NavigationBarItem(
                            selected = selected,
                            onClick = {
                                haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                navController.navigate(item.route) {
                                    popUpTo(navController.graph.startDestinationId) {
                                        saveState = true
                                    }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            icon = { Text(text = item.icon) },
                            label = { Text(text = item.label) }
                        )
                    }
                }
            }
        }
    ) { innerPadding ->
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            SharedTransitionLayout {
                NavHost(
                    navController = navController,
                    startDestination = ROUTE_CHAT_LIST,
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(innerPadding)
                ) {
                    composable(
                        route = ROUTE_CHAT_LIST,
                        popEnterTransition = {
                            scaleIn(
                                initialScale = 0.94f,
                                animationSpec = tween(
                                    durationMillis = 300,
                                    easing = FastOutSlowInEasing
                                )
                            ) + fadeIn(
                                animationSpec = tween(durationMillis = 300)
                            )
                        }
                    ) {
                        val animatedScope = this
                        ChatListScreen(
                            chats = chats,
                            onChatClick = openChat,
                            avatarModifierFor = { chat ->
                                with(this@SharedTransitionLayout) {
                                    Modifier.sharedElement(
                                        state = rememberSharedContentState(key = "avatar_${chat.id}"),
                                        animatedVisibilityScope = animatedScope
                                    )
                                }
                            }
                        )
                    }

                    composable(route = ROUTE_BOT_DASHBOARD) {
                        BotDashboardScreen()
                    }

                    composable(route = ROUTE_MESH_RADAR) {
                        MeshRadarScreen()
                    }

                    composable(route = ROUTE_SETTINGS) {
                        SettingsScreen(
                            onDeleteAccount = { authViewModel.annihilateAccount() },
                            onExportData = onExportData,
                            onOpenVerification = {
                                navController.navigate(ROUTE_VERIFICATION)
                            },
                            onOpenPaywall = {
                                navController.navigate(ROUTE_PAYWALL)
                            }
                        )
                    }

                    composable(route = ROUTE_VERIFICATION) {
                        VerificationScreen(
                            onBackClick = { navController.popBackStack() }
                        )
                    }

                    composable(route = ROUTE_PAYWALL) {
                        PaywallScreen(
                            billingManager = billingManager,
                            onBackClick = { navController.popBackStack() }
                        )
                    }

                    composable(
                        route = "$ROUTE_CHAT/{$ARG_CHAT_ID}?name={$ARG_CHAT_NAME}&avatar={$ARG_CHAT_AVATAR}&isBot={$ARG_CHAT_IS_BOT}",
                        arguments = listOf(
                            navArgument(ARG_CHAT_ID) { type = NavType.StringType },
                            navArgument(ARG_CHAT_NAME) {
                                type = NavType.StringType
                                defaultValue = "Чат"
                            },
                            navArgument(ARG_CHAT_AVATAR) {
                                type = NavType.StringType
                                defaultValue = "💬"
                            },
                            navArgument(ARG_CHAT_IS_BOT) {
                                type = NavType.BoolType
                                defaultValue = false
                            }
                        ),
                        enterTransition = {
                            slideIntoContainer(
                                towards = AnimatedContentTransitionScope.SlideDirection.Left,
                                animationSpec = tween(
                                    durationMillis = 300,
                                    easing = FastOutSlowInEasing
                                )
                            )
                        },
                        popExitTransition = {
                            slideOutOfContainer(
                                towards = AnimatedContentTransitionScope.SlideDirection.Right,
                                animationSpec = tween(
                                    durationMillis = 300,
                                    easing = FastOutSlowInEasing
                                )
                            )
                        }
                    ) { backStackEntry ->
                        val chatId = backStackEntry.arguments?.getString(ARG_CHAT_ID).orEmpty()
                        val chatName = Uri.decode(
                            backStackEntry.arguments?.getString(ARG_CHAT_NAME) ?: "Чат"
                        )
                        val avatar = Uri.decode(
                            backStackEntry.arguments?.getString(ARG_CHAT_AVATAR) ?: "💬"
                        )
                        val isBot = backStackEntry.arguments?.getBoolean(ARG_CHAT_IS_BOT) == true
                        val animatedScope = this

                        ChatScreen(
                            viewModel = chatViewModel,
                            headerTitle = chatName,
                            headerAvatar = avatar,
                            onBackClick = { navController.popBackStack() },
                            onRequirePro = { navController.navigate(ROUTE_PAYWALL) },
                            isBotOverride = isBot,
                            headerAvatarModifier = with(this@SharedTransitionLayout) {
                                Modifier.sharedElement(
                                    state = rememberSharedContentState(key = "avatar_$chatId"),
                                    animatedVisibilityScope = animatedScope
                                )
                            }
                        )
                    }
                }
            }
        } else {
            NavHost(
                navController = navController,
                startDestination = ROUTE_CHAT_LIST,
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
            ) {
                composable(
                    route = ROUTE_CHAT_LIST,
                    popEnterTransition = {
                        scaleIn(
                            initialScale = 0.94f,
                            animationSpec = tween(
                                durationMillis = 300,
                                easing = FastOutSlowInEasing
                            )
                        ) + fadeIn(
                            animationSpec = tween(durationMillis = 300)
                        )
                    }
                ) {
                    ChatListScreen(
                        chats = chats,
                        onChatClick = openChat
                    )
                }

                composable(route = ROUTE_BOT_DASHBOARD) {
                    BotDashboardScreen()
                }

                composable(route = ROUTE_MESH_RADAR) {
                    MeshRadarScreen()
                }

                composable(route = ROUTE_SETTINGS) {
                    SettingsScreen(
                        onDeleteAccount = { authViewModel.annihilateAccount() },
                        onExportData = onExportData,
                        onOpenVerification = {
                            navController.navigate(ROUTE_VERIFICATION)
                        },
                        onOpenPaywall = {
                            navController.navigate(ROUTE_PAYWALL)
                        }
                    )
                }

                composable(route = ROUTE_VERIFICATION) {
                    VerificationScreen(
                        onBackClick = { navController.popBackStack() }
                    )
                }

                composable(route = ROUTE_PAYWALL) {
                    PaywallScreen(
                        billingManager = billingManager,
                        onBackClick = { navController.popBackStack() }
                    )
                }

                composable(
                    route = "$ROUTE_CHAT/{$ARG_CHAT_ID}?name={$ARG_CHAT_NAME}&avatar={$ARG_CHAT_AVATAR}&isBot={$ARG_CHAT_IS_BOT}",
                    arguments = listOf(
                        navArgument(ARG_CHAT_ID) { type = NavType.StringType },
                        navArgument(ARG_CHAT_NAME) {
                            type = NavType.StringType
                            defaultValue = "Чат"
                        },
                        navArgument(ARG_CHAT_AVATAR) {
                            type = NavType.StringType
                            defaultValue = "💬"
                        },
                        navArgument(ARG_CHAT_IS_BOT) {
                            type = NavType.BoolType
                            defaultValue = false
                        }
                    ),
                    enterTransition = {
                        slideIntoContainer(
                            towards = AnimatedContentTransitionScope.SlideDirection.Left,
                            animationSpec = tween(
                                durationMillis = 300,
                                easing = FastOutSlowInEasing
                            )
                        )
                    },
                    popExitTransition = {
                        slideOutOfContainer(
                            towards = AnimatedContentTransitionScope.SlideDirection.Right,
                            animationSpec = tween(
                                durationMillis = 300,
                                easing = FastOutSlowInEasing
                            )
                        )
                    }
                ) { backStackEntry ->
                    val chatName = Uri.decode(
                        backStackEntry.arguments?.getString(ARG_CHAT_NAME) ?: "Чат"
                    )
                    val avatar = Uri.decode(
                        backStackEntry.arguments?.getString(ARG_CHAT_AVATAR) ?: "💬"
                    )
                    val isBot = backStackEntry.arguments?.getBoolean(ARG_CHAT_IS_BOT) == true

                    ChatScreen(
                        viewModel = chatViewModel,
                        headerTitle = chatName,
                        headerAvatar = avatar,
                        onBackClick = { navController.popBackStack() },
                        onRequirePro = { navController.navigate(ROUTE_PAYWALL) },
                        isBotOverride = isBot
                    )
                }
            }
        }
    }
}

private data class BottomNavItem(
    val route: String,
    val label: String,
    val icon: String
)

private const val ROUTE_CHAT_LIST = "chat_list"
private const val ROUTE_CHAT = "chat"
private const val ROUTE_BOT_DASHBOARD = "bot_dashboard"
private const val ROUTE_MESH_RADAR = "mesh_radar"
private const val ROUTE_SETTINGS = "settings"
private const val ROUTE_VERIFICATION = "verification"
private const val ROUTE_PAYWALL = "paywall"
private const val ARG_CHAT_ID = "chatId"
private const val ARG_CHAT_NAME = "name"
private const val ARG_CHAT_AVATAR = "avatar"
private const val ARG_CHAT_IS_BOT = "isBot"
private val BIOMETRIC_AUTHENTICATORS =
    BiometricManager.Authenticators.BIOMETRIC_STRONG or
        BiometricManager.Authenticators.DEVICE_CREDENTIAL
