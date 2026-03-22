package com.megaconvert.business.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.ClickableText
import androidx.compose.material3.Checkbox
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
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
private const val LawTag = "law"
private val SubtitleColor = Color(0xFF9AA0AA)
private val LinkBlue = Color(0xFF4A8CFF)

@Composable
fun LegalAgreementScreen(
    modifier: Modifier = Modifier,
    onContinue: (timestamp: Long) -> Unit,
    onTermsClick: () -> Unit = {},
    onPrivacyClick: () -> Unit = {},
    onLawClick: () -> Unit = {}
) {
    var acceptedTerms by remember { mutableStateOf(false) }
    var acceptedPrivacy by remember { mutableStateOf(false) }
    val canContinue = acceptedTerms && acceptedPrivacy

    val legalLinksText = remember {
        buildAnnotatedString {
            pushStringAnnotation(tag = TermsTag, annotation = TermsTag)
            withStyle(style = SpanStyle(color = LinkBlue)) { append("Terms of Service") }
            pop()
            append(" • ")
            pushStringAnnotation(tag = PrivacyTag, annotation = PrivacyTag)
            withStyle(style = SpanStyle(color = LinkBlue)) { append("Privacy Policy") }
            pop()
            append(" • ")
            pushStringAnnotation(tag = LawTag, annotation = LawTag)
            withStyle(style = SpanStyle(color = LinkBlue)) { append("Law Enforcement Guidelines") }
            pop()
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
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Text(
                text = "Юридическое согласие",
                color = Color.White,
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold
            )

            Text(
                text = "Перед началом работы необходимо принять документы и дать явное согласие.",
                color = SubtitleColor,
                fontSize = 14.sp,
                lineHeight = 20.sp
            )

            ClickableText(
                modifier = Modifier.fillMaxWidth(),
                text = legalLinksText,
                style = TextStyle(
                    color = SubtitleColor,
                    fontSize = 14.sp,
                    textAlign = TextAlign.Start
                ),
                onClick = { offset ->
                    legalLinksText.getStringAnnotations(start = offset, end = offset)
                        .firstOrNull()
                        ?.let { annotation ->
                            when (annotation.tag) {
                                TermsTag -> onTermsClick()
                                PrivacyTag -> onPrivacyClick()
                                LawTag -> onLawClick()
                            }
                        }
                }
            )

            Spacer(modifier = Modifier.height(6.dp))

            LegalCheckRow(
                checked = acceptedTerms,
                text = "Я прочитал и согласен с Условиями использования.",
                onCheckedChange = { acceptedTerms = it }
            )

            LegalCheckRow(
                checked = acceptedPrivacy,
                text = "Я согласен на обработку минимальных метаданных согласно Политике конфиденциальности (GDPR).",
                onCheckedChange = { acceptedPrivacy = it }
            )

            Spacer(modifier = Modifier.weight(1f))

            NeonButton(
                text = "Продолжить",
                onClick = { onContinue(System.currentTimeMillis()) },
                enabled = canContinue,
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

@Composable
private fun LegalCheckRow(
    checked: Boolean,
    text: String,
    onCheckedChange: (Boolean) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color.White.copy(alpha = 0.03f), RoundedCornerShape(14.dp))
            .clickable { onCheckedChange(!checked) }
            .padding(horizontal = 10.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Checkbox(
            checked = checked,
            onCheckedChange = onCheckedChange
        )

        Text(
            text = text,
            color = Color.White.copy(alpha = 0.92f),
            fontSize = 14.sp,
            lineHeight = 19.sp
        )
    }
}

@Preview(showBackground = true, device = "id:pixel_7_pro")
@Composable
private fun LegalAgreementScreenPreview() {
    MegaConvertBusinessTheme {
        LegalAgreementScreen(
            onContinue = {}
        )
    }
}
