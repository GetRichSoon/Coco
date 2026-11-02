plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "com.goodspace.cocolounge"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.goodspace.cocolounge"
        minSdk = 29
        targetSdk = 35
        versionCode = 19
        versionName = "2.9.2"
    }
    // The release key (Boss, 2026-10-29). It lives in Coco Vault on the laptop and in GitHub as
    // ANDROID_KEYSTORE_BASE64, so the cloud can sign a release with every PC switched off. Without the
    // key the release task fails on a missing storeFile; it deliberately does not fall back to the debug
    // key, because a debug-signed APK looks publishable, uploads happily, and is then refused by every
    // phone that has the real one. Debug builds and unit tests are unaffected and still need no key.
    signingConfigs {
        create("release") {
            val ks = System.getenv("ANDROID_KEYSTORE_PATH")
            if (ks != null) {
                storeFile = file(ks)
                storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("ANDROID_KEY_ALIAS") ?: "coco"
                keyPassword = System.getenv("ANDROID_KEY_PASSWORD") ?: System.getenv("ANDROID_KEYSTORE_PASSWORD")
            }
        }
    }
    buildTypes {
        release {
            // R8: smaller APK (faster self-update) and faster, smoother Compose (2026-10-25, measured on the Nord CE 2).
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            // Private app for the founders two phones, never uploaded to a store, but signed with a real
            // key so the cloud can publish it. Up to 2.8.2 this was the laptops debug key, which is why
            // moving to the cloud costs both phones one uninstall and reinstall.
            signingConfig = signingConfigs.getByName("release")
        }
    }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { compose = true }
    lint { abortOnError = false }
    testOptions { unitTests.isReturnDefaultValues = true }
}

dependencies {
    implementation(platform("androidx.compose:compose-bom:2024.12.01"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.work:work-runtime-ktx:2.10.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    testImplementation("junit:junit:4.13.2")
    // the real org.json for unit tests (the Android stub returns empty values)
    testImplementation("org.json:json:20240303")
}
