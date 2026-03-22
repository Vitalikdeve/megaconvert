package com.megaconvert.business.ui.screens

import android.Manifest
import android.os.Build
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.LocalInspectionMode
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.megaconvert.business.data.mesh.MeshRadarService
import com.megaconvert.business.data.mesh.MeshRuntimeRegistry
import com.megaconvert.business.ui.components.GlassContainer
import com.megaconvert.business.ui.theme.DeepSpaceBlack

@Composable
fun MeshRadarScreen(
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val haptic = LocalHapticFeedback.current
    val isPreview = LocalInspectionMode.current
    var isRadarEnabled by rememberSaveable { mutableStateOf(MeshRuntimeRegistry.isActive()) }

    fun startRadar() {
        if (!isPreview) {
            MeshRadarService.start(context)
        }
        isRadarEnabled = true
        Toast.makeText(context, "Offline Радар включен", Toast.LENGTH_SHORT).show()
    }

    fun stopRadar() {
        if (!isPreview) {
            MeshRadarService.stop(context)
        }
        isRadarEnabled = false
        Toast.makeText(context, "Offline Радар отключен", Toast.LENGTH_SHORT).show()
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val granted = permissions.values.all { it }
        if (granted) {
            startRadar()
        } else {
            isRadarEnabled = false
            Toast.makeText(
                context,
                "Нужны Bluetooth-разрешения для Offline Радара",
                Toast.LENGTH_SHORT
            ).show()
        }
    }

    fun requestAndStartRadar() {
        val requiredPermissions = when {
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> arrayOf(
                Manifest.permission.BLUETOOTH_SCAN,
                Manifest.permission.BLUETOOTH_ADVERTISE,
                Manifest.permission.BLUETOOTH_CONNECT
            )
            else -> arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)
        }
        permissionLauncher.launch(requiredPermissions)
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
            GlassContainer(
                modifier = Modifier
                    .fillMaxWidth(0.92f)
                    .widthIn(max = 520.dp),
                cornerRadius = 20.dp
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color.White.copy(alpha = 0.02f))
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = "Offline Радар",
                        color = Color.White,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 22.sp
                    )

                    Text(
                        text = "Использует BLE Mesh для поиска узлов рядом, когда нет интернета.",
                        color = Color.White.copy(alpha = 0.75f),
                        fontSize = 14.sp
                    )

                    Spacer(modifier = Modifier.weight(1f, fill = false))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = if (isRadarEnabled) "Активен" else "Отключен",
                            color = Color.White,
                            fontSize = 15.sp
                        )

                        Spacer(modifier = Modifier.weight(1f))

                        Switch(
                            checked = isRadarEnabled,
                            onCheckedChange = { shouldEnable ->
                                haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                if (shouldEnable) {
                                    requestAndStartRadar()
                                } else {
                                    stopRadar()
                                }
                            }
                        )
                    }
                }
            }
        }
    }
}
