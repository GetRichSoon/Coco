@file:OptIn(androidx.compose.ui.text.ExperimentalTextApi::class)

package com.goodspace.cocolounge

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import androidx.compose.ui.unit.dp

/** Good Space house theme: Material You Design Theme v1 (founder default since 14 Oct 2026). */
object Mu {
    val cream = Color(0xFFFFF4E6); val paper = Color(0xFFFBF8EB); val ink = Color(0xFF2B1712); val cocoa = Color(0xFF5A2E1E)
    val tomato = Color(0xFFF24E1E); val tomatoDeep = Color(0xFFB83A12); val bubblegum = Color(0xFFFFC2E2); val cherry = Color(0xFFC21D5F)
    val sky = Color(0xFFA9DCFF); val cobalt = Color(0xFF2F55C4); val plum = Color(0xFF4A1430); val wine = Color(0xFF7A1838)
    val forest = Color(0xFF1F5A3A); val butter = Color(0xFFFFE79A); val marigold = Color(0xFFEAB04A)
}

data class Lux(val good: Color, val goodC: Color, val warn: Color, val warnC: Color, val bad: Color, val badC: Color, val gold: Color)
val LocalLux = staticCompositionLocalOf { lightLux }
private val lightLux = Lux(Color(0xFF1F5A3A), Color(0xFFD4EDD9), Color(0xFF7A5200), Color(0xFFFFE79A), Color(0xFFBA1A1A), Color(0xFFFFDAD6), Color(0xFFB83A12))
private val darkLux = Lux(Color(0xFFA6D9B4), Color(0xFF1F5A3A), Color(0xFFFFE79A), Color(0xFF5C4300), Color(0xFFFFB4AB), Color(0xFF93000A), Color(0xFFFFA383))

private val Light = lightColorScheme(
    primary = Color(0xFFB83A12), onPrimary = Color(0xFFFFF4E6), primaryContainer = Color(0xFFFFD9C8), onPrimaryContainer = Color(0xFF3D1000),
    secondary = Color(0xFFA3245A), onSecondary = Color(0xFFFFF4E6), secondaryContainer = Color(0xFFFFD8E8), onSecondaryContainer = Color(0xFF3E0020),
    tertiary = Color(0xFF2F55C4), onTertiary = Color(0xFFFFF4E6), tertiaryContainer = Color(0xFFD3E7FF), onTertiaryContainer = Color(0xFF001A40),
    error = Color(0xFFBA1A1A), errorContainer = Color(0xFFFFDAD6), onErrorContainer = Color(0xFF410002),
    background = Color(0xFFFFF4E6), onBackground = Color(0xFF2B1712), surface = Color(0xFFFFF4E6), onSurface = Color(0xFF2B1712),
    surfaceVariant = Color(0xFFF3DED0), onSurfaceVariant = Color(0xFF5A4136), surfaceContainerLowest = Color(0xFFFFFBF6),
    surfaceContainerLow = Color(0xFFFFEFDF), surfaceContainer = Color(0xFFFBE8D6), surfaceContainerHigh = Color(0xFFF5E1CE),
    surfaceContainerHighest = Color(0xFFEFDAC6), outline = Color(0xFF8C7164), outlineVariant = Color(0xFFDFC3B5),
)
private val Dark = darkColorScheme(
    primary = Color(0xFFFFA383), onPrimary = Color(0xFF5A1A00), primaryContainer = Color(0xFF8A2A08), onPrimaryContainer = Color(0xFFFFDBCF),
    secondary = Color(0xFFFFB0CF), onSecondary = Color(0xFF5E1133), secondaryContainer = Color(0xFF7E2A4C), onSecondaryContainer = Color(0xFFFFD8E8),
    tertiary = Color(0xFFA9C8FF), onTertiary = Color(0xFF002F65), tertiaryContainer = Color(0xFF22468F), onTertiaryContainer = Color(0xFFD7E3FF),
    error = Color(0xFFFFB4AB), errorContainer = Color(0xFF93000A), onErrorContainer = Color(0xFFFFDAD6),
    background = Color(0xFF1E0F14), onBackground = Color(0xFFF6E3DA), surface = Color(0xFF1E0F14), onSurface = Color(0xFFF6E3DA),
    surfaceVariant = Color(0xFF54363F), onSurfaceVariant = Color(0xFFDCC0C8), surfaceContainerLowest = Color(0xFF170A0F),
    surfaceContainerLow = Color(0xFF26141A), surfaceContainer = Color(0xFF2C181F), surfaceContainerHigh = Color(0xFF37222A),
    surfaceContainerHighest = Color(0xFF432C34), outline = Color(0xFFA68A93), outlineVariant = Color(0xFF54363F),
)

