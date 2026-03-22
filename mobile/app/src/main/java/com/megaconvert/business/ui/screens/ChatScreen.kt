package com.megaconvert.business.ui.screens

import android.Manifest
import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import android.util.Base64
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Paint
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.LocalInspectionMode
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.sp
import androidx.work.WorkInfo
import androidx.work.WorkManager
import com.megaconvert.business.crypto.CryptoManager
import com.megaconvert.business.data.converter.ImageToPdfConverter
import com.megaconvert.business.data.converter.PdfToTextConverter
import com.megaconvert.business.data.converter.VideoConverter
import com.megaconvert.business.data.local.MegaConvertDatabase
import com.megaconvert.business.data.security.KeyManager
import com.megaconvert.business.data.worker.FileUploadWorker
import com.megaconvert.business.domain.model.BotButton
import com.megaconvert.business.domain.model.Message
import com.megaconvert.business.domain.model.ReportReason
import com.megaconvert.business.domain.processor.ProcessParams
import com.megaconvert.business.ui.chat.ChatUiEvent
import com.megaconvert.business.ui.chat.ChatViewModel
import com.megaconvert.business.ui.components.bounceClick
import com.megaconvert.business.ui.components.GlassContainer
import com.megaconvert.business.ui.components.liquidGlass
import com.megaconvert.business.ui.theme.DeepSpaceBlack
import com.megaconvert.business.ui.theme.ElectricCyan
import com.megaconvert.business.ui.theme.GlassBorder
import com.megaconvert.business.ui.theme.MegaConvertBusinessTheme
import kotlinx.coroutines.launch
import java.io.File
import java.util.UUID

