package com.coco.launcher.settings

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.material3.Surface
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.foundation.layout.fillMaxSize
import com.coco.launcher.storage.Prefs
import com.coco.launcher.storage.Settings
import com.coco.launcher.theme.CocoLauncherTheme

/**
 * The same settings, reachable as an ordinary app. The home screen itself is deliberately absent
 * from the app drawer, the way a stock launcher is, so without this entry there would be nothing
 * in the app list to tap and no way to find the settings except by long-pressing the wallpaper.
 */
class SettingsActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val settingsFlow = Prefs.flow(this)
        setContent {
            val settings by settingsFlow.collectAsState(initial = Settings())
            CocoLauncherTheme(mode = settings.themeMode) {
                Surface(modifier = Modifier.fillMaxSize()) {
                    SettingsScreen(settings = settings, onClose = { finish() })
                }
            }
        }
    }
}
