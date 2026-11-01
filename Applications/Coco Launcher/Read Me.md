# Coco Launcher

A Pixel-style Android home screen. Kotlin, Jetpack Compose, Material 3, no account, no network.

- Application ID: `com.coco.launcher`
- Minimum Android 8.0 (API 26), built against API 35
- Built and tested on: Pixel 6 emulator (Android 16) and Boss's OnePlus IV2201 (Android 13)

## What is in the box

| Path | What it is |
|---|---|
| `build-output/coco-launcher-debug.apk` | Debug build, installable on any device |
| `build-output/coco-launcher-release.apk` | Signed, R8-minified release (1.3 MB) |
| `build-output/coco-launcher.aab` | App bundle, for a Play upload later |
| `build-output/screenshots/` | Screens captured from the two real devices |
| `build-output/lint-report.html` | Android lint report |

## Build it again

```
cd "Coco Launcher"
./gradlew :app:assembleDebug            # debug APK
./gradlew :app:testDebugUnitTest        # unit tests
./gradlew :app:lintDebug                # lint
./gradlew :app:assembleRelease :app:bundleRelease   # signed release + AAB
```

The release key is **not** in this folder. It lives in
`Good Space\Coco Vault\Coco Keys\Coco Launcher\` together with `key.properties`. Load those four
values into the environment before a release build:

```
set -a; . "/c/Users/Lenovo/Good Space/Coco Vault/Coco Keys/Coco Launcher/key.properties"; set +a
```

Without the key the release task still runs but produces an unsigned artifact. It never falls back
to the debug key, because a debug-signed APK looks publishable and is then refused by every phone
that already has the real one.

## Install and make it the home app

```
adb install -r "build-output/coco-launcher-release.apk"
adb shell cmd package set-home-activity com.coco.launcher/com.coco.launcher.LauncherActivity
```

Or on the phone: Settings - Apps - Default apps - Home app - Coco Launcher.

## How it is put together

```
app/src/main/java/com/coco/launcher/
  LauncherActivity.kt      one singleTask HOME activity
  apps/                    LauncherApps list, icon cache, app launching
  home/                    clock, At a Glance, grid, dock, search pill, tiles
  drawer/                  full-screen app drawer, search, fast scroller
  widgets/                 AppWidgetHost, picker, live widget frames
  gestures/                one touch loop: tap, long press, pick up, swipe
  settings/                Home, Appearance, Gestures, App drawer, About
  storage/                 DataStore settings and saved layout
  theme/                   dynamic colour with a neutral fallback
```

Decisions worth knowing:

- **No account, no sign-in, no onboarding.** The launcher opens straight to the home screen.
- **No network at all.** That is why At a Glance shows the date and the next alarm but no weather.
- **One permission**, `READ_CALENDAR`, and it is only requested if you switch on "Next event" in
  Home settings. Nothing is asked for on first launch.
- **Real AppWidget framework**: allocate, bind, configure, place, resize, remove. Not fake cards.
- **Dynamic colour** comes from the system wallpaper palette on Android 12+, and falls back to a
  neutral Material 3 palette below that.
- The launcher does not list itself in its own app drawer, the same as the stock Pixel launcher.
  Its icon is visible in Settings - Apps.

## Known limits

- One home page. No multiple pages, no folders, no icon packs.
- Swipe down opens app search instead of the notification shade.
- Search covers installed apps only - there is no web search, because there is no network.
- Widgets are moved and resized in whole grid cells.
