package com.megaconvert.business.ui.components

import android.graphics.RenderEffect
import android.graphics.Shader
import android.os.Build
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.asComposeRenderEffect
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.megaconvert.business.ui.theme.GlassBorder
import com.megaconvert.business.ui.theme.GlassGradientEnd
import com.megaconvert.business.ui.theme.GlassGradientStart

@Composable
fun GlassContainer(
    modifier: Modifier = Modifier,
    cornerRadius: Dp = 16.dp,
    content: @Composable () -> Unit
) {
    val shape = RoundedCornerShape(cornerRadius)

    Box(
        modifier = modifier.clip(shape)
    ) {
        Spacer(
            modifier = Modifier
                .fillMaxSize()
                .graphicsLayer {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                        renderEffect = RenderEffect.createBlurEffect(
                            50f,
                            50f,
                            Shader.TileMode.DECAL
                        ).asComposeRenderEffect()
                    }
                    clip = true
                    this.shape = shape
                }
                .background(
                    brush = Brush.verticalGradient(
                        colors = listOf(GlassGradientStart, GlassGradientEnd)
                    ),
                    shape = shape
                )
                .border(
                    width = 0.5.dp,
                    color = GlassBorder,
                    shape = shape
                )
        )

        content()
    }
}

fun Modifier.liquidGlass(cornerRadius: Dp = 16.dp): Modifier {
    val shape = RoundedCornerShape(cornerRadius)
    return this
        .clip(shape)
        .background(
            brush = Brush.verticalGradient(
                colors = listOf(GlassGradientStart, GlassGradientEnd)
            ),
            shape = shape
        )
        .border(
            width = 0.5.dp,
            color = GlassBorder,
            shape = shape
        )
}
