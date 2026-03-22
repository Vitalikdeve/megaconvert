package com.megaconvert.business.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

private val DarkColorScheme = darkColorScheme(
    primary = ElectricCyan,
    secondary = ElectricCyan,
    tertiary = ElectricCyan,
    background = DeepSpaceBlack,
    surface = DeepSpaceBlack,
    onPrimary = DeepSpaceBlack,
    onSecondary = DeepSpaceBlack,
    onTertiary = DeepSpaceBlack,
    onBackground = androidx.compose.ui.graphics.Color.White,
    onSurface = androidx.compose.ui.graphics.Color.White
)

@Composable
fun MegaConvertBusinessTheme(
    darkTheme: Boolean = true,
    dynamicColor: Boolean = false,
    content: @Composable () -> Unit
) {
    val colorScheme = DarkColorScheme

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
