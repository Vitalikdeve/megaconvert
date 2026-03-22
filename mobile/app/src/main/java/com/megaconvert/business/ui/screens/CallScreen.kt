package com.megaconvert.business.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.megaconvert.business.data.webrtc.WebRtcClient
import com.megaconvert.business.ui.theme.DeepSpaceBlack
import com.megaconvert.business.ui.theme.GlassBorder
import com.megaconvert.business.ui.theme.MegaConvertBusinessTheme
import org.webrtc.EglBase
import org.webrtc.SurfaceViewRenderer
import org.webrtc.VideoTrack

@Composable
fun CallScreen(
    webRtcClient: WebRtcClient,
    verificationEmojis: List<String>,
    modifier: Modifier = Modifier,
    onHangUp: () -> Unit = {}
) {
    val localVideoTrack by webRtcClient.localVideoTrack.collectAsState()
    val remoteVideoTrack by webRtcClient.remoteVideoTrack.collectAsState()
    var isMicEnabled by rememberSaveable { mutableStateOf(true) }

    LaunchedEffect(webRtcClient) {
        webRtcClient.ensureLocalMedia()
    }

    CallScreenContent(
        modifier = modifier,
        eglBaseContext = webRtcClient.getEglBaseContext(),
        remoteVideoTrack = remoteVideoTrack,
        localVideoTrack = localVideoTrack,
        verificationEmojis = verificationEmojis,
        isMicEnabled = isMicEnabled,
        onToggleMic = {
            isMicEnabled = !isMicEnabled
            webRtcClient.setMicrophoneEnabled(isMicEnabled)
        },
        onSwitchCamera = webRtcClient::switchCamera,
        onHangUp = onHangUp
    )
}

@Composable
private fun CallScreenContent(
    eglBaseContext: EglBase.Context?,
    remoteVideoTrack: VideoTrack?,
    localVideoTrack: VideoTrack?,
    verificationEmojis: List<String>,
    isMicEnabled: Boolean,
    onToggleMic: () -> Unit,
    onSwitchCamera: () -> Unit,
    onHangUp: () -> Unit,
    modifier: Modifier = Modifier
) {
    val pipShape = RoundedCornerShape(16.dp)

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(DeepSpaceBlack)
    ) {
        WebRtcSurface(
            modifier = Modifier.fillMaxSize(),
            eglBaseContext = eglBaseContext,
            videoTrack = remoteVideoTrack,
            mirror = false,
            overlay = false,
            emptyLabel = "Ожидание видео собеседника"
        )

        WebRtcSurface(
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(top = 88.dp, end = 16.dp)
                .size(width = 120.dp, height = 180.dp)
                .clip(pipShape)
                .border(0.5.dp, GlassBorder, pipShape),
            eglBaseContext = eglBaseContext,
            videoTrack = localVideoTrack,
            mirror = true,
            overlay = true,
            emptyLabel = "Вы"
        )

        Row(
            modifier = Modifier
                .align(Alignment.TopCenter)
                .statusBarsPadding()
                .padding(top = 12.dp)
                .clip(RoundedCornerShape(14.dp))
                .background(Color.Black.copy(alpha = 0.42f))
                .border(0.5.dp, GlassBorder, RoundedCornerShape(14.dp))
                .padding(horizontal = 14.dp, vertical = 8.dp)
                .widthIn(max = 420.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = verificationEmojis.take(4).joinToString(" "),
                color = Color.White,
                fontSize = 24.sp,
                fontWeight = FontWeight.SemiBold
            )
        }

        Row(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 32.dp),
            horizontalArrangement = Arrangement.spacedBy(22.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            CallControlButton(
                iconRes = if (isMicEnabled) android.R.drawable.ic_lock_silent_mode_off
                else android.R.drawable.ic_lock_silent_mode,
                backgroundColor = Color.White.copy(alpha = 0.16f),
                iconTint = Color.White,
                contentDescription = "Отключить микрофон",
                onClick = onToggleMic
            )
            CallControlButton(
                iconRes = android.R.drawable.ic_menu_camera,
                backgroundColor = Color.White.copy(alpha = 0.16f),
                iconTint = Color.White,
                contentDescription = "Поворот камеры",
                onClick = onSwitchCamera
            )
            CallControlButton(
                iconRes = android.R.drawable.ic_menu_close_clear_cancel,
                backgroundColor = Color(0xFFEF5350),
                iconTint = Color.White,
                contentDescription = "Сбросить звонок",
                onClick = onHangUp
            )
        }
    }
}

@Composable
private fun CallControlButton(
    iconRes: Int,
    backgroundColor: Color,
    iconTint: Color,
    contentDescription: String,
    onClick: () -> Unit
) {
    IconButton(
        modifier = Modifier
            .size(56.dp)
            .clip(CircleShape)
            .background(backgroundColor),
        onClick = onClick
    ) {
        Icon(
            painter = androidx.compose.ui.res.painterResource(id = iconRes),
            contentDescription = contentDescription,
            tint = iconTint
        )
    }
}

@Composable
private fun WebRtcSurface(
    eglBaseContext: EglBase.Context?,
    videoTrack: VideoTrack?,
    mirror: Boolean,
    overlay: Boolean,
    emptyLabel: String,
    modifier: Modifier = Modifier
) {
    if (eglBaseContext == null) {
        Box(
            modifier = modifier.background(Color.Black),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = emptyLabel,
                color = Color.White.copy(alpha = 0.65f),
                fontSize = 13.sp
            )
        }
        return
    }

    var rendererView by remember { mutableStateOf<SurfaceViewRenderer?>(null) }

    AndroidView(
        modifier = modifier.background(Color.Black),
        factory = { context ->
            SurfaceViewRenderer(context).apply {
                init(eglBaseContext, null)
                setEnableHardwareScaler(true)
                setMirror(mirror)
                setZOrderMediaOverlay(overlay)
                rendererView = this
            }
        },
        update = { view ->
            view.setMirror(mirror)
            view.setZOrderMediaOverlay(overlay)
        }
    )

    DisposableEffect(videoTrack, rendererView) {
        val renderer = rendererView
        if (videoTrack != null && renderer != null) {
            videoTrack.addSink(renderer)
        }

        onDispose {
            if (videoTrack != null && renderer != null) {
                runCatching { videoTrack.removeSink(renderer) }
            }
        }
    }

    DisposableEffect(Unit) {
        onDispose {
            rendererView?.release()
            rendererView = null
        }
    }

    if (videoTrack == null) {
        Box(
            modifier = modifier,
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = emptyLabel,
                color = Color.White.copy(alpha = 0.65f),
                fontSize = 13.sp
            )
        }
    }
}

@Preview(showBackground = true, device = "id:pixel_7_pro")
@Composable
private fun CallScreenPreview() {
    MegaConvertBusinessTheme {
        CallScreenContent(
            eglBaseContext = null,
            remoteVideoTrack = null,
            localVideoTrack = null,
            verificationEmojis = listOf("🐶", "🍎", "🚗", "⚽"),
            isMicEnabled = true,
            onToggleMic = {},
            onSwitchCamera = {},
            onHangUp = {}
        )
    }
}
