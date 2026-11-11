package com.goodspace.cocolounge

import android.Manifest
import android.os.Build
import android.os.Bundle
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.repeatOnLifecycle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith

class MainActivity : ComponentActivity() {
    private val vm: Lounge by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        Alerts.setup(this)
        // a fresh Activity (not a rotation or a restore) is a new session: "every launch" switches the theme now, a due schedule takes one step
        if (savedInstanceState == null) vm.themes.onLaunch() else vm.themes.configure()
        Connected.start(this)
        lifecycleScope.launch { runCatching { Updater.check(this@MainActivity) } }
        lifecycleScope.launch { repeatOnLifecycle(Lifecycle.State.STARTED) { while (true) { delay(60_000); vm.themes.tick() } } }
        if (intent.getBooleanExtra("install", false)) Updater.install(this, byPerson = true)
        if (Build.VERSION.SDK_INT >= 33) registerForActivityResult(ActivityResultContracts.RequestPermission()) {}.launch(Manifest.permission.POST_NOTIFICATIONS)
        setContent {
            LoungeTheme(vm.themes, vm.calm) { androidx.compose.runtime.CompositionLocalProvider(LocalCalm provides vm.calm) {
                AnimatedContent(vm.gate, transitionSpec = { fadeIn(tween(260, 80)) togetherWith fadeOut(tween(80)) }, label = "gate") { g ->
                    when (g) {
                        Lounge.Gate.SignIn -> SignIn(vm)
                        Lounge.Gate.Pair -> Pair(vm)
                        Lounge.Gate.Open -> LoungeApp(vm)
                    }
                }
            } }
        }
    }

    override fun onNewIntent(intent: android.content.Intent) { super.onNewIntent(intent); if (intent.getBooleanExtra("install", false)) Updater.install(this, byPerson = true) }

    override fun onResume() { super.onResume(); PhoneRemote.foreground = true; vm.onResume(); vm.themes.tick() }
    override fun onPause() { PhoneRemote.foreground = false; super.onPause() }
}
