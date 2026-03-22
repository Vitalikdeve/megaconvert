package com.megaconvert.business.ui.screens

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.widget.Toast
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.megaconvert.business.data.auth.AuthSessionStore
import com.megaconvert.business.data.billing.BillingManager
import com.megaconvert.business.ui.components.GlassCard
import com.megaconvert.business.ui.components.GlassContainer
import com.megaconvert.business.ui.components.NeonButton
import com.megaconvert.business.ui.components.bounceClick
import com.megaconvert.business.ui.theme.DeepSpaceBlack
import com.megaconvert.business.ui.theme.ElectricCyan
import kotlinx.coroutines.delay

@Composable
fun PaywallScreen(
    billingManager: BillingManager,
    modifier: Modifier = Modifier,
    onBackClick: () -> Unit
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val activity = remember(context) { context.findActivity() }
    val authSessionStore = remember(context) { AuthSessionStore(context.applicationContext) }

    val verifiedCompany by authSessionStore.verifiedCompanyFlow.collectAsState(initial = false)
    val connectionState by billingManager.connectionState.collectAsState()
    val subscriptionPlans by billingManager.subscriptionPlans.collectAsState()
    val purchaseState by billingManager.purchaseState.collectAsState()

    val selectedPlan = subscriptionPlans.firstOrNull()
    val isBillingBusy = purchaseState is BillingManager.PurchaseState.Launching ||
        purchaseState is BillingManager.PurchaseState.Verifying

    LaunchedEffect(Unit) {
        billingManager.startConnection()
    }

    DisposableEffect(Unit) {
        onDispose {
            billingManager.stopConnection()
            billingManager.resetPurchaseState()
        }
    }

    LaunchedEffect(connectionState, subscriptionPlans) {
        if (connectionState == BillingManager.ConnectionState.CONNECTED && subscriptionPlans.isEmpty()) {
            billingManager.querySubscriptionPlans()
        }
    }

    LaunchedEffect(purchaseState) {
        when (val state = purchaseState) {
            BillingManager.PurchaseState.Success -> {
                Toast.makeText(context, "Подписка активирована", Toast.LENGTH_SHORT).show()
                delay(800)
                billingManager.resetPurchaseState()
            }
            is BillingManager.PurchaseState.Failed -> {
                Toast.makeText(context, state.reason, Toast.LENGTH_SHORT).show()
                delay(800)
                billingManager.resetPurchaseState()
            }
            else -> Unit
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(DeepSpaceBlack)
    ) {
        AnimatedMeshGradientBackground(
            modifier = Modifier.fillMaxSize()
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .wrapContentSize(Alignment.Center)
                .fillMaxWidth(0.92f)
                .widthIn(max = 540.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(34.dp)
                        .clip(CircleShape)
                        .background(Color.White.copy(alpha = 0.08f))
                        .bounceClick(onClick = onBackClick),
                    contentAlignment = Alignment.Center
                ) {
                    Text(text = "←", color = Color.White, fontSize = 17.sp)
                }

                Spacer(modifier = Modifier.size(8.dp))

                Text(
                    text = "MegaConvert Pro",
                    color = Color.White,
                    fontSize = 26.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }

            GlassCard(
                modifier = Modifier.fillMaxWidth(),
                cornerRadius = 22.dp
            ) {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text(
                        text = "Откройте максимум возможностей",
                        color = Color.White,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.SemiBold
                    )

                    FeatureItem("🚀 Загрузка файлов до 4 ГБ (с E2EE).")
                    FeatureItem("📢 Безлимитные каналы.")
                    FeatureItem("🏢 Приоритетная маршрутизация пакетов (Dedicated TURN-servers).")

                    Spacer(modifier = Modifier.height(4.dp))

                    if (verifiedCompany) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Text(
                                text = "$9.99/мес",
                                color = Color.White.copy(alpha = 0.45f),
                                textDecoration = TextDecoration.LineThrough,
                                fontSize = 15.sp
                            )
                            Text(
                                text = "$4.99/мес",
                                color = Color(0xFFFFD66B),
                                fontSize = 22.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "Corporate Discount",
                                color = ElectricCyan,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    } else {
                        Text(
                            text = "$9.99/мес",
                            color = Color.White,
                            fontSize = 22.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            NeonButton(
                text = when {
                    selectedPlan == null && connectionState == BillingManager.ConnectionState.CONNECTING ->
                        "Подключение к Google Play..."
                    selectedPlan == null -> "Загрузка тарифа..."
                    else -> "Оформить подписку"
                },
                enabled = selectedPlan != null && !isBillingBusy && activity != null,
                onClick = {
                    val plan = selectedPlan ?: return@NeonButton
                    val hostActivity = activity ?: return@NeonButton
                    billingManager.launchBillingFlow(hostActivity, plan)
                },
                modifier = Modifier.fillMaxWidth()
            )
        }

        if (isBillingBusy) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.42f)),
                contentAlignment = Alignment.Center
            ) {
                GlassContainer(
                    modifier = Modifier
                        .fillMaxWidth(0.78f)
                        .widthIn(max = 360.dp),
                    cornerRadius = 20.dp
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(22.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        CircularProgressIndicator(
                            color = ElectricCyan,
                            strokeWidth = 3.dp
                        )
                        Text(
                            text = "Генерация безопасного токена...",
                            color = Color.White,
                            fontSize = 14.sp
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun AnimatedMeshGradientBackground(
    modifier: Modifier = Modifier
) {
    val transition = rememberInfiniteTransition(label = "meshTransition")
    val phase by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 9000, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "meshPhase"
    )

    Canvas(modifier = modifier) {
        drawRect(
            brush = Brush.linearGradient(
                colors = listOf(
                    Color(0xFF04050A),
                    Color(0xFF061423),
                    Color(0xFF020307)
                )
            )
        )

        drawCircle(
            brush = Brush.radialGradient(
                colors = listOf(
                    ElectricCyan.copy(alpha = 0.20f),
                    Color.Transparent
                )
            ),
            radius = size.minDimension * 0.55f,
            center = androidx.compose.ui.geometry.Offset(
                x = size.width * (0.18f + 0.55f * phase),
                y = size.height * 0.24f
            )
        )

        drawCircle(
            brush = Brush.radialGradient(
                colors = listOf(
                    Color(0xFF4AA6FF).copy(alpha = 0.16f),
                    Color.Transparent
                )
            ),
            radius = size.minDimension * 0.62f,
            center = androidx.compose.ui.geometry.Offset(
                x = size.width * (0.90f - 0.62f * phase),
                y = size.height * 0.76f
            )
        )
    }
}

@Composable
private fun FeatureItem(text: String) {
    Text(
        text = text,
        color = Color.White.copy(alpha = 0.90f),
        fontSize = 15.sp
    )
}

private tailrec fun Context.findActivity(): Activity? {
    return when (this) {
        is Activity -> this
        is ContextWrapper -> baseContext.findActivity()
        else -> null
    }
}
