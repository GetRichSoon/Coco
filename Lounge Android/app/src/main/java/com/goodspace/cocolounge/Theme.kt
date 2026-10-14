package com.goodspace.cocolounge

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

/** Lounge Standard look: Coco Rose, Estate Gold accents, Pearl and Silk surfaces, Velvet Ink text. */
data class Lux(val gold: Color, val goldSoft: Color, val good: Color, val goodC: Color, val warn: Color, val warnC: Color, val bad: Color, val badC: Color)
val LocalLux = staticCompositionLocalOf { lightLux }
private val lightLux = Lux(Color(0xFFB48A33), Color(0xFFE7CF96), Color(0xFF2F6B40), Color(0xFFCDEED5), Color(0xFF7A5A00), Color(0xFFFFE6A3), Color(0xFF9C2B33), Color(0xFFFFDAD8))
private val darkLux = Lux(Color(0xFFE3C06C), Color(0xFF5E4A1F), Color(0xFFA9DCB6), Color(0xFF1F4A2B), Color(0xFFF3CD5F), Color(0xFF5A4300), Color(0xFFFFB3AE), Color(0xFF6F1D23))

private val Light = lightColorScheme(
    primary = Color(0xFF7B4F6B), onPrimary = Color.White, primaryContainer = Color(0xFFFFD8EE), onPrimaryContainer = Color(0xFF30092A),
    secondaryContainer = Color(0xFFDCEBD2), onSecondaryContainer = Color(0xFF1A3016), tertiary = Color(0xFF9A5A3C), tertiaryContainer = Color(0xFFFFDBCD),
    background = Color(0xFFFDF7F4), surface = Color(0xFFFDF7F4), surfaceContainerLow = Color(0xFFF7EEEE), surfaceContainer = Color(0xFFF0E4E6),
    surfaceContainerHigh = Color(0xFFE9DADD), onSurface = Color(0xFF22191D), onSurfaceVariant = Color(0xFF6E5E64), outline = Color(0xFFD6C2C8),
)
private val Dark = darkColorScheme(
    primary = Color(0xFFF1B6D8), onPrimary = Color(0xFF4A1C3F), primaryContainer = Color(0xFF633856), onPrimaryContainer = Color(0xFFFFD8EE),
    secondaryContainer = Color(0xFF34482D), onSecondaryContainer = Color(0xFFD6ECC9), tertiary = Color(0xFFFFB898), tertiaryContainer = Color(0xFF6E3B26),
    background = Color(0xFF141018), surface = Color(0xFF141018), surfaceContainerLow = Color(0xFF1E1822), surfaceContainer = Color(0xFF28202C),
    surfaceContainerHigh = Color(0xFF332939), onSurface = Color(0xFFF2E6EA), onSurfaceVariant = Color(0xFFCBBAC4), outline = Color(0xFF4F4250),
)

private fun fraunces(w: Int) = Font(R.font.fraunces, FontWeight(w), variationSettings = FontVariation.Settings(FontVariation.weight(w), FontVariation.Setting("SOFT", 100f)))
private fun nunito(w: Int) = Font(R.font.nunito, FontWeight(w), variationSettings = FontVariation.Settings(FontVariation.weight(w)))
val Display = FontFamily(fraunces(600), fraunces(700))
val Body = FontFamily(nunito(500), nunito(700), nunito(800))

private val Type = Typography(
    displaySmall = TextStyle(fontFamily = Display, fontWeight = FontWeight(700), fontSize = 32.sp, lineHeight = 36.sp),
    headlineSmall = TextStyle(fontFamily = Display, fontWeight = FontWeight(650), fontSize = 24.sp, lineHeight = 30.sp),
    titleLarge = TextStyle(fontFamily = Display, fontWeight = FontWeight(650), fontSize = 20.sp, lineHeight = 26.sp),
    titleMedium = TextStyle(fontFamily = Body, fontWeight = FontWeight(800), fontSize = 16.sp, lineHeight = 22.sp),
    bodyLarge = TextStyle(fontFamily = Body, fontWeight = FontWeight(500), fontSize = 16.sp, lineHeight = 24.sp),
    bodyMedium = TextStyle(fontFamily = Body, fontWeight = FontWeight(500), fontSize = 14.sp, lineHeight = 20.sp),
    labelLarge = TextStyle(fontFamily = Body, fontWeight = FontWeight(800), fontSize = 14.sp),
    labelMedium = TextStyle(fontFamily = Body, fontWeight = FontWeight(800), fontSize = 12.sp, letterSpacing = 1.4.sp),
    labelSmall = TextStyle(fontFamily = Body, fontWeight = FontWeight(700), fontSize = 11.sp),
)

@Composable
fun LoungeTheme(mode: String = "system", content: @Composable () -> Unit) {
    val dark = when (mode) { "dark" -> true; "light" -> false; else -> isSystemInDarkTheme() }
    androidx.compose.runtime.CompositionLocalProvider(LocalLux provides if (dark) darkLux else lightLux) {
        MaterialTheme(colorScheme = if (dark) Dark else Light, typography = Type, content = content)
    }
}
