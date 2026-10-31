package com.coco.launcher.theme

import android.app.WallpaperManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

enum class ThemeMode { System, Light, Dark }

// Neutral fallback for devices without system dynamic colour (below Android 12) or when the
// platform returns no palette. Cool slate, deliberately not branded and deliberately not yellow.
private val FallbackLight = lightColorScheme(
    primary = Color(0xFF4A5B8C),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFDCE1FF),
    onPrimaryContainer = Color(0xFF02164B),
    secondary = Color(0xFF5A5D72),
    surface = Color(0xFFFBF8FD),
    onSurface = Color(0xFF1B1B1F),
    surfaceVariant = Color(0xFFE2E1EC),
    onSurfaceVariant = Color(0xFF45464F),
    surfaceContainer = Color(0xFFEFEDF1),
    surfaceContainerHigh = Color(0xFFE9E7EC),
    outline = Color(0xFF767680),
)

private val FallbackDark = darkColorScheme(
    primary = Color(0xFFB4C5FF),
    onPrimary = Color(0xFF1A2C5E),
    primaryContainer = Color(0xFF324274),
    onPrimaryContainer = Color(0xFFDCE1FF),
    secondary = Color(0xFFC3C5DD),
    surface = Color(0xFF131316),
    onSurface = Color(0xFFE4E1E6),
    surfaceVariant = Color(0xFF45464F),
    onSurfaceVariant = Color(0xFFC6C5D0),
    surfaceContainer = Color(0xFF1F1F23),
    surfaceContainerHigh = Color(0xFF2A2A2E),
    outline = Color(0xFF90909A),
)

// The clock is the one piece of type that carries the home screen, so it gets its own scale.
val LauncherTypography = Typography().let { base ->
    base.copy(
        displayLarge = base.displayLarge.copy(
            fontSize = 72.sp, lineHeight = 76.sp, fontWeight = FontWeight.Normal, letterSpacing = (-2).sp,
        ),
        displayMedium = base.displayMedium.copy(fontSize = 40.sp, lineHeight = 44.sp),
    )
}

@Composable
fun CocoLauncherTheme(mode: ThemeMode, content: @Composable () -> Unit) {
    val context = LocalContext.current
    val dark = when (mode) {
        ThemeMode.System -> isSystemInDarkTheme()
        ThemeMode.Light -> false
        ThemeMode.Dark -> true
    }

    // The wallpaper can change while the launcher is the live home screen, and on Android 12+ the
    // system palette changes with it. Re-read the scheme instead of waiting for a process restart.
    var wallpaperGeneration by remember { mutableIntStateOf(0) }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
        DisposableEffect(Unit) {
            val manager = WallpaperManager.getInstance(context)
            val listener = WallpaperManager.OnColorsChangedListener { _, _ -> wallpaperGeneration++ }
            val registered = runCatching {
                manager.addOnColorsChangedListener(listener, Handler(Looper.getMainLooper()))
            }.isSuccess
            onDispose { if (registered) runCatching { manager.removeOnColorsChangedListener(listener) } }
        }
    }

    val scheme = remember(dark, wallpaperGeneration) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            runCatching {
                if (dark) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
            }.getOrElse { if (dark) FallbackDark else FallbackLight }
        } else {
            if (dark) FallbackDark else FallbackLight
        }
    }

    MaterialTheme(colorScheme = scheme, typography = LauncherTypography, content = content)
}

/** Shared corner radius for the search pill, sheets and widget frames. */
val PillRadius = 28.dp
