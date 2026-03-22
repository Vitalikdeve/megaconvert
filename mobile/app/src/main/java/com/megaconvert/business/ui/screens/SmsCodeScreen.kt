package com.megaconvert.business.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Icon
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.megaconvert.business.ui.components.GlassCard
import com.megaconvert.business.ui.theme.DeepSpaceBlack
import com.megaconvert.business.ui.theme.ElectricCyan
import com.megaconvert.business.ui.theme.MegaConvertBusinessTheme

private const val OtpLength = 5
private val SecondaryTextColor = Color(0xFF9AA0AA)
private val LinkColor = Color(0xFF4A8CFF)

@Composable
fun SmsCodeScreen(
    modifier: Modifier = Modifier,
    maskedPhone: String = "+375 29 XXX-XX-XX",
    onBackClick: () -> Unit = {},
    onWrongNumberClick: () -> Unit = {},
    onCodeChange: (String) -> Unit = {},
    onCaptchaClick: () -> Unit = {}
) {
    var code by rememberSaveable { mutableStateOf("") }

    Scaffold(
        modifier = modifier,
        containerColor = DeepSpaceBlack,
        topBar = {
            SmsCodeTopBar(onBackClick = onBackClick)
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
                    .align(Alignment.Center)
                    .fillMaxWidth(0.9f)
                    .widthIn(max = 480.dp)
            ) {
                Spacer(modifier = Modifier.height(24.dp))

                Text(
                    text = "Код подтверждения",
                    color = Color.White,
                    fontSize = 32.sp,
                    fontWeight = FontWeight.Bold
                )

                Spacer(modifier = Modifier.height(10.dp))

                Text(
                    text = "Введите код, который мы отправили на $maskedPhone",
                    color = SecondaryTextColor,
                    fontSize = 16.sp
                )

                Spacer(modifier = Modifier.height(12.dp))

                Text(
                    text = "Неправильный номер?",
                    color = LinkColor,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Medium,
                    modifier = Modifier.clickable(onClick = onWrongNumberClick)
                )

                Spacer(modifier = Modifier.height(36.dp))

                OtpDashInput(
                    code = code,
                    onCodeChange = { next ->
                        code = next
                        onCodeChange(next)
                    }
                )
            }

            Column(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth(0.9f)
                    .widthIn(max = 480.dp)
                    .imePadding()
                    .padding(bottom = 16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Text(
                    text = "Нам нужно убедиться, что вы человек",
                    color = SecondaryTextColor,
                    fontSize = 14.sp
                )

                GlassCard(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable(onClick = onCaptchaClick),
                    cornerRadius = 16.dp
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(26.dp)
                                .border(
                                    width = 1.dp,
                                    color = Color.White.copy(alpha = 0.9f),
                                    shape = RoundedCornerShape(6.dp)
                                )
                        )

                        Spacer(modifier = Modifier.width(12.dp))

                        Text(
                            text = "Я человек",
                            color = Color.White,
                            fontSize = 18.sp,
                            modifier = Modifier.weight(1f)
                        )

                        Column(horizontalAlignment = Alignment.End) {
                            Icon(
                                painter = painterResource(id = android.R.drawable.ic_dialog_info),
                                contentDescription = "hCaptcha",
                                tint = ElectricCyan,
                                modifier = Modifier.size(20.dp)
                            )
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = "Конфиденциальность - Условия",
                                color = SecondaryTextColor,
                                fontSize = 10.sp
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SmsCodeTopBar(
    onBackClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .wrapContentSize(Alignment.Center)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth(0.9f)
                .widthIn(max = 480.dp)
                .padding(vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(Color.White.copy(alpha = 0.12f))
                    .clickable(onClick = onBackClick),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "←",
                    color = Color.White,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }
    }
}

@Composable
private fun OtpDashInput(
    code: String,
    onCodeChange: (String) -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(84.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.Center),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            repeat(OtpLength) { index ->
                val symbol = code.getOrNull(index)?.toString().orEmpty()
                val lineColor = when {
                    index < code.length -> ElectricCyan
                    index == code.length -> ElectricCyan.copy(alpha = 0.75f)
                    else -> Color.White.copy(alpha = 0.28f)
                }

                Column(
                    modifier = Modifier.weight(1f),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = symbol,
                        color = Color.White,
                        fontSize = 30.sp,
                        fontWeight = FontWeight.SemiBold
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    Box(
                        modifier = Modifier
                            .height(2.dp)
                            .fillMaxWidth()
                            .background(lineColor)
                    )
                }
            }
        }

        BasicTextField(
            value = code,
            onValueChange = { raw ->
                onCodeChange(raw.filter { it.isDigit() }.take(OtpLength))
            },
            modifier = Modifier
                .fillMaxSize()
                .alpha(0.02f),
            singleLine = true,
            cursorBrush = SolidColor(ElectricCyan),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
        )
    }
}

@Preview(showBackground = true, device = "id:pixel_7_pro")
@Composable
private fun SmsCodeScreenPreview() {
    MegaConvertBusinessTheme {
        SmsCodeScreen()
    }
}
