package com.megaconvert.business.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.megaconvert.business.ui.components.GlassContainer
import com.megaconvert.business.ui.theme.DeepSpaceBlack
import com.megaconvert.business.ui.theme.ElectricCyan
import com.megaconvert.business.ui.theme.MegaConvertBusinessTheme

data class ChatListItem(
    val id: String,
    val title: String,
    val subtitle: String,
    val avatarEmoji: String,
    val isBot: Boolean = false
)

@Composable
fun ChatListScreen(
    chats: List<ChatListItem>,
    onChatClick: (ChatListItem) -> Unit,
    modifier: Modifier = Modifier,
    avatarModifierFor: @Composable (ChatListItem) -> Modifier = { Modifier }
) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .wrapContentSize(Alignment.Center)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth(0.92f)
                .widthIn(max = 520.dp)
        ) {
            Text(
                text = "Чаты",
                color = Color.White,
                fontSize = 28.sp,
                fontWeight = FontWeight.SemiBold
            )

            Spacer(modifier = Modifier.height(12.dp))

            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(chats, key = { it.id }) { chat ->
                    GlassContainer(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onChatClick(chat) },
                        cornerRadius = 18.dp
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(
                                    color = Color.White.copy(alpha = 0.02f),
                                    shape = RoundedCornerShape(18.dp)
                                )
                                .padding(horizontal = 12.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(
                                modifier = avatarModifierFor(chat)
                                    .size(42.dp)
                                    .clip(CircleShape)
                                    .background(ElectricCyan.copy(alpha = 0.22f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = chat.avatarEmoji,
                                    fontSize = 21.sp
                                )
                            }

                            Spacer(modifier = Modifier.size(10.dp))

                            Column(
                                modifier = Modifier.weight(1f)
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = chat.title,
                                        color = Color.White,
                                        fontSize = 16.sp,
                                        fontWeight = FontWeight.SemiBold
                                    )
                                    if (chat.isBot) {
                                        Spacer(modifier = Modifier.size(6.dp))
                                        Text(
                                            text = "🤖",
                                            fontSize = 14.sp
                                        )
                                    }
                                }

                                Spacer(modifier = Modifier.height(2.dp))
                                Text(
                                    text = chat.subtitle,
                                    color = Color.White.copy(alpha = 0.65f),
                                    fontSize = 13.sp
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Preview(showBackground = true, device = "id:pixel_7_pro")
@Composable
private fun ChatListScreenPreview() {
    MegaConvertBusinessTheme {
        ChatListScreen(
            chats = listOf(
                ChatListItem(
                    id = "support-bot",
                    title = "MegaStore Support",
                    subtitle = "Нажми, чтобы открыть чат",
                    avatarEmoji = "🤖",
                    isBot = true
                ),
                ChatListItem(
                    id = "alex",
                    title = "Алексей",
                    subtitle = "Последнее сообщение...",
                    avatarEmoji = "🧑‍💻"
                )
            ),
            onChatClick = {}
        )
    }
}
