plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// The web app one folder up is the only copy of the app. Sync it into the APK's assets at
// build time so the phone and the desktop page can never drift apart.
val webAssets = layout.buildDirectory.dir("web-assets")
val syncWeb = tasks.register<Sync>("syncWeb") {
    from(rootProject.projectDir.parentFile) {
        include("index.html", "mantras.js", "manifest.json", "icon.svg", "images/**", "theme/**")
    }
    into(webAssets)
}

android {
    namespace = "com.goodspace.mantraghar"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.goodspace.mantraghar"
        minSdk = 29
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
    }
    sourceSets["main"].assets.srcDir(webAssets)
    buildTypes {
        release {
            isMinifyEnabled = false
            // Private app for the founders' phones: signed with the local debug key, not for a store.
            signingConfig = signingConfigs.getByName("debug")
        }
    }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
    lint { abortOnError = false }
}

tasks.named("preBuild") { dependsOn(syncWeb) }
