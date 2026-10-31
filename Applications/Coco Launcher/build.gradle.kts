// Versions are the combination already proven to build on this machine (Coco Lounge, 2026-10-29):
// Gradle 8.12 + AGP 8.9.1 + Kotlin 2.1.0. Changing one of the three means re-checking all three.
plugins {
    id("com.android.application") version "8.9.1" apply false
    id("org.jetbrains.kotlin.android") version "2.1.0" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.1.0" apply false
}
