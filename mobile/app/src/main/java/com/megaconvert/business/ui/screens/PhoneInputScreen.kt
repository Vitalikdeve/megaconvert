package com.megaconvert.business.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.megaconvert.business.ui.components.GlassCard
import com.megaconvert.business.ui.theme.DeepSpaceBlack
import com.megaconvert.business.ui.theme.ElectricCyan
import com.megaconvert.business.ui.theme.MegaConvertBusinessTheme

private val SubtitleGray = Color(0xFF9AA0AA)
private val NextButtonBlue = Color(0xFF2F80FF)
private val DividerGray = Color.White.copy(alpha = 0.14f)

@Composable
fun PhoneInputScreen(
    modifier: Modifier = Modifier,
    initialPhone: String = "",
    onPhoneChanged: (String) -> Unit = {},
    onSettingsClick: () -> Unit = {},
    onNextClick: () -> Unit = {},
    onCancelClick: () -> Unit = {},
    onCountryCodeClick: () -> Unit = {}
) {
    var phoneNumber by rememberSaveable { mutableStateOf(initialPhone) }

    Scaffold(
        modifier = modifier,
        containerColor = DeepSpaceBlack,
        topBar = {
            PhoneInputTopBar(
                onSettingsClick = onSettingsClick,
                onNextClick = onNextClick
            )
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
                Spacer(modifier = Modifier.height(32.dp))

                Text(
                    text = "Ваш номер телефона",
                    color = Color.White,
                    fontSize = 32.sp,
                    fontWeight = FontWeight.Bold
                )

                Spacer(modifier = Modifier.height(10.dp))

                Text(
                    text = "Введите свой номер телефона, чтобы начать.",
                    color = SubtitleGray,
                    fontSize = 16.sp
                )

                Spacer(modifier = Modifier.height(28.dp))

                GlassCard(
                    modifier = Modifier.fillMaxWidth(),
                    cornerRadius = 16.dp
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(
                            modifier = Modifier
                                .clip(RoundedCornerShape(12.dp))
                                .clickable(onClick = onCountryCodeClick)
                                .padding(horizontal = 6.dp, vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "+375",
                                color = Color.White,
                                fontSize = 20.sp,
                                fontWeight = FontWeight.Medium
                            )

                            Spacer(modifier = Modifier.width(6.dp))

                            Text(
                                text = "▾",
                                color = SubtitleGray,
                                fontSize = 16.sp
                            )
                        }

                        Spacer(modifier = Modifier.width(10.dp))

                        Box(
                            modifier = Modifier
                                .height(30.dp)
                                .width(1.dp)
                                .background(DividerGray)
                        )

                        Spacer(modifier = Modifier.width(12.dp))

                        BasicTextField(
                            value = phoneNumber,
                            onValueChange = { raw ->
                                val sanitized = raw.filter {
                                    it.isDigit() || it == ' ' || it == '-' || it == '(' || it == ')'
                                }
                                phoneNumber = sanitized
                                onPhoneChanged(sanitized)
                            },
                            modifier = Modifier.weight(1f),
                            singleLine = true,
                            textStyle = TextStyle(
                                color = Color.White,
                                fontSize = 24.sp,
                                fontWeight = FontWeight.Medium
                            ),
                            cursorBrush = SolidColor(ElectricCyan),
                            keyboardOptions = KeyboardOptions(
                                keyboardType = KeyboardType.Phone
                            ),
                            decorationBox = { innerTextField ->
                                if (phoneNumber.isEmpty()) {
                                    Text(
                                        text = "29 123 45 67",
                                        color = Color.White.copy(alpha = 0.45f),
                                        fontSize = 24.sp,
                                        fontWeight = FontWeight.Medium
                                    )
                                }
                                innerTextField()
                            }
                        )
                    }
                }
            }

            TextButton(
                onClick = onCancelClick,
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth(0.9f)
                    .widthIn(max = 480.dp)
                    .imePadding()
                    .padding(bottom = 16.dp)
            ) {
                Text(
                    text = "Отменить",
                    color = Color.White,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Medium
                )
            }
        }
    }
}

@Composable
private fun PhoneInputTopBar(
    onSettingsClick: () -> Unit,
    onNextClick: () -> Unit
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
                    .clickable(onClick = onSettingsClick),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "...",
                    color = Color.White,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            Spacer(modifier = Modifier.weight(1f))

            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(999.dp))
                    .background(NextButtonBlue)
                    .clickable(onClick = onNextClick)
                    .padding(horizontal = 20.dp, vertical = 10.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "Далее",
                    color = Color.White,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }
    }
}

@Preview(showBackground = true, device = "id:pixel_7_pro")
@Composable
private fun PhoneInputScreenPreview() {
    MegaConvertBusinessTheme {
        PhoneInputScreen()
    }
}
