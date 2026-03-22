package com.megaconvert.business.ui.screens

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalInspectionMode
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.megaconvert.business.BuildConfig
import com.megaconvert.business.crypto.CryptoManager
import com.megaconvert.business.data.local.MegaConvertDatabase
import com.megaconvert.business.data.local.entity.MyBotEntity
import com.megaconvert.business.data.network.withMegaConvertCertificatePinning
import com.megaconvert.business.data.security.KeyManager
import com.megaconvert.business.ui.components.GlassContainer
import com.megaconvert.business.ui.theme.DeepSpaceBlack
import com.megaconvert.business.ui.theme.ElectricCyan
import com.megaconvert.business.ui.theme.MegaConvertBusinessTheme
import com.megaconvert.business.utils.HapticPatternManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.UUID
import java.util.concurrent.TimeUnit

@Composable
fun BotDashboardScreen(
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val clipboardManager = LocalClipboardManager.current
    val isPreview = LocalInspectionMode.current
    val scope = rememberCoroutineScope()

    var botName by rememberSaveable { mutableStateOf("") }
    var avatarValue by rememberSaveable { mutableStateOf("") }
    var webhookUrl by rememberSaveable { mutableStateOf("") }
    var isCreating by rememberSaveable { mutableStateOf(false) }
    var errorMessage by rememberSaveable { mutableStateOf<String?>(null) }
    var generatedPrivateKey by rememberSaveable { mutableStateOf<String?>(null) }
    var pendingToast by rememberSaveable { mutableStateOf<String?>(null) }

    val database = remember(context, isPreview) {
        if (isPreview) null else MegaConvertDatabase.getInstance(context, KeyManager(context))
    }
    val myBotDao = remember(database) { database?.myBotDao() }
    val botsFlow: Flow<List<MyBotEntity>> = remember(myBotDao) {
        myBotDao?.observeMyBots() ?: flowOf(emptyList())
    }
    val bots by botsFlow.collectAsState(initial = emptyList())

    LaunchedEffect(pendingToast) {
        val text = pendingToast ?: return@LaunchedEffect
        Toast.makeText(context, text, Toast.LENGTH_SHORT).show()
        pendingToast = null
    }

    generatedPrivateKey?.let { privateKey ->
        AlertDialog(
            onDismissRequest = { generatedPrivateKey = null },
            title = {
                Text(
                    text = "Приватный ключ бота",
                    color = Color.White
                )
            },
            text = {
                Text(
                    text = "ВАШ ПРИВАТНЫЙ КЛЮЧ: $privateKey\n\n" +
                        "Скопируйте его прямо сейчас. В целях безопасности он больше никогда не будет показан.",
                    color = Color.White.copy(alpha = 0.88f),
                    fontSize = 13.sp
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        clipboardManager.setText(AnnotatedString(privateKey))
                        pendingToast = "Приватный ключ скопирован"
                    }
                ) {
                    Text("Копировать")
                }
            },
            dismissButton = {
                TextButton(onClick = { generatedPrivateKey = null }) {
                    Text("Закрыть")
                }
            },
            containerColor = DeepSpaceBlack
        )
    }

    Scaffold(
        modifier = modifier,
        containerColor = DeepSpaceBlack
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .wrapContentSize(Alignment.Center)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth(0.92f)
                    .widthIn(max = 520.dp)
            ) {
                Text(
                    text = "Управление ботами",
                    color = Color.White,
                    fontSize = 24.sp,
                    fontWeight = FontWeight.SemiBold
                )

                Spacer(modifier = Modifier.height(12.dp))

                GlassContainer(
                    modifier = Modifier.fillMaxWidth(),
                    cornerRadius = 18.dp
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color.White.copy(alpha = 0.02f), RoundedCornerShape(18.dp))
                            .padding(14.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        OutlinedTextField(
                            value = botName,
                            onValueChange = { botName = it },
                            label = { Text("Имя бота") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )

                        OutlinedTextField(
                            value = avatarValue,
                            onValueChange = { avatarValue = it },
                            label = { Text("Аватар (emoji / URL)") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )

                        OutlinedTextField(
                            value = webhookUrl,
                            onValueChange = { webhookUrl = it },
                            label = { Text("Webhook URL") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )

                        if (!errorMessage.isNullOrBlank()) {
                            Text(
                                text = errorMessage.orEmpty(),
                                color = Color(0xFFFF7A7A),
                                fontSize = 13.sp
                            )
                        }

                        Button(
                            onClick = {
                                val normalizedName = botName.trim()
                                val normalizedWebhook = webhookUrl.trim()
                                if (normalizedName.isBlank() || normalizedWebhook.isBlank()) {
                                    errorMessage = "Заполни имя бота и webhook URL"
                                    return@Button
                                }

                                scope.launch {
                                    isCreating = true
                                    errorMessage = null

                                    runCatching {
                                        val cryptoManager = CryptoManager()
                                        val (privateKeyHex, publicKeyHex) = cryptoManager.generateBotKeyPair()

                                        registerBotOnServer(
                                            name = normalizedName,
                                            webhookUrl = normalizedWebhook,
                                            publicKey = publicKeyHex
                                        ).getOrThrow()

                                        withContext(Dispatchers.IO) {
                                            myBotDao?.upsertBot(
                                                MyBotEntity(
                                                    botId = UUID.randomUUID().toString(),
                                                    name = normalizedName,
                                                    webhookUrl = normalizedWebhook,
                                                    publicKey = publicKeyHex
                                                )
                                            )
                                        }

                                        generatedPrivateKey = privateKeyHex
                                        HapticPatternManager.performDoubleClick(context)
                                        pendingToast = "Бот создан"
                                        botName = ""
                                        avatarValue = ""
                                        webhookUrl = ""
                                    }.onFailure { error ->
                                        errorMessage = error.message ?: "Не удалось создать бота"
                                    }

                                    isCreating = false
                                }
                            },
                            enabled = !isCreating,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.Center
                            ) {
                                if (isCreating) {
                                    CircularProgressIndicator(
                                        modifier = Modifier
                                            .size(16.dp),
                                        strokeWidth = 2.dp,
                                        color = ElectricCyan
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                }
                                Text("Создать")
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                Text(
                    text = "Мои боты",
                    color = Color.White.copy(alpha = 0.92f),
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Medium
                )

                Spacer(modifier = Modifier.height(8.dp))

                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(items = bots, key = { it.botId }) { bot ->
                        GlassContainer(
                            modifier = Modifier.fillMaxWidth(),
                            cornerRadius = 14.dp
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 12.dp, vertical = 10.dp)
                            ) {
                                Text(
                                    text = bot.name,
                                    color = Color.White,
                                    fontWeight = FontWeight.SemiBold
                                )
                                Spacer(modifier = Modifier.height(2.dp))
                                Text(
                                    text = bot.webhookUrl,
                                    color = Color.White.copy(alpha = 0.65f),
                                    fontSize = 12.sp
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

private suspend fun registerBotOnServer(
    name: String,
    webhookUrl: String,
    publicKey: String
): Result<Unit> = withContext(Dispatchers.IO) {
    runCatching {
        val client = OkHttpClient.Builder()
            .withMegaConvertCertificatePinning()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(20, TimeUnit.SECONDS)
            .writeTimeout(20, TimeUnit.SECONDS)
            .build()

        val payload = JSONObject()
            .put("type", "bot_register")
            .put("name", name)
            .put("webhookUrl", webhookUrl)
            .put("publicKey", publicKey)
            .toString()

        val request = Request.Builder()
            .url(BOT_REGISTER_URL)
            .post(payload.toRequestBody("application/json; charset=utf-8".toMediaType()))
            .build()

        client.newCall(request).execute().use { response ->
            check(response.isSuccessful) {
                "Ошибка регистрации бота на сервере: HTTP ${response.code}"
            }
        }
    }
}

@Preview(showBackground = true, device = "id:pixel_7_pro")
@Composable
private fun BotDashboardScreenPreview() {
    MegaConvertBusinessTheme {
        BotDashboardScreen()
    }
}

private val BOT_REGISTER_URL =
    "${BuildConfig.SERVER_HTTP_BASE_URL.trimEnd('/')}/bots/register"
