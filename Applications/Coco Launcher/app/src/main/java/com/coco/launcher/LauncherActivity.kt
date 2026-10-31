package com.coco.launcher

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.graphics.Color
import androidx.core.view.WindowCompat
import androidx.lifecycle.lifecycleScope
import com.coco.launcher.apps.AppRepository
import com.coco.launcher.home.HomeScreen
import com.coco.launcher.storage.Prefs
import com.coco.launcher.storage.Settings
import com.coco.launcher.theme.CocoLauncherTheme
import com.coco.launcher.widgets.WidgetController
import kotlinx.coroutines.flow.MutableSharedFlow

/**
 * The home screen. One activity, singleTask, so pressing home re-delivers the intent instead of
 * stacking copies - that re-delivery is the signal to close the drawer and return to the page.
 */
class LauncherActivity : ComponentActivity() {

    private lateinit var widgets: WidgetController
    private val homeReset = MutableSharedFlow<Unit>(extraBufferCapacity = 1)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        WindowCompat.setDecorFitsSystemWindows(window, false)

        widgets = WidgetController(this)
        AppRepository.start(applicationContext, lifecycleScope)

        val settingsFlow = Prefs.flow(this)
        setContent {
            val settings by settingsFlow.collectAsState(initial = Settings())
            CocoLauncherTheme(mode = settings.themeMode) {
                HomeScreen(widgets = widgets, homeReset = homeReset)
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        homeReset.tryEmit(Unit)
    }

    override fun onStart() {
        super.onStart()
        widgets.startListening()
        // An app can be installed or removed while the launcher is stopped.
        AppRepository.start(applicationContext, lifecycleScope)
    }

    override fun onStop() {
        widgets.stopListening()
        super.onStop()
    }

    override fun onDestroy() {
        if (isFinishing) AppRepository.stop()
        super.onDestroy()
    }

    @Deprecated("The widget configure screen reports through the classic result path.")
    @Suppress("DEPRECATION")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        widgets.onActivityResult(requestCode, resultCode, data)
    }
}