@Composable
fun ChatScreen(
    viewModel: ChatViewModel,
    modifier: Modifier = Modifier,
    headerTitle: String = "Чат",
    headerAvatar: String = "💬",
    headerAvatarModifier: Modifier = Modifier,
    onBackClick: (() -> Unit)? = null,
    onRequirePro: (() -> Unit)? = null,
    isBotOverride: Boolean? = null
) {
    val uiState by viewModel.uiState.collectAsState()
    val haptic = LocalHapticFeedback.current
    val context = LocalContext.current

    LaunchedEffect(viewModel, haptic, context) {
        viewModel.events.collect { event ->
            when (event) {
                ChatUiEvent.MessageSentViaWebSocket -> {
                    haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                }
                ChatUiEvent.ReportSent -> {
                    Toast.makeText(context, "Жалоба отправлена", Toast.LENGTH_SHORT).show()
                }
                is ChatUiEvent.ReportFailed -> {
                    Toast.makeText(
                        context,
                        event.reason,
                        Toast.LENGTH_SHORT
                    ).show()
                }
                is ChatUiEvent.VerificationSuccess -> {
                    Toast.makeText(
                        context,
                        "Компания подтверждена: ${event.badge}",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            }
        }
    }

    ChatScreenContent(
        modifier = modifier,
        messages = uiState.messages,
        isBot = isBotOverride ?: uiState.isBot,
        headerTitle = headerTitle,
        headerAvatar = headerAvatar,
        headerAvatarModifier = headerAvatarModifier,
        onBackClick = onBackClick,
        onRequirePro = onRequirePro,
        isChannel = uiState.isChannel,
        isAdmin = uiState.isAdmin,
        verifiedCompany = uiState.verifiedCompany,
        verificationBadge = uiState.verificationBadge,
        subscriberCount = uiState.subscriberCount,
        isSending = uiState.isSending,
        errorMessage = uiState.errorMessage,
        onSendMessage = viewModel::sendMessage,
        onReportMessage = viewModel::reportMessage
    )
}

@Composable
@OptIn(ExperimentalFoundationApi::class, ExperimentalMaterial3Api::class)
private fun ChatScreenContent(
    messages: List<Message>,
    isBot: Boolean,
    headerTitle: String,
    headerAvatar: String,
    headerAvatarModifier: Modifier,
    onBackClick: (() -> Unit)?,
    onRequirePro: (() -> Unit)?,
    isChannel: Boolean,
    isAdmin: Boolean,
    verifiedCompany: Boolean,
    verificationBadge: String?,
    subscriberCount: Int,
    isSending: Boolean,
    errorMessage: String?,
    onSendMessage: (String, String?) -> Unit,
    onReportMessage: (Message, ReportReason) -> Unit,
    modifier: Modifier = Modifier
) {
    var draftMessage by rememberSaveable { mutableStateOf("") }
    var showConvertChooser by rememberSaveable { mutableStateOf(false) }
    var pendingVideoUri by rememberSaveable { mutableStateOf<String?>(null) }
    var showVideoConvertDialog by rememberSaveable { mutableStateOf(false) }
    var pendingImageUris by rememberSaveable { mutableStateOf<List<String>>(emptyList()) }
    var showPdfConvertDialog by rememberSaveable { mutableStateOf(false) }
    var isProcessingVideo by rememberSaveable { mutableStateOf(false) }
    var isConvertingPdf by rememberSaveable { mutableStateOf(false) }
    var uploadProgress by rememberSaveable { mutableStateOf<Int?>(null) }
    var uploadStateText by rememberSaveable { mutableStateOf<String?>(null) }
    var activeUploadWorkId by rememberSaveable { mutableStateOf<String?>(null) }
    var contextMenuMessage by remember { mutableStateOf<Message?>(null) }
    var reportTargetMessage by remember { mutableStateOf<Message?>(null) }

    val renderMessages = remember(messages) { messages.asReversed() }
    val messagesListState = rememberLazyListState()
    val context = LocalContext.current
    val clipboardManager = LocalClipboardManager.current
    val haptic = LocalHapticFeedback.current
    val isPreview = LocalInspectionMode.current
    val uiScope = rememberCoroutineScope()
    val isBusy = isProcessingVideo || isConvertingPdf

    val workManager = remember(context, isPreview) {
        if (isPreview) null else WorkManager.getInstance(context)
    }
    val cryptoManager = remember(isPreview) {
        if (isPreview) null else CryptoManager()
    }
    val documentIndexDao = remember(context, isPreview) {
        if (isPreview) {
            null
        } else {
            MegaConvertDatabase
                .getInstance(context, KeyManager(context))
                .documentIndexDao()
        }
    }
    val videoConverter = remember(context, isPreview) {
        if (isPreview) {
            null
        } else {
            VideoConverter(context) { percent ->
                uploadProgress = percent
                uploadStateText = "Сжатие видео... $percent%"
            }
        }
    }
    val imageToPdfConverter = remember(context, isPreview) {
        if (isPreview) {
            null
        } else {
            ImageToPdfConverter(context) { percent ->
                uploadProgress = percent
                uploadStateText = "Конвертация в PDF... $percent%"
            }
        }
    }
    val pdfToTextConverter = remember(context, documentIndexDao, isPreview) {
        if (isPreview || documentIndexDao == null) {
            null
        } else {
            PdfToTextConverter(
                context = context,
                documentIndexDao = documentIndexDao
            )
        }
    }

    fun enqueueEncryptedUpload(fileUri: Uri) {
        val manager = workManager
        val crypto = cryptoManager
        if (manager == null || crypto == null) {
            uploadStateText = "В Preview загрузка отключена"
            return
        }

        val fileSizeBytes = resolveFileSizeBytes(context, fileUri)
        if (fileSizeBytes != null && fileSizeBytes > FREE_PLAN_FILE_LIMIT_BYTES) {
            uploadStateText = "Файл больше 1 ГБ. Откройте MegaConvert Pro."
            Toast.makeText(context, "Нужен Pro для файлов больше 1 ГБ", Toast.LENGTH_SHORT).show()
            onRequirePro?.invoke()
            return
        }

        val fileKeyBytes = crypto.generateFileKey().encoded
        val fileKeyBase64 = Base64.encodeToString(fileKeyBytes, Base64.NO_WRAP)
        fileKeyBytes.fill(0)

        val request = FileUploadWorker.createWorkRequest(
            fileUri = fileUri.toString(),
            chatId = SELF_CHAT_ID,
            fileKeyBase64 = fileKeyBase64,
            recipientPublicKeyHex = crypto.getMyPublicKeyHex()
        )

        manager.enqueue(request)
        activeUploadWorkId = request.id.toString()
        uploadProgress = 0
        uploadStateText = "Загрузка файла..."
    }

    val callPermissionsLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { grants ->
        val hasCamera = grants[Manifest.permission.CAMERA] == true
        val hasAudio = grants[Manifest.permission.RECORD_AUDIO] == true
        val toastText = if (hasCamera && hasAudio) {
            "Права выданы, можно начинать звонок"
        } else {
            "Нужны права камеры и микрофона"
        }
        Toast.makeText(context, toastText, Toast.LENGTH_SHORT).show()
    }

    val videoPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { selectedUri ->
        if (selectedUri != null) {
            pendingVideoUri = selectedUri.toString()
            showVideoConvertDialog = true
        }
    }

    val imagesPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetMultipleContents()
    ) { selectedUris ->
        if (!selectedUris.isNullOrEmpty()) {
            pendingImageUris = selectedUris.map(Uri::toString)
            showPdfConvertDialog = true
        }
    }

    LaunchedEffect(activeUploadWorkId, workManager) {
        val manager = workManager ?: return@LaunchedEffect
        val idRaw = activeUploadWorkId ?: return@LaunchedEffect
        val workId = runCatching { UUID.fromString(idRaw) }.getOrNull() ?: return@LaunchedEffect

        manager.getWorkInfoByIdFlow(workId).collect { info ->
            if (info == null) return@collect

            val progressValue = info.progress.getInt(
                FileUploadWorker.KEY_PROGRESS,
                uploadProgress ?: 0
            )
            uploadProgress = progressValue

            when (info.state) {
                WorkInfo.State.ENQUEUED, WorkInfo.State.BLOCKED -> {
                    uploadStateText = "Ожидание загрузки..."
                }

                WorkInfo.State.RUNNING -> {
                    uploadStateText = "Загрузка файла... $progressValue%"
                }

                WorkInfo.State.SUCCEEDED -> {
                    uploadProgress = 100
                    uploadStateText = "Файл отправлен"
                    val fileId = info.outputData.getString(FileUploadWorker.KEY_FILE_ID)
                    if (!fileId.isNullOrBlank()) {
                        Toast.makeText(context, "Файл отправлен: $fileId", Toast.LENGTH_SHORT).show()
                    }
                    activeUploadWorkId = null
                }

                WorkInfo.State.FAILED -> {
                    val failureMessage = info.outputData
                        .getString(FileUploadWorker.KEY_ERROR)
                        ?: "Ошибка загрузки файла"
                    uploadStateText = failureMessage
                    activeUploadWorkId = null
                }

                WorkInfo.State.CANCELLED -> {
                    uploadStateText = "Загрузка отменена"
                    activeUploadWorkId = null
                }
            }
        }
    }

    contextMenuMessage?.let { selectedMessage ->
        AlertDialog(
            onDismissRequest = { contextMenuMessage = null },
            title = { Text(text = "Действия", color = Color.White) },
            text = {
                Text(
                    text = "Выбери действие для сообщения",
                    color = Color.White.copy(alpha = 0.80f)
                )
            },
            confirmButton = {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    TextButton(
                        onClick = {
                            clipboardManager.setText(AnnotatedString(selectedMessage.text))
                            Toast.makeText(context, "Сообщение скопировано", Toast.LENGTH_SHORT).show()
                            contextMenuMessage = null
                        }
                    ) {
                        Text("Копировать")
                    }

                    TextButton(
                        onClick = {
                            draftMessage = "↩ ${selectedMessage.text}\n"
                            contextMenuMessage = null
                        }
                    ) {
                        Text("Ответить")
                    }
                }
            },
            dismissButton = {
                TextButton(
                    onClick = {
                        reportTargetMessage = selectedMessage
                        contextMenuMessage = null
                    }
                ) {
                    Text(
                        text = "Пожаловаться (Report)",
                        color = Color(0xFFFF5C5C)
                    )
                }
            },
            containerColor = DeepSpaceBlack
        )
    }

    reportTargetMessage?.let { selectedMessage ->
        ModalBottomSheet(
            onDismissRequest = { reportTargetMessage = null },
            containerColor = DeepSpaceBlack
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    text = "Причина жалобы",
                    color = Color.White,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.SemiBold
                )

                REPORT_REASONS.forEach { reason ->
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .liquidGlass(cornerRadius = 14.dp)
                            .clickable {
                                onReportMessage(selectedMessage, reason)
                                reportTargetMessage = null
                            }
                            .padding(horizontal = 12.dp, vertical = 11.dp)
                    ) {
                        Text(
                            text = reason.title,
                            color = if (reason == ReportReason.ILLEGAL_CONTENT) {
                                Color(0xFFFF7A7A)
                            } else {
                                Color.White.copy(alpha = 0.92f)
                            },
                            fontSize = 14.sp
                        )
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))
            }
        }
    }

    if (showConvertChooser) {
        AlertDialog(
            onDismissRequest = { showConvertChooser = false },
            title = { Text(text = "Конвертировать", color = Color.White) },
            text = {
                Text(
                    text = "Выбери тип локальной конвертации перед отправкой",
                    color = Color.White.copy(alpha = 0.85f)
                )
            },
            confirmButton = {
                Column {
                    TextButton(
                        enabled = !isBusy,
                        onClick = {
                            showConvertChooser = false
                            videoPickerLauncher.launch("video/*")
                        }
                    ) {
                        Text("Сжать видео")
                    }
                    TextButton(
                        enabled = !isBusy,
                        onClick = {
                            showConvertChooser = false
                            imagesPickerLauncher.launch("image/*")
                        }
                    ) {
                        Text("В PDF")
                    }
                }
            },
            dismissButton = {
                TextButton(onClick = { showConvertChooser = false }) {
                    Text("Отмена")
                }
            },
            containerColor = DeepSpaceBlack
        )
    }

    if (showVideoConvertDialog) {
        AlertDialog(
            onDismissRequest = {
                if (!isProcessingVideo) {
                    showVideoConvertDialog = false
                    pendingVideoUri = null
                }
            },
            title = { Text(text = "Сжатие видео", color = Color.White) },
            text = {
                Text(
                    text = "Сжать видео локально через FFmpeg перед шифрованием и отправкой?",
                    color = Color.White.copy(alpha = 0.85f)
                )
            },
            confirmButton = {
                TextButton(
                    enabled = !isBusy,
                    onClick = {
                        val sourceUriRaw = pendingVideoUri ?: return@TextButton
                        showVideoConvertDialog = false
                        isProcessingVideo = true
                        uploadProgress = 0
                        uploadStateText = "Сжатие видео..."

                        uiScope.launch {
                            val converter = videoConverter
                            if (converter == null) {
                                uploadStateText = "В Preview конвертер видео отключен"
                                isProcessingVideo = false
                                pendingVideoUri = null
                                return@launch
                            }

                            val result = converter.process(
                                inputUri = Uri.parse(sourceUriRaw),
                                params = ProcessParams(
                                    width = VIDEO_TARGET_WIDTH,
                                    height = VIDEO_TARGET_HEIGHT,
                                    quality = VIDEO_TARGET_QUALITY
                                )
                            )

                            result.onSuccess { compressedFile ->
                                enqueueEncryptedUpload(Uri.fromFile(compressedFile))
                            }.onFailure { error ->
                                uploadStateText = error.message ?: "Ошибка сжатия видео"
                                Toast.makeText(
                                    context,
                                    "Сжатие видео не удалось: ${error.message}",
                                    Toast.LENGTH_SHORT
                                ).show()
                            }

                            isProcessingVideo = false
                            pendingVideoUri = null
                        }
                    }
                ) {
                    Text("Сжать")
                }
            },
            dismissButton = {
                TextButton(
                    enabled = !isBusy,
                    onClick = {
                        showVideoConvertDialog = false
                        pendingVideoUri = null
                    }
                ) {
                    Text("Отмена")
                }
            },
            containerColor = DeepSpaceBlack
        )
    }

    if (showPdfConvertDialog) {
        AlertDialog(
            onDismissRequest = {
                if (!isConvertingPdf) {
                    showPdfConvertDialog = false
                    pendingImageUris = emptyList()
                }
            },
            title = { Text(text = "Конвертация в PDF", color = Color.White) },
            text = {
                Text(
                    text = "Собрать выбранные изображения в PDF и проиндексировать текст локально?",
                    color = Color.White.copy(alpha = 0.85f)
                )
            },
            confirmButton = {
                TextButton(
                    enabled = !isBusy,
                    onClick = {
                        val selected = pendingImageUris
                        if (selected.isEmpty()) return@TextButton
                        showPdfConvertDialog = false
                        isConvertingPdf = true
                        uploadProgress = 0
                        uploadStateText = "Конвертация в PDF..."

                        uiScope.launch {
                            val pdfConverter = imageToPdfConverter
                            if (pdfConverter == null) {
                                uploadStateText = "В Preview конвертер PDF отключен"
                                isConvertingPdf = false
                                pendingImageUris = emptyList()
                                return@launch
                            }

                            val pdfResult = pdfConverter.convert(selected.map(Uri::parse))
                            pdfResult.onSuccess { pdfUri ->
                                uploadStateText = "Индексация текста PDF..."
                                pdfToTextConverter
                                    ?.extractAndIndex(pdfUri)
                                    ?.onFailure { indexError ->
                                        Toast.makeText(
                                            context,
                                            "Индексация PDF не удалась: ${indexError.message}",
                                            Toast.LENGTH_SHORT
                                        ).show()
                                    }

                                enqueueEncryptedUpload(pdfUri)
                            }.onFailure { error ->
                                uploadStateText = error.message ?: "Ошибка конвертации PDF"
                                Toast.makeText(
                                    context,
                                    "Конвертация в PDF не удалась: ${error.message}",
                                    Toast.LENGTH_SHORT
                                ).show()
                            }

                            isConvertingPdf = false
                            pendingImageUris = emptyList()
                        }
                    }
                ) {
                    Text("Конвертировать")
                }
            },
            dismissButton = {
                TextButton(
                    enabled = !isBusy,
                    onClick = {
                        showPdfConvertDialog = false
                        pendingImageUris = emptyList()
                    }
                ) {
                    Text("Отмена")
                }
            },
            containerColor = DeepSpaceBlack
        )
    }

    Scaffold(
        modifier = modifier,
        containerColor = DeepSpaceBlack,
        bottomBar = {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .wrapContentSize(Alignment.Center)
                    .imePadding()
                    .navigationBarsPadding()
                    .padding(bottom = 8.dp)
            ) {
                if (!isChannel || isAdmin) {
                    GlassTextField(
                        modifier = Modifier
                            .fillMaxWidth(0.9f)
                            .widthIn(max = 480.dp),
                        value = draftMessage,
                        onValueChange = { draftMessage = it },
                        isSending = isSending,
                        onSendClick = {
                            val toSend = draftMessage.trim()
                            if (toSend.isNotBlank()) {
                                onSendMessage(toSend, null)
                                draftMessage = ""
                            }
                        }
                    )
                } else {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(0.9f)
                            .widthIn(max = 480.dp)
                            .liquidGlass(cornerRadius = 16.dp)
                            .padding(horizontal = 14.dp, vertical = 12.dp)
                    ) {
                        Text(
                            text = "Только администраторы могут отправлять сообщения",
                            color = Color.White.copy(alpha = 0.60f),
                            fontSize = 14.sp
                        )
                    }
                }
            }
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .wrapContentSize(Alignment.Center)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxHeight()
                    .fillMaxWidth(0.9f)
                    .widthIn(max = 480.dp)
            ) {
                Spacer(modifier = Modifier.height(12.dp))

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .offset {
                            IntOffset(
                                x = 0,
                                y = calculateHeaderParallaxOffsetPx(
                                    firstVisibleItemIndex = messagesListState.firstVisibleItemIndex,
                                    firstVisibleItemScrollOffset = messagesListState.firstVisibleItemScrollOffset
                                )
                            )
                        },
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (onBackClick != null) {
                        Box(
                            modifier = Modifier
                                .size(34.dp)
                                .clip(CircleShape)
                                .background(Color.White.copy(alpha = 0.08f))
                                .clickable { onBackClick() },
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "←",
                                color = Color.White.copy(alpha = 0.90f),
                                fontSize = 17.sp
                            )
                        }
                        Spacer(modifier = Modifier.size(8.dp))
                    }

                    Box(
                        modifier = headerAvatarModifier
                            .size(34.dp)
                            .clip(CircleShape)
                            .background(ElectricCyan.copy(alpha = 0.18f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = headerAvatar,
                            fontSize = 16.sp
                        )
                    }

                    Spacer(modifier = Modifier.size(8.dp))

                    Text(
                        text = headerTitle,
                        color = Color.White,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.SemiBold
                    )

                    if (isBot) {
                        Spacer(modifier = Modifier.size(8.dp))
                        Text(
                            text = "🤖",
                            fontSize = 18.sp
                        )
                        Spacer(modifier = Modifier.size(6.dp))
                        Box(
                            modifier = Modifier
                                .liquidGlass(cornerRadius = 10.dp)
                                .padding(horizontal = 8.dp, vertical = 3.dp)
                        ) {
                            Text(
                                text = "Бот",
                                color = Color.White.copy(alpha = 0.92f),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }

                    if (verifiedCompany) {
                        Spacer(modifier = Modifier.size(8.dp))
                        Box(
                            modifier = Modifier
                                .liquidGlass(cornerRadius = 10.dp)
                                .padding(horizontal = 8.dp, vertical = 3.dp)
                        ) {
                            Text(
                                text = when (verificationBadge?.lowercase()) {
                                    "corporate" -> "🏢 Corporate ✅"
                                    else -> "✅ Verified"
                                },
                                color = ElectricCyan.copy(alpha = 0.95f),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }

                    Spacer(modifier = Modifier.weight(1f))

                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(Color.White.copy(alpha = 0.08f))
                            .clickable(enabled = !isBusy) {
                                showConvertChooser = true
                            },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            painter = painterResource(id = android.R.drawable.ic_menu_manage),
                            contentDescription = "Конвертировать",
                            tint = if (isBusy) Color.White.copy(alpha = 0.35f) else ElectricCyan,
                            modifier = Modifier.size(18.dp)
                        )
                    }

                    Spacer(modifier = Modifier.size(8.dp))

                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(Color.White.copy(alpha = 0.08f))
                            .clickable {
                                callPermissionsLauncher.launch(
                                    arrayOf(
                                        Manifest.permission.CAMERA,
                                        Manifest.permission.RECORD_AUDIO
                                    )
                                )
                            },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            painter = painterResource(id = android.R.drawable.sym_action_call),
                            contentDescription = "Позвонить",
                            tint = ElectricCyan,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }

                if (isChannel) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .liquidGlass(cornerRadius = 14.dp)
                            .padding(horizontal = 12.dp, vertical = 8.dp)
                    ) {
                        Text(
                            text = "Канал • $subscriberCount подписчиков",
                            color = Color.White.copy(alpha = 0.82f),
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }

                if (!errorMessage.isNullOrBlank()) {
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = errorMessage,
                        color = Color(0xFFFF6B6B),
                        fontSize = 13.sp
                    )
                }

                if (!uploadStateText.isNullOrBlank()) {
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = uploadStateText ?: "",
                        color = ElectricCyan.copy(alpha = 0.88f),
                        fontSize = 13.sp
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    state = messagesListState,
                    reverseLayout = true,
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    contentPadding = PaddingValues(vertical = 10.dp)
                ) {
                    items(
                        items = renderMessages,
                        key = { it.id }
                    ) { message ->
                        MessageBubble(
                            modifier = Modifier.animateItem(
                                placementSpec = spring(
                                    dampingRatio = Spring.DampingRatioMediumBouncy,
                                    stiffness = Spring.StiffnessLow
                                )
                            ),
                            message = message,
                            isMine = message.isMine,
                            onLongPress = {
                                if (!message.isMine) {
                                    haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                                    contextMenuMessage = message
                                }
                            },
                            onBotButtonClick = { button ->
                                onSendMessage(button.text, button.action)
                            }
                        )
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun MessageBubble(
    message: Message,
    isMine: Boolean,
    onLongPress: () -> Unit,
    onBotButtonClick: (BotButton) -> Unit,
    modifier: Modifier = Modifier
) {
    val bubbleShape = RoundedCornerShape(18.dp)
    val alignment = if (isMine) Alignment.CenterEnd else Alignment.CenterStart
    val interactionSource = remember { MutableInteractionSource() }

    val longPressModifier = Modifier.combinedClickable(
        interactionSource = interactionSource,
        indication = null,
        onClick = { },
        onLongClick = {
            onLongPress()
        }
    )

    Box(
        modifier = modifier.fillMaxWidth(),
        contentAlignment = alignment
    ) {
        if (isMine) {
            Column(
                modifier = Modifier
                    .widthIn(max = 340.dp)
                    .background(
                        color = ElectricCyan.copy(alpha = 0.20f),
                        shape = bubbleShape
                    )
                    .border(
                        width = 0.5.dp,
                        color = GlassBorder,
                        shape = bubbleShape
                    )
                    .then(longPressModifier)
                    .padding(horizontal = 12.dp, vertical = 10.dp)
            ) {
                Text(
                    text = message.text,
                    color = Color.White,
                    fontSize = 15.sp
                )
            }
        } else {
            Box(
                modifier = Modifier
                    .widthIn(max = 340.dp)
                    .liquidGlass(cornerRadius = 18.dp)
                    .then(longPressModifier)
                    .padding(horizontal = 12.dp, vertical = 10.dp)
            ) {
                Column(
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = message.text,
                        color = Color.White,
                        fontSize = 15.sp
                    )

                    val buttons = message.buttons.orEmpty()
                    if (buttons.isNotEmpty()) {
                        BotInlineButtons(
                            buttons = buttons,
                            onButtonClick = onBotButtonClick
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun BotInlineButtons(
    buttons: List<BotButton>,
    onButtonClick: (BotButton) -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        buttons.forEach { button ->
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .liquidGlass(cornerRadius = 12.dp)
                    .clickable { onButtonClick(button) }
                    .padding(horizontal = 10.dp, vertical = 8.dp)
            ) {
                Text(
                    text = button.text,
                    color = ElectricCyan.copy(alpha = 0.95f),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium
                )
            }
        }
    }
}

@Composable
private fun GlassTextField(
    value: String,
    onValueChange: (String) -> Unit,
    onSendClick: () -> Unit,
    modifier: Modifier = Modifier,
    isSending: Boolean = false
) {
    val canSend = value.trim().isNotEmpty() && !isSending
    val shape = RoundedCornerShape(18.dp)
    val normalizedSlashInput = value.trimStart()
    val slashQuery = normalizedSlashInput.removePrefix("/").lowercase()
    val showSlashSuggestions = normalizedSlashInput.startsWith("/")
    val filteredCommands = remember(value) {
        if (!showSlashSuggestions) {
            emptyList()
        } else {
            DEFAULT_SLASH_COMMANDS.filter { command ->
                command.removePrefix("/").startsWith(slashQuery)
            }
        }
    }

    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        if (showSlashSuggestions && filteredCommands.isNotEmpty()) {
            GlassContainer(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 150.dp),
                cornerRadius = 14.dp
            ) {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(DeepSpaceBlack.copy(alpha = 0.30f))
                        .padding(vertical = 4.dp)
                ) {
                    items(filteredCommands, key = { it }) { command ->
                        Text(
                            text = command,
                            color = Color.White.copy(alpha = 0.92f),
                            fontSize = 15.sp,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { onValueChange("$command ") }
                                .padding(horizontal = 12.dp, vertical = 10.dp)
                        )
                    }
                }
            }
        }

        GlassContainer(
            modifier = Modifier.fillMaxWidth(),
            cornerRadius = 18.dp
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(DeepSpaceBlack.copy(alpha = 0.35f), shape)
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                BasicTextField(
                    value = value,
                    onValueChange = onValueChange,
                    modifier = Modifier.weight(1f),
                    textStyle = TextStyle(
                        color = Color.White,
                        fontSize = 16.sp
                    ),
                    singleLine = true,
                    cursorBrush = SolidColor(ElectricCyan),
                    decorationBox = { innerTextField ->
                        if (value.isBlank()) {
                            Text(
                                text = "Сообщение",
                                color = Color.White.copy(alpha = 0.45f),
                                fontSize = 16.sp
                            )
                        }
                        innerTextField()
                    }
                )

                Spacer(modifier = Modifier.size(8.dp))

                Box(
                    modifier = Modifier
                        .size(38.dp)
                        .drawBehind {
                            if (canSend) {
                                drawIntoCanvas { canvas ->
                                    val paint = Paint().asFrameworkPaint().apply {
                                        color = ElectricCyan.copy(alpha = 0.18f).toArgb()
                                        setShadowLayer(
                                            10.dp.toPx(),
                                            0f,
                                            0f,
                                            ElectricCyan.copy(alpha = 0.24f).toArgb()
                                        )
                                    }
                                    canvas.nativeCanvas.drawCircle(
                                        size.width / 2f,
                                        size.height / 2f,
                                        size.minDimension / 2.4f,
                                        paint
                                    )
                                }
                            }
                        }
                        .clip(CircleShape)
                        .background(
                            if (canSend) ElectricCyan.copy(alpha = 0.20f)
                            else Color.White.copy(alpha = 0.08f)
                        )
                        .bounceClick(
                            enabled = canSend,
                            onClick = onSendClick
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        painter = painterResource(id = android.R.drawable.ic_media_play),
                        contentDescription = "Отправить",
                        tint = if (canSend) ElectricCyan else Color.White.copy(alpha = 0.4f),
                        modifier = Modifier.size(14.dp)
                    )
                }
            }
        }
    }
}

@Preview(showBackground = true, device = "id:pixel_7_pro")
@Composable
private fun ChatScreenPreview() {
    MegaConvertBusinessTheme {
        ChatScreenContent(
            messages = listOf(
                Message(
                    id = "1",
                    text = "Привет! Как твои дела?",
                    isMine = false,
                    timestamp = 1L,
                ),
                Message(
                    id = "2",
                    text = "Все хорошо. Тестирую новый экран.",
                    isMine = true,
                    timestamp = 2L,
                ),
                Message(
                    id = "3",
                    text = "Liquid Glass выглядит отлично.",
                    isMine = true,
                    timestamp = 3L,
                )
            ),
            isBot = true,
            headerTitle = "MegaStore Support",
            headerAvatar = "🤖",
            headerAvatarModifier = Modifier,
            onBackClick = {},
            onRequirePro = {},
            isChannel = true,
            isAdmin = false,
            verifiedCompany = true,
            verificationBadge = "corporate",
            subscriberCount = 1290,
            isSending = false,
            errorMessage = null,
            onSendMessage = { _, _ -> },
            onReportMessage = { _, _ -> }
        )
    }
}

private const val SELF_CHAT_ID = "self-chat"
private const val VIDEO_TARGET_WIDTH = 1920
private const val VIDEO_TARGET_HEIGHT = 1080
private const val VIDEO_TARGET_QUALITY = 28
private const val FREE_PLAN_FILE_LIMIT_BYTES = 1_073_741_824L // 1 GB
private val DEFAULT_SLASH_COMMANDS = listOf("/start", "/help", "/settings")
private val REPORT_REASONS = listOf(
    ReportReason.SPAM,
    ReportReason.FRAUD,
    ReportReason.ILLEGAL_CONTENT
)
private const val MAX_HEADER_PARALLAX_PX = 36
private const val HEADER_PARALLAX_DIVISOR = 5

private fun calculateHeaderParallaxOffsetPx(
    firstVisibleItemIndex: Int,
    firstVisibleItemScrollOffset: Int
): Int {
    if (firstVisibleItemIndex > 0) return -MAX_HEADER_PARALLAX_PX
    val reducedOffset = firstVisibleItemScrollOffset / HEADER_PARALLAX_DIVISOR
    return -reducedOffset.coerceAtMost(MAX_HEADER_PARALLAX_PX)
}

private fun resolveFileSizeBytes(
    context: Context,
    uri: Uri
): Long? {
    if (uri.scheme == "file") {
        return uri.path?.let { path ->
            runCatching { File(path).length() }.getOrNull()
        }
    }

    context.contentResolver.query(
        uri,
        arrayOf(OpenableColumns.SIZE),
        null,
        null,
        null
    )?.use { cursor ->
        val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
        if (sizeIndex >= 0 && cursor.moveToFirst()) {
            val value = cursor.getLong(sizeIndex)
            if (value > 0L) return value
        }
    }

    return context.contentResolver.openAssetFileDescriptor(uri, "r")?.use { descriptor ->
        val length = descriptor.length
        if (length > 0L) length else null
    }
}
