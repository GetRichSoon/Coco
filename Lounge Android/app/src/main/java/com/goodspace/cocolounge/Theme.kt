@file:OptIn(androidx.compose.ui.text.ExperimentalTextApi::class)

package com.goodspace.cocolounge

import android.app.Activity
import android.content.Context
import android.provider.Settings
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Surface
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.view.WindowCompat

/**
 * The identity colours of the Bonbon Club: the marks of the Houses and the club members (Brand.kt). They are identity, not theme: they stay
 * the same in every COCO theme. Everything else in the app takes its colours from the active theme's roles (see CocoRoles below).
 */
object Mu {
    val cream = Color(0xFFFFF4E6); val paper = Color(0xFFFBF8EB); val ink = Color(0xFF2B1712); val cocoa = Color(0xFF5A2E1E)
    val tomato = Color(0xFFF24E1E); val tomatoDeep = Color(0xFFB83A12); val bubblegum = Color(0xFFFFC2E2); val cherry = Color(0xFFC21D5F)
    val sky = Color(0xFFA9DCFF); val cobalt = Color(0xFF2F55C4); val plum = Color(0xFF4A1430); val wine = Color(0xFF7A1838)
    val forest = Color(0xFF1F5A3A); val butter = Color(0xFFFFE79A); val marigold = Color(0xFFEAB04A)
}

// ---------------------------------------------------------------- the roles of the active theme
/**
 * Every colour role of one theme in one mode and one scope, straight from Lounge/contract/theme-schemes.json (58 roles). The Material
 * ColorScheme is derived from them; the extras Material has no slot for (link, success, warning, card and field surfaces, the CTA edge,
 * the chart colours) are read from here: `LocalCocoRoles.current.link`.
 */
@Immutable
data class CocoRoles(val map: Map<String, Color>) {
    operator fun get(k: String): Color = map.getValue(k)
    val accent get() = this["accent"]; val onAccent get() = this["onAccent"]
    /** The accessible TEXT colour of the accent family: use it for links, text buttons and selected labels, never `primary`. */
    val link get() = this["link"]
    val success get() = this["success"]; val onSuccess get() = this["onSuccess"]; val successContainer get() = this["successContainer"]; val onSuccessContainer get() = this["onSuccessContainer"]
    val warning get() = this["warning"]; val onWarning get() = this["onWarning"]; val warningContainer get() = this["warningContainer"]; val onWarningContainer get() = this["onWarningContainer"]
    val cardSurface get() = this["cardSurface"]; val fieldSurface get() = this["fieldSurface"]; val fieldSurface2 get() = this["fieldSurface2"]
    val ctaEdge get() = this["ctaEdge"]
    val chart1 get() = this["chart1"]; val chart2 get() = this["chart2"]; val chart3 get() = this["chart3"]
    val selected get() = this["selected"]; val onSelected get() = this["onSelected"]
    val cta get() = this["cta"]; val onCta get() = this["onCta"]
    val highlight get() = this["highlight"]; val onHighlight get() = this["onHighlight"]

    /**
     * Role -> Material slot. primary = the call to action (so a default Button is the vivid CTA: yellow in Signature, the seed colour in the
     * others); primaryContainer = the selected state (pink in Signature); tertiary = the highlight. Everything else is the same-named role.
     */
    fun toColorScheme(): ColorScheme = lightColorScheme(
        primary = cta, onPrimary = onCta, primaryContainer = selected, onPrimaryContainer = onSelected, inversePrimary = this["inversePrimary"],
        secondary = this["secondary"], onSecondary = this["onSecondary"], secondaryContainer = this["secondaryContainer"], onSecondaryContainer = this["onSecondaryContainer"],
        tertiary = highlight, onTertiary = onHighlight, tertiaryContainer = this["tertiaryContainer"], onTertiaryContainer = this["onTertiaryContainer"],
        background = this["background"], onBackground = this["onBackground"], surface = this["surface"], onSurface = this["onSurface"],
        surfaceVariant = this["surfaceVariant"], onSurfaceVariant = this["onSurfaceVariant"],
        surfaceTint = Color.Transparent,   // no tonal wash over a panel: its colour is exactly the role
        inverseSurface = this["inverseSurface"], inverseOnSurface = this["inverseOnSurface"],
        error = this["error"], onError = this["onError"], errorContainer = this["errorContainer"], onErrorContainer = this["onErrorContainer"],
        outline = this["outline"], outlineVariant = this["outlineVariant"], scrim = this["scrim"],
        surfaceBright = this["surfaceContainerHighest"], surfaceDim = this["surfaceContainerLowest"],
        surfaceContainerLowest = this["surfaceContainerLowest"], surfaceContainerLow = this["surfaceContainerLow"], surfaceContainer = this["surfaceContainer"],
        surfaceContainerHigh = this["surfaceContainerHigh"], surfaceContainerHighest = this["surfaceContainerHighest"],
    )
}

/** One theme in one mode: the roles of the page (background, plain content) and of the panels (cards, navigation, sheets, dialogs). */
@Immutable
data class CocoScheme(val themeId: String, val dark: Boolean, val pageRoles: CocoRoles, val panelRoles: CocoRoles) {
    val page: ColorScheme by lazy(LazyThreadSafetyMode.NONE) { pageRoles.toColorScheme() }
    val panel: ColorScheme by lazy(LazyThreadSafetyMode.NONE) { panelRoles.toColorScheme() }
}

private fun Roles.toColors() = CocoRoles(mapValues { (_, v) -> Color(v) })
fun ThemeContract.cocoScheme(themeId: String, dark: Boolean): CocoScheme =
    scheme(themeId, dark).let { CocoScheme(if (themeId in ids) themeId else ids.first(), dark, it.page.toColors(), it.panel.toColors()) }

