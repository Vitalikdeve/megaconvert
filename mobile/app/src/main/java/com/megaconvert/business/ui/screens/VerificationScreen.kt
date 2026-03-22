package com.megaconvert.business.ui.screens

import android.annotation.SuppressLint
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.megaconvert.business.BuildConfig
import com.megaconvert.business.ui.components.GlassContainer
import com.megaconvert.business.ui.theme.DeepSpaceBlack
import com.megaconvert.business.ui.theme.ElectricCyan

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun VerificationScreen(
    modifier: Modifier = Modifier,
    onBackClick: () -> Unit
) {
    val context = LocalContext.current
    val webView = remember(context) {
        WebView(context).apply {
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                allowFileAccess = true
                mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            }
            webViewClient = WebViewClient()
            webChromeClient = WebChromeClient()
            loadUrl(SHEERID_VERIFICATION_URL)
        }
    }

    DisposableEffect(webView) {
        onDispose {
            webView.stopLoading()
            webView.removeAllViews()
            webView.destroy()
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(DeepSpaceBlack)
            .wrapContentSize(Alignment.Center)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth(0.94f)
                .widthIn(max = 620.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            RowHeader(
                title = "Верификация компании",
                onBackClick = onBackClick
            )

            Text(
                text = "SheerID откроется внутри защищенного окна для загрузки корпоративных данных.",
                color = Color.White.copy(alpha = 0.80f),
                fontSize = 13.sp
            )

            GlassContainer(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(620.dp),
                cornerRadius = 20.dp
            ) {
                AndroidView(
                    modifier = Modifier.fillMaxSize(),
                    factory = { webView },
                    update = { current ->
                        if (current.url != SHEERID_VERIFICATION_URL) {
                            current.loadUrl(SHEERID_VERIFICATION_URL)
                        }
                    }
                )
            }
        }
    }
}

@Composable
private fun RowHeader(
    title: String,
    onBackClick: () -> Unit
) {
    Box(
        modifier = Modifier.fillMaxWidth()
    ) {
        Box(
            modifier = Modifier
                .size(34.dp)
                .align(Alignment.CenterStart)
                .background(Color.White.copy(alpha = 0.08f), CircleShape)
                .clickable { onBackClick() },
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = "←",
                color = Color.White,
                fontSize = 17.sp
            )
        }

        Text(
            text = title,
            modifier = Modifier.align(Alignment.CenterStart).padding(start = 44.dp),
            color = Color.White,
            fontSize = 22.sp
        )

        Text(
            text = "🏢",
            modifier = Modifier.align(Alignment.CenterEnd),
            color = ElectricCyan.copy(alpha = 0.92f),
            fontSize = 18.sp
        )
    }
    Spacer(modifier = Modifier.height(2.dp))
}

private val SHEERID_VERIFICATION_URL = BuildConfig.SHEERID_VERIFICATION_URL
