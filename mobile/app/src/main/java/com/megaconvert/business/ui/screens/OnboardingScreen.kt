package com.megaconvert.business.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.ClickableText
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.megaconvert.business.ui.components.NeonButton
import com.megaconvert.business.ui.theme.DeepSpaceBlack
import com.megaconvert.business.ui.theme.MegaConvertBusinessTheme

private const val TermsTag = "terms"
private const val PrivacyTag = "privacy"
private val SubtitleColor = Color(0xFF9AA0AA)
private val LinkBlue = Color(0xFF4A8CFF)

@Composable
fun OnboardingScreen(
    modifier: Modifier = Modifier,
    onContinue: () -> Unit = {},
    onRestoreOrTransfer: () -> Unit = {},
    onTermsClick: () -> Unit = {},
    onPrivacyClick: () -> Unit = {}
) {
    val subtitle = remember {
        buildAnnotatedString {
            append("MegaConvert — некоммерческая организация\n")
            pushStringAnnotation(tag = TermsTag, annotation = TermsTag)
            withStyle(style = SpanStyle(color = LinkBlue)) { append("Условия") }
            pop()
            append(" и ")
            pushStringAnnotation(tag = PrivacyTag, annotation = PrivacyTag)
            withStyle(style = SpanStyle(color = LinkBlue)) { append("Политика") }
            pop()
            append(" конфиденциальности")
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
                .fillMaxWidth(0.9f)
                .widthIn(max = 480.dp)
                .fillMaxHeight(0.95f)
                .padding(vertical = 28.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Spacer(modifier = Modifier.weight(1f))

            Box(
                modifier = Modifier
                    .size(200.dp)
                    .background(
                        color = Color.LightGray.copy(alpha = 0.35f),
                        shape = RoundedCornerShape(24.dp)
                    )
            )

            Spacer(modifier = Modifier.height(40.dp))

            Text(
                text = "Возьмите конфиденциальность с собой.\nБудьте собой в каждом сообщении.",
                color = Color.White,
                fontSize = 24.sp,
                lineHeight = 32.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(16.dp))

            ClickableText(
                modifier = Modifier.fillMaxWidth(),
                text = subtitle,
                style = TextStyle(
                    color = SubtitleColor,
                    fontSize = 14.sp,
                    lineHeight = 20.sp,
                    textAlign = TextAlign.Center
                ),
                onClick = { offset ->
                    subtitle.getStringAnnotations(start = offset, end = offset)
                        .firstOrNull()
                        ?.let { annotation ->
                            when (annotation.tag) {
                                TermsTag -> onTermsClick()
                                PrivacyTag -> onPrivacyClick()
                            }
                        }
                }
            )

            Spacer(modifier = Modifier.weight(1f))

            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                NeonButton(
                    text = "Продолжить",
                    onClick = onContinue,
                    modifier = Modifier.fillMaxWidth()
                )

                TextButton(
                    modifier = Modifier.fillMaxWidth(),
                    onClick = onRestoreOrTransfer
                ) {
                    Text(
                        text = "Восстановить или перенести учетную запись",
                        color = Color.White,
                        fontSize = 15.sp,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        }
    }
}

@Preview(showBackground = true, device = "id:pixel_7_pro")
@Composable
private fun OnboardingScreenPreview() {
    MegaConvertBusinessTheme {
        OnboardingScreen()
    }
}
