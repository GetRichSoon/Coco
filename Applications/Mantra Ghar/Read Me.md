# Mantra Ghar

Every main deity of Sanatana Dharma with their best mantra, in one page. Material You Design Theme
(the company default), Sanatan treatment: cream paper, saffron seal, ॐ, moving mandala shapes,
Devanagari display type.

Built 2026-10-27 for Boss. Lives here because this is where Coco applications go.

## Open it

Double click `index.html`. Works offline, works on the phone (open the folder over any share, or
"Add to Home screen" for an app icon). Nothing to install, no account, no internet needed.

## What is inside

| File | What it is |
|---|---|
| `index.html` | The whole app — layout, sections, search, jap counter. |
| `mantras.js` | The data. One line per mantra. **Only file you normally touch.** |
| `check.mjs` | `node check.mjs` — checks every line of the data before you trust it. |
| `theme/` | Copy of the Material You Design Theme (tokens, components, loops, fonts, shapes). |
| `inline-shapes.mjs` | Bakes the theme shapes into `theme/shapes-inline.css`. Chrome blocks mask SVGs on `file://`, so without this every shape goes invisible when you double click. Re-run only if the theme is updated. |
| `images/` | Deity / mantra images. Referenced by the `image` field. |
| `icon.svg`, `manifest.json` | App icon and phone install details. |

## Sections

Aaj ka Mantra (changes every midnight) → Top Mantras (16 of them) → then eight sections:
Mahamantra, Shiva Parivar, Vishnu Parivar, Devi Shakti, Navagraha, Vedic Dev, Guru aur Sant,
Teerth aur Prakriti. 64 mantras, 56 deities. Search covers deity, mantra, meaning and "kab karein".

Tap any card to open it: meaning, when to chant, image if there is one, a **Jap +1** counter
(108 by default, resets itself every midnight, saved on that phone only) and **Copy**.

## The APK

`android/` is a thin WebView shell around the same `index.html`. It holds **no copy** of the
mantras: the build syncs `index.html`, `mantras.js`, `theme/` and `images/` into the APK's assets,
so the phone can never show something different from the page on the PC.

```
android\gradlew.bat -p android assembleRelease
```
Output: `android\app\build\outputs\apk\release\app-release.apk`.
Signed with the local debug key — fine for our own phones, **not** for the Play Store.
Install on a connected phone (USB debugging on): `adb install -r <that apk>`.

Needs a Java 17 JDK. This PC only had Java 8, so a portable one sits in
`Good Space\Coco\Tools\jdk17` and `android\gradle.properties` points at it. Nothing
system-wide was changed.

After changing a mantra, rebuild the APK — the page updates by itself, the APK does not.

## Add a mantra

Add one line at the end of `mantras.js`, before the `]`:

```json
{"id":"short-name","deity":"Deity","deityHi":"देवता","group":"Devi Shakti","title":"Mantra ka naam",
 "mantra":"ॐ …","roman":"Om …","meaning":"One line.","when":"Kab karein.","count":108,"top":false,
 "image":"file-in-images-folder.jpg"}
```

- `group` must be one of the eight above, or it becomes a new section at the bottom.
- `top: true` puts it in Top Mantras and in the daily rotation.
- `image` is optional — drop the file in `images/` first and use just the file name.
- Then run `node check.mjs`. It must say OK.

## Not built yet

Boss will send mantras as Instagram / YouTube / photo links. **Reading that link and adding the
mantra by itself is not built.** Right now: Boss sends it in chat, the session reads it, confirms
the deity and the correct mantra name, and adds the line above. When it should be automatic, it
needs a vision model that is not Claude (Gemini or local) so the app keeps working without Claude —
that is a separate decision.

Also not built: audio / chanting playback, favourites, APK wrap, bundled Devanagari font
(it uses the phone's own — Nirmala UI on Windows, Noto on Android).

## Before this is ever published

The 64 mantras were written from standard, widely used texts, not scanned from one printed source.
A religious app must not carry a wrong mantra: get the Devanagari of every line checked by Boss or
a priest before this goes on any store or website.
