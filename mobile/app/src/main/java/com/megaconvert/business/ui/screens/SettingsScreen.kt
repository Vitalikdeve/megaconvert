package com.megaconvert.business.ui.screens

import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.megaconvert.business.ui.components.GlassContainer
import com.megaconvert.business.ui.theme.DeepSpaceBlack
import kotlinx.coroutines.launch

@Composable
fun SettingsScreen(
    modifier: Modifier = Modifier,
    onDeleteAccount: suspend () -> Result<Unit>,
    onExportData: suspend () -> Result<String>,
    onOpenVerification: () -> Unit,
    onOpenPaywall: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var showDeleteDialog by rememberSaveable { mutableStateOf(false) }
    var confirmText by rememberSaveable { mutableStateOf("") }
    var deleting by rememberSaveable { mutableStateOf(false) }
    var exporting by rememberSaveable { mutableStateOf(false) }
    var pendingExportPayload by remember { mutableStateOf<String?>(null) }
    var errorText by rememberSaveable { mutableStateOf<String?>(null) }
    val canDelete = remember(confirmText, deleting) {
        confirmText.trim() == DELETE_CONFIRM_WORD && !deleting
    }
    val canExport = remember(exporting, deleting) { !exporting && !deleting }

    val createDocumentLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.CreateDocument("application/json")
    ) { uri ->
        val payload = pendingExportPayload
        pendingExportPayload = null
        if (uri == null || payload == null) {
            if (payload != null) {
                Toast.makeText(context, "Экспорт отменен", Toast.LENGTH_SHORT).show()
            }
            return@rememberLauncherForActivityResult
        }

        runCatching {
            context.contentResolver.openOutputStream(uri)?.bufferedWriter().use { writer ->
                checkNotNull(writer) { "Не удалось открыть файл для записи" }
                writer.write(payload)
            }
        }.onSuccess {
            Toast.makeText(context, "Данные экспортированы", Toast.LENGTH_SHORT).show()
        }.onFailure { error ->
            errorText = error.message ?: "Не удалось сохранить файл"
        }
    }

    if (showDeleteDialog) {
        AlertDialog(
            onDismissRequest = {
                if (!deleting) showDeleteDialog = false
            },
            title = {
                Text(
                    text = "Удалить аккаунт навсегда",
                    color = Color.White,
                    fontWeight = FontWeight.SemiBold
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        text = "Это действие необратимо. Все ваши зашифрованные чаты, ключи и связи с Google-аккаунтом будут уничтожены. Подтвердите действие, введя слово DELETE.",
                        color = Color.White.copy(alpha = 0.88f),
                        fontSize = 13.sp,
                        lineHeight = 18.sp
                    )

                    OutlinedTextField(
                        value = confirmText,
                        onValueChange = { confirmText = it },
                        label = { Text("Введите DELETE") },
                        singleLine = true,
                        enabled = !deleting,
                        modifier = Modifier.fillMaxWidth()
                    )

                    if (!errorText.isNullOrBlank()) {
                        Text(
                            text = errorText.orEmpty(),
                            color = Color(0xFFFF7A7A),
                            fontSize = 12.sp
                        )
                    }
                }
            },
            confirmButton = {
                TextButton(
                    enabled = canDelete,
                    onClick = {
                        deleting = true
                        errorText = null
                        scope.launch {
                            val result = onDeleteAccount()
                            errorText = result.exceptionOrNull()?.message
                            deleting = false
                            if (result.isSuccess) {
                                showDeleteDialog = false
                                confirmText = ""
                            }
                        }
                    }
                ) {
                    Text(
                        text = if (deleting) "Удаление..." else "Удалить",
                        color = Color(0xFFFF5C5C)
                    )
                }
            },
            dismissButton = {
                TextButton(
                    enabled = !deleting,
                    onClick = {
                        showDeleteDialog = false
                    }
                ) {
                    Text("Отмена")
                }
            },
            containerColor = DeepSpaceBlack
        )
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(DeepSpaceBlack)
            .wrapContentSize(Alignment.Center)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth(0.92f)
                .widthIn(max = 520.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "Настройки",
                color = Color.White,
                fontSize = 26.sp,
                fontWeight = FontWeight.SemiBold
            )

            GlassContainer(
                modifier = Modifier.fillMaxWidth(),
                cornerRadius = 18.dp
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color.White.copy(alpha = 0.02f), RoundedCornerShape(18.dp))
                        .padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = "Конфиденциальность",
                        color = Color.White.copy(alpha = 0.95f),
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Medium
                    )

                    Spacer(modifier = Modifier.height(2.dp))

                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(
                                color = Color(0x22FF4D4D),
                                shape = RoundedCornerShape(14.dp)
                            )
                            .padding(horizontal = 12.dp, vertical = 10.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            TextButton(onClick = { showDeleteDialog = true }) {
                                Text(
                                    text = "Удалить аккаунт навсегда",
                                    color = Color(0xFFFF5C5C),
                                    fontWeight = FontWeight.SemiBold
                                )
                            }
                        }
                    }

                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(
                                color = Color.White.copy(alpha = 0.04f),
                                shape = RoundedCornerShape(14.dp)
                            )
                            .padding(horizontal = 12.dp, vertical = 10.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            TextButton(
                                enabled = canExport,
                                onClick = {
                                    exporting = true
                                    errorText = null
                                    scope.launch {
                                        onExportData()
                                            .onSuccess { jsonPayload ->
                                                pendingExportPayload = jsonPayload
                                                createDocumentLauncher.launch(EXPORT_FILE_NAME)
                                            }
                                            .onFailure { error ->
                                                errorText = error.message ?: "Не удалось сформировать экспорт"
                                            }
                                        exporting = false
                                    }
                                }
                            ) {
                                Text(
                                    text = if (exporting) "Экспорт..." else "Экспорт моих данных",
                                    color = Color.White.copy(alpha = 0.92f),
                                    fontWeight = FontWeight.SemiBold
                                )
                            }
                        }
                    }

                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(
                                color = Color(0x2200E5FF),
                                shape = RoundedCornerShape(14.dp)
                            )
                            .padding(horizontal = 12.dp, vertical = 10.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            TextButton(onClick = onOpenPaywall) {
                                Text(
                                    text = "MegaConvert Pro",
                                    color = Color(0xFF7DEBFF),
                                    fontWeight = FontWeight.SemiBold
                                )
                            }
                        }
                    }

                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(
                                color = Color.White.copy(alpha = 0.04f),
                                shape = RoundedCornerShape(14.dp)
                            )
                            .padding(horizontal = 12.dp, vertical = 10.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            TextButton(onClick = onOpenVerification) {
                                Text(
                                    text = "Подтвердить место работы (SheerID)",
                                    color = Color.White.copy(alpha = 0.92f),
                                    fontWeight = FontWeight.SemiBold
                                )
                            }
                        }
                    }

                    if (!errorText.isNullOrBlank()) {
                        Text(
                            text = errorText.orEmpty(),
                            color = Color(0xFFFF7A7A),
                            fontSize = 12.sp
                        )
                    }
                }
            }
        }
    }
}

private const val DELETE_CONFIRM_WORD = "DELETE"
private const val EXPORT_FILE_NAME = "megaconvert_export.json"
