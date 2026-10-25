# Island and Coco HQ research (2026-10-25)

Why: Boss asked for the island "like iPhone and more", inside the Coco app (one app, not two), a Material You
redesign, and a live dashboard where the team works and Coco coordinates. This page keeps what was found, so every
session builds on it.

## Phone island: what the best ones do
| Who | What it has | What we take |
|---|---|---|
| iPhone Dynamic Island (iOS 26) | music, timer, calls, Maps, rides, sports, charging, silent switch, AirPods ring, new low battery alert; Live Activities also on CarPlay, iPad and Mac | all of these that Android lets an app read |
| Android 16 Live Updates | ongoing ProgressStyle / CallStyle notifications are promoted to a status bar chip with a short text ("shortCriticalText") | the island reads the same short text and progress, so ride, delivery and download apps work without extra code |
| OnePlus Live Alerts (OxygenOS 15) | a smooth pill for timers, rides, recording, charging | the Nord CE 2 stops at Android 13 and never gets it: Coco Island fills that gap |
| Samsung Now Bar (One UI 7/8) | lock screen pill: media, timers, Maps, voice recorder, sports, Do Not Disturb | recorder and stopwatch style timers become a red or orange time pill |

Not possible for a normal app (honest): hiding notification icons, drawing over the lock screen, Face ID style
moments, reading another app's private screen. Screen recording shows only through its own notification.

## PC island: what the best ones do
| App | Features |
|---|---|
| Notchify (Windows) | notifications, media, weather, battery, timers, mic indicator, clipboard history, volume and brightness popups |
| boring.notch (Mac, free) | music centre with a visualiser |
| FlowShelf (Mac) | a shelf for everything copied, dropped or screenshotted |
| Alcove, NotchNook (Mac, paid) | fluid transitions, live activities, swipe gestures, custom HUDs |
Coco Island on the PC takes: volume and brightness HUD, clipboard moments and history, a file shelf, screenshots,
timer and stopwatch, battery moments, mic and camera in use, downloads.

## Material You, 2025-2026
Material 3 Expressive (Google I/O 2025): spring motion (MotionScheme), shape morphing, bigger and bolder type,
button groups, floating toolbars, wavy progress, morphing loading indicator. In Compose the official Expressive
components were still on the alpha track (material3 1.5.0 alphas, July 2026), so the Coco app builds the same look
on the stable library: springs everywhere, morphing marks (already our house style), a floating navigation pill,
wavy progress, press bounce, pull to refresh with a living Coco mark.

## Coco HQ dashboard idea
Pixel Agents (open source, 2026) shows each Claude Code session as an animated character in an office that types,
reads, waits for input or asks for permission. Coco HQ does the same with our real data from Coco Cloud: Coco in
the middle, the Bonbon Club around her, a moving line from Coco to everyone who is working (tasks.member_id),
"YES?" bubbles for work waiting on a founder, finished work flying back to Coco, and a live activity feed.
Own drawing, no copied art.

## Sources
- iOS 26 Live Activities: https://9to5mac.com/2025/08/20/carplay-is-about-to-get-one-of-apples-best-recent-iphone-features/
- Android Live Updates (official): https://developer.android.com/develop/ui/views/notifications/live-update
- OnePlus Live Alerts: https://androidauthority.com/oneplus-live-alerts-apple-dynamic-island-3512439
- Samsung Now Bar: https://androidauthority.com/samsung-now-bar-hands-on-3520876
- Material Expressive in Compose: https://bytevikas.com/blog/compose-material3-1-5-expressive-stable-apis.html
- Notchify (Windows): https://www.windowscentral.com/software-apps/notchify-brings-macos-style-dynamic-island-flair-to-windows-11
- boring.notch and others: https://alternativeto.net/software/the-boring-notch
- Pixel Agents: https://github.com/pablodelucca/pixel-agents