private fun lerpRoles(a: CocoRoles, b: CocoRoles, t: Float) = CocoRoles(b.map.mapValues { (k, v) -> lerp(a.map[k] ?: v, v, t) })
private fun lerpScheme(a: CocoScheme, b: CocoScheme, t: Float) = CocoScheme(b.themeId, b.dark, lerpRoles(a.pageRoles, b.pageRoles, t), lerpRoles(a.panelRoles, b.panelRoles, t))

val LocalCocoTheme = compositionLocalOf<CocoScheme> { error("LoungeTheme is not set up") }
val LocalCocoRoles = compositionLocalOf<CocoRoles> { error("LoungeTheme is not set up") }

// ---------------------------------------------------------------- type: Space Grotesk everywhere
private fun sg(w: Int) = Font(R.font.space_grotesk, FontWeight(w), variationSettings = FontVariation.Settings(FontVariation.weight(w)))
val SpaceGrotesk = FontFamily(sg(300), sg(400), sg(500), sg(600), sg(700))

private fun style(size: Int, line: Int, weight: Int, spacing: Double = 0.0) =
    TextStyle(fontFamily = SpaceGrotesk, fontWeight = FontWeight(weight), fontSize = size.sp, lineHeight = line.sp, letterSpacing = spacing.sp)

private val CocoTypography = Typography(
    displayLarge = style(57, 64, 700, -0.25), displayMedium = style(45, 52, 700), displaySmall = style(34, 40, 700, -0.2),
    headlineLarge = style(32, 40, 700), headlineMedium = style(28, 34, 700), headlineSmall = style(24, 30, 600),
    titleLarge = style(20, 26, 600), titleMedium = style(16, 22, 600), titleSmall = style(14, 20, 600),
    bodyLarge = style(16, 24, 400), bodyMedium = style(14, 20, 400), bodySmall = style(12, 16, 400),
    labelLarge = style(14, 20, 600), labelMedium = style(12, 16, 600, 1.0), labelSmall = style(12, 16, 500),
)

/** Cards, sheets and dialogs sit on a 16 dp radius (28 for sheets). */
private val CocoShapes = Shapes(
    extraSmall = RoundedCornerShape(8.dp), small = RoundedCornerShape(12.dp), medium = RoundedCornerShape(16.dp),
    large = RoundedCornerShape(16.dp), extraLarge = RoundedCornerShape(28.dp),
)

// ---------------------------------------------------------------- the theme
/** "Remove animations" in the system settings (animator duration scale 0) turns every theme change into a plain cut. */
fun reducedMotion(ctx: Context): Boolean = runCatching { Settings.Global.getFloat(ctx.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f }.getOrDefault(false)

/**
 * The whole app wears ONE active COCO theme. A change eases from the old colours to the new ones on a spring (a cross-fade of every role),
 * or cuts at once under reduced motion. The page scheme is the root MaterialTheme; CocoPanel re-themes cards, bars, sheets and dialogs with
 * the panel scheme (for Signature in light mode the page is lavender and the panels are black).
 */
@Composable
fun LoungeTheme(themes: ThemeController, calm: Boolean, content: @Composable () -> Unit) {
    val ctx = LocalContext.current
    val dark = themes.engine.resolveDark(themes.prefs.appearance, isSystemInDarkTheme())
    val target = remember(themes.effectiveThemeId, dark) { themes.contract.cocoScheme(themes.effectiveThemeId, dark) }
    val shown = animateCocoScheme(target, calm || reducedMotion(ctx))

    val view = LocalView.current
    if (!view.isInEditMode) SideEffect {
        val window = (view.context as? Activity)?.window ?: return@SideEffect
        WindowCompat.getInsetsController(window, view).apply {
            isAppearanceLightStatusBars = shown.panel.surface.luminance() > 0.5f          // the top bar is a panel
            isAppearanceLightNavigationBars = shown.page.background.luminance() > 0.5f    // the gesture area shows the page
        }
    }
    CompositionLocalProvider(LocalCocoTheme provides shown, LocalCocoRoles provides shown.pageRoles) {
        MaterialTheme(colorScheme = shown.page, typography = CocoTypography, shapes = CocoShapes) {
            Surface(Modifier.fillMaxSize(), color = shown.page.background, contentColor = shown.page.onBackground) { content() }
        }
    }
}

@Composable
private fun animateCocoScheme(target: CocoScheme, snap: Boolean): CocoScheme {
    val progress = remember { Animatable(1f) }
    var from by remember { mutableStateOf(target) }
    var to by remember { mutableStateOf(target) }
    LaunchedEffect(target, snap) {
        if (target == to) return@LaunchedEffect
        if (snap) { from = target; to = target; progress.snapTo(1f); return@LaunchedEffect }
        // start from what is on screen right now, even in the middle of an earlier change; each step keeps the picture unchanged
        val now = if (progress.value >= 1f) to else lerpScheme(from, to, progress.value)
        from = now; to = now
        progress.snapTo(0f)
        to = target
        progress.animateTo(1f, spring(dampingRatio = Spring.DampingRatioNoBouncy, stiffness = 300f))   // settles in about half a second: the whole screen repaints every frame until then
    }
    return if (progress.value >= 1f) to else lerpScheme(from, to, progress.value)
}

/** Re-themes its content with the PANEL roles: use it for every card, the navigation bar, the top bar, sheets, dialogs and menus. */
@Composable
fun CocoPanel(content: @Composable () -> Unit) {
    val t = LocalCocoTheme.current
    val cs = t.panel
    CompositionLocalProvider(LocalCocoRoles provides t.panelRoles, LocalContentColor provides cs.onSurface) {
        MaterialTheme(colorScheme = cs, typography = MaterialTheme.typography, shapes = MaterialTheme.shapes, content = content)
    }
}
