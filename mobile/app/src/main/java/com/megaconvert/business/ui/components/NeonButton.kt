package com.megaconvert.business.ui.components

import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Paint
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.megaconvert.business.ui.theme.ElectricCyan

@Composable
fun NeonButton(
    text: String,
    onClick: () -> Unit,
    enabled: Boolean = true,
    modifier: Modifier = Modifier
) {
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()

    val glowRadius by animateDpAsState(
        if (enabled) {
            if (isPressed) 10.dp else 4.dp
        } else {
            0.dp
        },
        label = "glowRadius"
    )
    val glowAlpha by animateFloatAsState(
        if (enabled) {
            if (isPressed) 0.22f else 0.10f
        } else {
            0.0f
        },
        label = "glowAlpha"
    )
    val shadowAlpha by animateFloatAsState(
        if (enabled) {
            if (isPressed) 0.35f else 0.18f
        } else {
            0.0f
        },
        label = "shadowAlpha"
    )

    Box(
        modifier = modifier
            .drawBehind {
                if (glowRadius > 0.dp) {
                    drawIntoCanvas { canvas ->
                        val paint = Paint().asFrameworkPaint().apply {
                            color = ElectricCyan.copy(alpha = glowAlpha).toArgb()
                            setShadowLayer(
                                glowRadius.toPx(),
                                0f,
                                0f,
                                ElectricCyan.copy(alpha = shadowAlpha).toArgb()
                            )
                        }
                        canvas.nativeCanvas.drawRoundRect(
                            0f, 0f, size.width, size.height,
                            16.dp.toPx(), 16.dp.toPx(),
                            paint
                        )
                    }
                }
            }
            .bounceClick(
                enabled = enabled,
                interactionSource = interactionSource,
                onClick = onClick
            ),
        contentAlignment = Alignment.Center
    ) {
        GlassContainer(cornerRadius = 16.dp) {
            Box(
                modifier = Modifier.padding(horizontal = 24.dp, vertical = 12.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = text,
                    color = if (enabled) ElectricCyan else Color.White.copy(alpha = 0.35f),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 2.sp
                )
            }
        }
    }
}