private fun fraunces(w: Int) = Font(R.font.fraunces, FontWeight(w), variationSettings = FontVariation.Settings(FontVariation.weight(w), FontVariation.Setting("SOFT", 100f), FontVariation.Setting("WONK", 1f), FontVariation.Setting("opsz", 30f)))
private fun figtree(w: Int) = Font(R.font.figtree, FontWeight(w), variationSettings = FontVariation.Settings(FontVariation.weight(w)))
val Display = FontFamily(fraunces(700), fraunces(800), fraunces(900))
val Body = FontFamily(figtree(400), figtree(600), figtree(800))
val Fun = FontFamily(Font(R.font.bagel))

private val Type = Typography(
    displaySmall = TextStyle(fontFamily = Display, fontWeight = FontWeight(900), fontSize = 34.sp, lineHeight = 38.sp),
    headlineMedium = TextStyle(fontFamily = Display, fontWeight = FontWeight(900), fontSize = 28.sp, lineHeight = 32.sp),
    headlineSmall = TextStyle(fontFamily = Display, fontWeight = FontWeight(800), fontSize = 24.sp, lineHeight = 28.sp),
    titleLarge = TextStyle(fontFamily = Display, fontWeight = FontWeight(800), fontSize = 20.sp, lineHeight = 24.sp),
    titleMedium = TextStyle(fontFamily = Body, fontWeight = FontWeight(800), fontSize = 16.sp, lineHeight = 22.sp),
    bodyLarge = TextStyle(fontFamily = Body, fontWeight = FontWeight(400), fontSize = 16.sp, lineHeight = 24.sp),
    bodyMedium = TextStyle(fontFamily = Body, fontWeight = FontWeight(400), fontSize = 14.sp, lineHeight = 20.sp),
    labelLarge = TextStyle(fontFamily = Body, fontWeight = FontWeight(800), fontSize = 14.sp),
    labelMedium = TextStyle(fontFamily = Body, fontWeight = FontWeight(800), fontSize = 12.sp, letterSpacing = 1.2.sp),
    labelSmall = TextStyle(fontFamily = Body, fontWeight = FontWeight(600), fontSize = 12.sp),
)

/** Expressive shape scale: generous corners everywhere (cards 24, sheets and dialogs 32). */
private val MuShapeScale = androidx.compose.material3.Shapes(
    extraSmall = androidx.compose.foundation.shape.RoundedCornerShape(8.dp), small = androidx.compose.foundation.shape.RoundedCornerShape(12.dp),
    medium = androidx.compose.foundation.shape.RoundedCornerShape(16.dp), large = androidx.compose.foundation.shape.RoundedCornerShape(24.dp),
    extraLarge = androidx.compose.foundation.shape.RoundedCornerShape(32.dp),
)

@Composable
fun LoungeTheme(mode: String = "system", wallpaper: Boolean = false, content: @Composable () -> Unit) {
    val dark = when (mode) { "dark" -> true; "light" -> false; else -> isSystemInDarkTheme() }
    val ctx = androidx.compose.ui.platform.LocalContext.current
    val scheme = when {
        wallpaper && android.os.Build.VERSION.SDK_INT >= 31 -> if (dark) androidx.compose.material3.dynamicDarkColorScheme(ctx) else androidx.compose.material3.dynamicLightColorScheme(ctx)
        dark -> Dark
        else -> Light
    }
    CompositionLocalProvider(LocalLux provides if (dark) darkLux else lightLux) {
        MaterialTheme(colorScheme = scheme, typography = Type, shapes = MuShapeScale, content = content)
    }
}
