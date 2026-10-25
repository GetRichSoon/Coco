package com.goodspace.cocolounge.island.ui

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.platform.LocalContext

/** Coco's own two accents. Material You colours (Android 12+) take over where the system provides them. */
object Brand {
    val Cyan = Color(0xFF4FE3F2)
    val Violet = Color(0xFF8E6BFF)
    val Ink = Color(0xFF05060A)
    val Good = Color(0xFF34D399)
    val Bad = Color(0xFFFF5D6C)
}

private val FallbackDark = darkColorScheme(primary = Brand.Cyan, secondary = Brand.Violet, tertiary = Brand.Violet, background = Brand.Ink, surface = Color(0xFF0E1018))
private val FallbackLight = lightColorScheme(primary = Color(0xFF006874), secondary = Color(0xFF5B3FD0), tertiary = Color(0xFF5B3FD0))

/** Colours of the island itself. Material You: a dark tonal surface tinted from the wallpaper. Classic: the all-black pill. */
@Immutable
data class IslandColors(
    val container: Color,
    val content: Color,
    val chip: Color,
    val chipContent: Color,
    val accent: Color,
    val onAccent: Color,
    val timer: Color,
    val edgeA: Color,
    val edgeB: Color,
)

val LocalIsland = staticCompositionLocalOf {
    IslandColors(Color.Black, Color.White, Color(0xFF1B1E2B), Color.White, Brand.Cyan, Color.Black, Color(0xFFFF9F0A), Brand.Cyan, Brand.Violet)
}

@Composable
fun islandColors(materialYou: Boolean): IslandColors {
    val s = MaterialTheme.colorScheme
    return if (materialYou) IslandColors(
        container = lerp(Color.Black, s.primaryContainer, 0.34f),
        content = s.onSurface,
        chip = s.secondaryContainer,
        chipContent = s.onSecondaryContainer,
        accent = s.primary,
        onAccent = s.onPrimary,
        timer = s.tertiary,
        edgeA = s.primary,
        edgeB = s.tertiary,
    ) else IslandColors(Color.Black, Color.White, Color(0xFF2C2C2E), Color.White, Color(0xFF0A84FF), Color.White, Color(0xFFFF9F0A), Color.Black, Color.Black)
}

@Composable
fun IslandTheme(dark: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
    val context = LocalContext.current
    val scheme = when {
        Build.VERSION.SDK_INT >= 31 -> if (dark) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        dark -> FallbackDark
        else -> FallbackLight
    }
    MaterialTheme(colorScheme = scheme, content = content)
}
