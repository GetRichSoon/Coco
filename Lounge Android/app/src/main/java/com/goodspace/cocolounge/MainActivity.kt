package com.goodspace.cocolounge

import android.Manifest
import android.os.Build
import android.os.Bundle
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
        if (Build.VERSION.SDK_INT >= 33) registerForActivityResult(ActivityResultContracts.RequestPermission()) {}.launch(Manifest.permission.POST_NOTIFICATIONS)
        setContent {
            LoungeTheme(vm.theme) { androidx.compose.runtime.CompositionLocalProvider(LocalCalm provides vm.calm) {
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

    override fun onResume() { super.onResume(); vm.onResume() }
}
