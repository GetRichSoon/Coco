# COCO unified UI redesign and six-theme system (release 2.11.0)

Branch `ui/unified-redesign`, worktree `C:\Users\Lenovo\coco-redesign` (made from `org/unified-ui` plus a merge of `cloud-foundation`).
Date of this report: 2026-11-11.

One application on three clients: the Desktop app (Electron, loads `Lounge/index.html`), the phone/PWA (the same file) and Android (Kotlin and Jetpack Compose).
One navigation, one design system, one theme engine, all existing features kept.

**Nothing was pushed, deployed, published or migrated, and none of this work is committed (one merge commit was made inside the worktree earlier to combine two branches). See section 1.**

---

## 0. Result at a glance

Legend: **PASS** = executed here and passed. **PARTIAL** = part executed, the rest named. **BLOCKED** = cannot be done without something that is not mine to do. Nothing below is marked PASS unless a test or a screenshot run actually executed it.

| Client | Built | Automated checks (executed) | Seen on a screen | Verdict |
|---|---|---|---|---|
| **Desktop** (Electron 33 renders `Lounge/index.html`) | no installer built (the app is this same file) | UI suite 31/31 and theme suite 38/38 with the desktop bridge present; a real Electron 33 window 7/7 | Playwright screenshots at 1440x900; a real Electron 33 window was driven | **PASS** for everything the window renders. **PARTIAL** for the packaged app: its real main process (PC commands, start-up entry, Island) was deliberately not started, so those were not exercised |
| **PWA / phone browser** (same file, 390x844) | n/a | phone layout checks in both browser suites, all six themes in light and dark | Playwright screenshots | **PASS** in a Chromium phone viewport. **PARTIAL**: not installed on a real phone's home screen (the manifest is unchanged apart from its colours; the app has no service worker, before or after, so there is no offline mode) |
| **Android** (Kotlin / Compose) | debug APK built, `app-debug.apk`, 61,592,893 bytes | 116 Gradle unit tests, 0 failed (43 are new, among them all 125 shared theme test vectors) | emulator `nova_test` (API 36), offline, no real data | **PASS** for the build, the unit tests and the emulator run. **PARTIAL**: seen offline with no pairing, so no real data; the cloud theme sync was not run against the real cloud; not installed on a real phone |

What the founder will notice first:

1. **Home is revenue first** and tells the truth when there is no revenue data (see 5 and 14).
2. **Eight sections, two permanent actions.** Home, Houses, Work, Automation, Brains & Agents, Insights, Connections, System, plus Ask COCO and Remote Control on every screen.
3. **Seven House workspaces** with the same 20 tabs each.
4. **Six themes** (Original Signature stays the default and is locked), light and dark, with an automatic switcher you can configure (section 10).

---

## 1. Safety statement (what was not done)

| Rule from the brief | What happened |
|---|---|
| Do not delete existing features or historical data | Nothing deleted. A preservation audit (section 8) found every API route, RPC, desktop-bridge method and top-level function of the original page still present. |
| No production schema change, no migration | None. The theme preference reuses the **existing** `controls` table (a runtime row, no schema change). No migration was applied by this work (Brain tables 0039, automation templates 0042 stay as they are); where those tables cannot be read, the pages say so plainly. |
| Do not rotate or expose credentials, connect or disconnect accounts | None touched. Test device keys are fake strings; the emulator got a placeholder key that was removed afterwards. |
| No production deploy, no publishing of APKs, releases or content | None. The APK is a local debug build. `release.json` was edited in the worktree only; the running Desktop app updates from `origin/main`, which this branch is not on. |
| No purchases, no bypass of founder approval | None. `+ Create` goes through the existing wizard and the approval gate; creating a House is refused with a message (Houses are fixed in the registry and need a founder YES). |
| No silent changes to unrelated files | Everything is in `Lounge/`, `Lounge Android/`, `Lounge Desktop/package.json` (version string), root `package.json` (version string) and `reports/`. The main checkout (`C:\Users\Lenovo\Good Space\Coco`) and the running Desktop app were never touched. |
| Nothing committed | The branch has uncommitted work only. (A merge commit `f211952` was made earlier inside this worktree to bring `cloud-foundation` in; nothing was pushed.) |

All tests ran against **synthetic data and a stand-in Nova** on localhost. The tests sent no request to COCO's own services, and no number in any screenshot named "with revenue" is real (they are fixtures, labelled as such in the test code).

One thing outside the tests: at the very end I tried to write a single activity line to Coco Cloud's log (your standing "keep Coco updated" rule, using the existing `scripts/coco_log.mjs`). Coco Cloud refused it (HTTP 402, `exceed_egress_quota`, the same restriction as on 2026-11-02), so **nothing was written** and Coco's activity log does not show this work. Once the restriction is lifted, one activity line ("UI redesign 2.11.0 built locally (not published)", with a pointer to this report) should be logged with the same script.

Heads-up for whoever commits: this repository **tracks** `Lounge Android/.gradle/` and `Lounge Android/app/build/`, so every Android build shows well over a thousand modified build files. Commit only the source (list in section 2).

---

## 2. Files changed

Counts are for the worktree, source only (build outputs excluded).

**Web, PWA and Desktop (`Lounge/`)**

| File | What |
|---|---|
| `index.html` (+1045 / −137 lines) | The unified shell and navigation, filters, Home, House workspaces, Hierarchy, Insights, Ask COCO drawer, notifications, search, Appearance page, theme sync. The stylesheet defines no colours of its own any more. Two generated blocks (`THEME-FALLBACK`, `THEME-PANELS`) are written by `contract/build.mjs`; do not hand-edit them. |
| `ui-kit.js` (new) | Pure helpers: periods, scope (House/Team/Category/Channel), metric selection, totals, growth, number/money formatting, SVG line/bar/target charts. Honest-data rules live here. |
| `theme-engine.js` (new) | The one theme engine (pure core + thin browser shell). |
| `theme-mock.js`, `theme-preview.html` (new) | The review sheet that shows all six themes in light and dark from the same generated tables the app reads. |
| `contract/` (new) | `nav-contract.json` (the one navigation), `themes.json` (seeds), generated `theme-schemes.json`, `theme-vectors.json`, `nav-contract.js`, `theme-contract.js`, generators `build.mjs`, `build-themes.mjs`, `build-vectors.mjs`, `theme-css.mjs`, and a README. |
| `fonts/` (new) | Space Grotesk (SIL Open Font License) as three woff2 files, so Desktop and the PWA need no network font. |
| `manifest.json`, `release.json`, `package.json`, `package-lock.json` | Theme colours, version 2.11.0 and its release notes, the generator dev-dependency (`@material/material-color-utilities`, build time only). |
| Tests (new) | `ui-kit.test.js`, `nav-contract.test.js`, `theme-engine.test.js`, `theme-schemes.test.js`, `ui-browser.test.mjs`, `theme-browser.test.mjs`, `desktop-theme.test.mjs`, helpers `ui-harness.mjs`, `ui-fixture.mjs`. |
| Tests (edited) | `control-center.test.js`, `control-center.render.test.js`, `oauth-ui.test.js`, `morph.test.html` (they asserted the old navigation or the old position of code). |

**Desktop (`Lounge Desktop/`)**: `package.json` version only (1.1.0, Coco 2.11.0). `main.js`, `preload.js` are **unchanged**; the page uses only bridge methods the preload already provides (checked by a test).

**Android (`Lounge Android/`)**: `app/build.gradle.kts` (2.11.0 / versionCode 22; the contract folder is an asset directory), new `NavContract.kt`, `Facts.kt`, `Pages.kt`, `Houses.kt`, `Widgets.kt`, `Appearance.kt`, `ThemeContract.kt`, `ThemeEngine.kt`, `ThemeStore.kt`, `ThemeController.kt`, font `res/font/space_grotesk.ttf` (+ licence text), edited `Screens.kt`, `Lounge.kt`, `Cloud.kt`, `Theme.kt`, `Expressive.kt`, `MainActivity.kt`, `Chat.kt`, `Hq.kt`, `IslandPage.kt`, and unit tests `NavContractTest`, `ThemeEngineTest`, `ThemeVectorsTest`, `ThemeContractTest`, `ThemeSchemeMappingTest`, `ThemeStoreTest`. Details: `reports/android-redesign-notes.md`.

**Not touched**: `_nova.js` and every API file, all SQL migrations, workflows, the control plane, signing keys, `publish-update.mjs`, the Island code path, `Updater`, `Heal`, `PhoneRemote`.

---

## 3. Navigation (one contract, three clients)

Source of truth: `Lounge/contract/nav-contract.json`. Desktop reads a generated copy (`file://` pages cannot `fetch`), Android reads the JSON from its assets. `nav-contract.test.js` keeps the page, the JSON and Android in step.

```
Top bar on every screen:   Sidebar toggle · Search (press /) · Remote Control chip · Ask COCO · Theme quick switch · Notifications · Founder profile
Filters sit under the page title on Home, Insights and the House workspaces; Create is in each House header and on the Structure pages
Home            Overview                                   (revenue first)
Houses          All Houses · Organization · Structure · Teams · People & Resources
                 └ a House opens its workspace: 20 tabs (section 6)
Work            Board · Notes · Approvals · Runs
Automation      Templates & Prompts · Workflows
Brains & Agents Hierarchy · Brain records · Agents
Insights        Business · AI usage
Connections     Integration Hub
System          Control Center · Runtime & Policies · Cloud Workers · Devices · Remote Control · Rules · Appearance · Settings
Phone bottom bar: Home · Houses · Work · More   (More opens the other sections)
```

---

## 4. Old pages to new places

The brief counted 20 original pages; the original app actually had **23** route ids. All 23 are accounted for, and every old link (`#control`, `#approvals`, ...) still works.

| Original page | Now |
|---|---|
| Home (`home`) | Home / Overview (redesigned, revenue first) |
| Control (`control`) | System / Control Center |
| Board (`board`) | Work / Board |
| Notes (`notes`) | Work / Notes |
| Remote (`remote`) | Global Remote Control, also System / Remote Control |
| Approvals (`approvals`) | Work / Approvals |
| Company (`company`) | Houses / Organization |
| Teams (`teams`) | Houses / Teams |
| Agents (`agents`) | Brains & Agents / Agents |
| Runs (`runs`) | Work / Runs |
| AI usage (`ai`) | Insights / AI usage |
| Brain (`brain`) | Brains & Agents / Brain records |
| Workflows (`workflows`) | Automation / Workflows |
| System (`system`) | System / Runtime & Policies |
| Cloud (`cloud`) | System / Cloud Workers |
| Ask Coco (`chat`) | Global Ask COCO (drawer on desktop and phone, top-bar action on Android) |
| Integrations (`connections`) | Connections / Integration Hub |
| Club (`club`) | Houses / People & Resources |
| Rules (`rules`) | System / Rules |
| Devices (`devices`) | System / Devices |
| Settings (`settings`) | System / Settings |
| Structure (`structure`) | Houses / Structure |
| Automation (`automation`) | Automation / Templates & Prompts |
| *new* | All Houses (`houses`), House workspace (`house`), Hierarchy (`hierarchy`), Appearance (`themes`) |

---

## 5. Home: revenue first, and honest

* **Global filters** (one collapsible bar, remembered, reset button): House, Team, Category, Channel/Product, Platform, Account, Period (including a custom range), Currency. Each filter narrows every card and chart that can honour it and says so when one cannot (for example "Not narrowed by channel or platform").
* **Six KPI cards**, **Total revenue first** and larger: Total revenue, Total views, Total sales, Audience growth, Published outputs, Active jobs. Each shows a basis chip (Actual / Estimated / Actual + estimated / Unavailable / No records in period), the change against the previous period, its source, the freshness of the latest record and how many records back it.
* **Four charts**: revenue over time, revenue by House, views and audience trend, production target against actual (from the existing automation statistics route).
* **Seven House cards** (Gigi Social, Lulu Software, Poppy Ebooks, Mochi Comics, Fifi Courses, Zaza Games, Tilly Commerce), each showing only the measures that mean something for that House. Core is not shown as a business House.
* **Live operations**: running, queued, failed or blocked jobs, cloud worker, latest runs.

The rules that make it trustworthy (all tested in `ui-kit.test.js` and `ui-browser.test.mjs`):

* Missing is never shown as zero. "Unavailable" and "No records in period" are different things and are worded differently.
* "The records cannot be read" is never worded as "there are none". In production today, Nova does not expose `org_metrics` (section 14), so the Home says exactly that, with a banner, instead of a row of zeros.
* Actual and estimated amounts are never added together; estimates are listed separately and kept out of the headline total.
* Currencies are never converted or added; each currency is its own figure and its own line.
* A chart with no data draws nothing and says why (an empty line would look like zero).
* Rows whose value is null, empty or not a number are ignored (the old helper turned `null` into 0; this was found in the Android pass and fixed here).

---

## 6. House workspaces (7 Houses, the same 20 tabs)

Overview · Organization · Teams & Subteams · Categories · Channels & Products · Brains · Agents · Automation · Templates · Prompt Instructions · Connections · Reference Assets · Production · Outputs · Scheduler · Approvals · Analytics · Revenue · Activity History · Settings.

Every tab reads existing data, filtered to that House, and has an honest empty state. Writes reuse what already exists: Approvals tab has the same YES / No as the Approvals page; Channels has the existing channel dashboard; **`+ Create`** (House, Team, Subteam, Category, Channel, Product, Automation) opens the existing creation wizard or the Automation page, so nothing creates production state by itself:

| Create | Behaviour |
|---|---|
| Team, Subteam, Category, Channel, Product | Existing creation wizard (destination, template or preset, Brain, agents, prompt, account, review). Creating never activates production or publishes. |
| Automation | Opens Automation / Templates. |
| House | Refused with a clear message: Houses are fixed in the registry; adding one needs a registry change and a founder YES. |

Data sources and the states each tab can show:

| Tab | Source | When there is nothing to show |
|---|---|---|
| Overview | registry units, products, agents, tasks, approvals | counts of zero are real counts here |
| Organization, Teams, Categories | `org_units`, `org_agents`, pipelines | "Nothing is registered under this House yet" or "The structure is not loaded" |
| Channels & Products | `org_products` plus the earlier offerings list | "No channels or products yet" |
| Brains | `org_brains` | says the Brain records are not set up yet and what they wait for |
| Agents | `org_agents` | "No agents are assigned" |
| Automation, Scheduler | pipelines, registered workflows | "No pipeline or workflow is registered" |
| Templates, Prompt Instructions | `/api/automation/templates`, `/prompts` | "not readable" with the reason |
| Connections | integration accounts and links against the platforms that House expects | "No account added yet", per platform |
| Reference Assets | `org_refs` | "No reference is recorded" |
| Production | jobs, open tasks, planned against created | "No production is planned in this period" |
| Outputs | outputs log | "No output has been logged" |
| Approvals | approvals tagged to the House | "No approval is tagged to this House" |
| Analytics, Revenue | `org_metrics` (and YouTube for Gigi) | Unavailable, or "cannot be read from here yet" |
| Activity History | latest 100 activity entries matched by House and team name | says how it was matched |
| Settings | identity, tracked measures, expected platforms, links to team controls | n/a |

---

## 7. Other sections

* **Work**: Board, Notes, Approvals (with YES / No exactly as before, and the approval gate unchanged), Runs. The waiting-approvals count is a badge on the Work entry.
* **Automation**: the existing template, prompt, library, reference, schedule, statistics, wizard and channel dashboard UI, unchanged in behaviour, plus Workflows.
* **Brains & Agents**: new **Hierarchy** page (the Brain tree from the registry), Brain records, Agents.
* **Insights**: Business (company revenue, per-House performance, YouTube, with source, basis and as-of on every number) and AI usage.
* **Connections**: the Integration Hub as it was (connect, verify, switch providers). Secret references are classified, never shown.
* **System**: Control Center (emergency stop and pause keep their confirmation and are not offered until the real state has been read), Runtime & Policies, Cloud Workers, Devices, Remote Control, Rules, **Appearance**, Settings.
* **Ask COCO and Remote Control** are always one tap away, on every screen, on every client. Device pairing, approvals and the PC-command restrictions behave exactly as before; the page only uses bridge methods the preload already exposes.

---

## 8. Preservation audit (nothing lost)

Method: the original `Lounge/index.html` from `HEAD` was compared with the redesigned file by script (`preserve-audit.cjs`, run 2026-11-11).

| Thing the original page contacts or defines | Original | Now | Missing |
|---|---|---|---|
| `/api/...` routes | 8 | 8 | **0** |
| RPC names | 13 | 13 | **0** |
| Tables read or written | 35 | 36 | **0** (one added: `controls`, the existing settings table, for the shared theme row) |
| Desktop bridge methods (`cocoDesktop.*`) | 17 | 17 | **0** |
| Realtime channels | 1 | 1 | **0** |
| Original page route ids | 23 | 23 | **0** |
| Top-level functions | 257 | 324 | **0** |

Plus: every existing node suite still passes (section 12), including the control-center, oauth, approvals, release, pairing-gate, hub, morph (DOM patching) and live-loop suites. Four test files were edited, only because they asserted the old navigation or the old position of code in the file (`control-center.test.js`, `control-center.render.test.js`, `oauth-ui.test.js`, `morph.test.html`).

---

## 9. Design system

Material 3 with the Expressive feel: large rounded shapes (16 to 28 dp), tonal surfaces, state layers, spring motion, Space Grotesk everywhere.

* **Tokens**: the stylesheet uses only CSS variables (`--primary`, `--surface`, `--on-surface`, `--surface-1/2/3`, `--outline`, `--good`, `--warn`, `--bad`, `--sel`, `--cta`, `--hl`, `--chart-1/2/3`, and `--p-*` copies for panels). It defines **no colours**. A test fails if any of the old hard-coded colours survives on any screen, in any theme.
* **Reusable pieces**: KPI card, chip, section card (`card2`), House tile, filter bar, tab row, row (`hrow`), empty state (`hnone`), "not set up" state (`setup`), banner, line/bar/target charts, the create menu, the Ask drawer, the theme quick switch and preview bar. Android has the same set as Compose components (`Widgets.kt`, `Pages.kt`).
* **Panels**: cards, navigation and dialogs can have the opposite polarity to the page (Original Signature is black cards and black navigation on a lavender page). Panels re-declare their variables from the panel palette, so no component needs to know.
* **Motion**: spring easing and a cross-fade (a view transition) when the theme or page changes; **reduced motion** switches instantly.
* **Accessibility**: every text pair is checked against WCAG AA at build time and again on the real pages in the browser (4.5:1, 3:1 for large text); visible focus styles, labelled controls, no sideways page scroll at phone width (the last is checked on every screen in every theme).

---

## 10. Material You themes

### The six themes

Seed colours come from the brief. Original Signature uses exactly the brief's colours and is locked (the generator cannot change it).

| # | Theme | Primary | Secondary | Tertiary | Note |
|---|---|---|---|---|---|
| 1 | **Original Signature** (default, locked) | #FF39A8 hot pink | #B76FD6 | #FFE52E bright yellow | Black #151313 cards and navigation, pink selected states, yellow highlights and calls to action; dark page Deep Aubergine #24152E, light page Soft Lavender #F0EAF7 |
| 2 | Electric Cobalt | #3563E9 | #35CFC9 | #FF9F43 | |
| 3 | Royal Violet | #7655D9 | #35C6F2 | #FF719A | |
| 4 | Emerald Energy | #168A5B | #B5DE55 | #55BCE8 | |
| 5 | Tangerine Fusion | #E76F38 | #477BFF | #FFD166 | |
| 6 | Digital Orchid | #B43ACB | #43D9B2 | #F4C95D | |

Each has a full **light and dark** scheme: primary, onPrimary, primaryContainer, onPrimaryContainer, secondary and tertiary families, background, surface roles, outline, outlineVariant, error, success and warning families, plus chart, accent, call-to-action and highlight roles. Neutral surfaces are tinted from the seed. The tonal palettes are generated once from the seeds with Google's Material Color Utilities (HCT colour space) and committed; the apps ship only the numbers.

**Visual preview of all six themes, light and dark** (made first, before the implementation was wired through the app): `reports/screenshots/themes/theme-preview-all.png`, from the page `Lounge/theme-preview.html` (open it in any browser). It is painted from the same tables the app reads and prints the WCAG ratios next to each theme.

### Architecture (no second engine, no duplicate palette)

1. `contract/themes.json` (seeds, rotation options, defaults) -> `contract/build-themes.mjs` -> `contract/theme-schemes.json`. **The build fails if any text pair drops below AA.**
2. `theme-engine.js` sets the variables on `<html>` **before the first paint** from a small script in `<head>`, so the saved theme is on screen before anything else. Switching never reloads the page.
3. Android implements the same rules in Kotlin (`ThemeEngine.kt`) and runs the **same test vectors** (`theme-vectors.json`, produced by the web engine) in a unit test, so the two cannot drift on rotation or scheduling.

### The automatic switcher

* Frequencies: every time COCO opens, every 5 hours, every 7 hours, daily, weekly, monthly, manual only. Sequential (1 to 6, wraps) or random (never the theme in use nor the one before it).
* Daily, weekly and monthly run at a configurable time in a configurable time zone (default: the device's), with daylight saving decided exactly like `java.time`.
* Scheduling is computed from **timestamps**, never from a UI timer. A schedule that fell due while COCO was closed applies **one** step the next time it opens. A new session switches for "every time COCO opens"; a reload, navigation or focus does not. Saving a new schedule never fires it on the spot.
* It remembers the previous theme and when it last switched. A locked theme, "manual only" and a switched-off rotation never change.
* Random picks use a seeded hash that every device shares, so a person's devices agree.

### Appearance page (System / Appearance) and quick switch

Six preview cards painted with each theme's real colours in the current mode, current theme marked, Dark / Light / System, rotation on/off, frequency, order, time, weekday, day of month, time zone, next theme preview, last switched, next scheduled switch, **Apply next theme now**, **Lock this theme** (manual override), **Reset to default**, and **live preview** (the whole app repaints without saving; Cancel puts the saved theme back; Apply in the bar commits). A palette button in the top bar switches themes in one tap. Settings shows the current theme with a way into the full page and keeps Light / Dark / System.

### Saved and shared

One small JSON preference document per person, kept on the device (`localStorage` on web and Desktop, `SharedPreferences` on Android) and shared between the person's own devices through the **existing `controls` table** as row `ui_theme.<email>`. Writes are compare-and-set on `updated_at`; the document's own timestamp decides which copy is newer; a clash is resolved by adopting the newer copy without showing an error; if the table cannot be read or written the app keeps working from the device. "Every time COCO opens" switches are device-local and are not shared. An old Light / Dark choice made before the themes existed is kept.

### Android

The same six themes, in Kotlin, from the same contract files. `ThemeEngine.kt` is a line-for-line port of `theme-engine.js` (pure Kotlin, `java.time` for time zones and daylight saving) and passes **all 125 shared test vectors** from `theme-vectors.json`. `themes.json` and `theme-schemes.json` ride in the APK assets byte for byte (checked by hash), so Android cannot disagree with the web about a colour or a due time.

The page scheme is the root Material theme and `CocoPanel` re-themes every card, bar, sheet, dialog and menu with the panel scheme, so Original Signature is a lavender page with black panels on Android too (confirmed on emulator screenshots). Space Grotesk replaces the old fonts. The Appearance screen is under System, also reachable from Settings and from a palette menu in the top bar, with the same options as the web: preview cards in both modes, a preview bar (Apply / Cancel), rotation on/off, the seven frequencies, sequential or random, time, weekday and day of month, the time zone in use, Apply next theme now, Lock this theme, Reset to default.

A launch is a fresh Activity (the foreground service keeps the process alive, so a cold process start would miss most opens). On the emulator a screen sleep/wake left the theme alone and force-stop plus open moved it to the next one. The old "Match my wallpaper" dynamic-colour switch was removed so that one COCO theme controls the whole app. Details: `reports/android-redesign-notes.md`, sections T1 to T7.

**Sync caveat:** the shared `controls` row logic is covered by JVM tests against a fake row only. It is not known whether Nova lets a device insert a new `controls` row; if it does not, the first write stays on the device and nothing is shown.

---

## 11. Results per client

### Desktop

* The page is the same file for Desktop and the PWA, so Desktop gets the same navigation, Home, Houses and themes. `Lounge Desktop/main.js` and `preload.js` are unchanged.
* `ui-browser.test.mjs` and `theme-browser.test.mjs` ran in two modes: a plain browser, and `DESKTOP=1`, which installs a stand-in `window.cocoDesktop` with the same 17 methods the real preload exposes. Both suites pass in both modes (31/31 and 38/38).
* A **real Electron 33.2.1 window** (the version the desktop app ships) was driven by Playwright (`desktop-theme.test.mjs`): the page loads from disk over `file://` with `contextIsolation` and `sandbox` on, the real `preload.js`, and fonts from the bundled files. It checks that the saved theme is painted before the app, that the bridge methods (including the sync channels) are present, that the navigation is black on a lavender page with pink selection, that all six themes apply in light and dark and survive a reload, that a change is written to the shared settings row through the stand-in Nova, that every-launch rotation treats a reload as not a launch and a fresh window session as one, and that no script error occurs. 7 of 7 pass.
* A real bug was found by that run and fixed: a window created hidden (the desktop app starts hidden in the tray) never runs a view transition, so a theme change updated the saved setting but did not paint. The engine now paints the theme itself if the transition has not, and the Electron test covers it.
* **Not exercised**: the desktop app's real main process (it runs PC commands, sets the start-up entry and opens the Island), so PC-command behaviour is unchanged by construction (the files are untouched and a test checks the bridge) but was not run in this pass. No installer was built. The Desktop app running on this PC was not touched; it updates from `origin/main`, and this branch is not there.

### PWA / phone

* The same page was run in a 390x844 Chromium viewport in both browser suites (`ui-browser.test.mjs`, `theme-browser.test.mjs`): navigation (bottom bar plus More sheet), Ask COCO, Houses, a House workspace, Work, Insights, filters (collapsed behind one bar on phones), and all six themes in light and dark with no sideways overflow.
* Not executed: installing it to the home screen of a real phone. The app has no service worker (that was already so), so there is no offline mode to test; push notifications are not part of the PWA.

### Android

* Native Kotlin and Jetpack Compose, not a WebView. All 27 route ids resolve to a native screen (the 23 original pages plus houses, house, hierarchy and themes). Same eight sections, bottom bar Home · Houses · Work · More, Ask COCO and Remote Control in the top bar of every screen, 7 Houses with the 20 tabs, and the native Island and device commands untouched.
* Android reads everything the web page reads and keeps its existing writes (quick commands, tasks, approvals YES/No, rules, pairing). New writes: add a note, the emergency stop and pause switch (with a confirmation, and offered only after the real state was read), YouTube and Gumroad connect and verify. Edit-heavy flows stay on desktop and the pages say so (section 15, item 1).
* Build: `gradlew.bat testDebugUnitTest assembleDebug` gave BUILD SUCCESSFUL in 3m 8s with **116 tests, 0 failures, 0 errors, 0 skipped** (verified from the JUnit XML on disk: 61 tests that existed before, 12 for navigation and honest-data rules, 43 for themes).
* Emulator pass (AVD `nova_test`, API 36, network switched off, a placeholder device key that was removed afterwards): screens 20 to 37 are from the final APK. The pass found and fixed real problems: Home said "Everything is moving", "0 waiting", "All clear" before anything was read; Control Center offered the pause switch before reading its state; raw socket errors were shown. They now show a banner and "Unavailable". The emulator stalled once under host memory pressure (a rendering stall, not an app loop); it was restarted and the screenshots were redone.
* Not done: Compose UI tests (not in the Gradle cache), a release build, signing, installing on a real phone, seeing real data. A theme change repaints the whole screen for about half a second; this was fine on the emulator and is unmeasured on a real phone.

---

## 12. Tests

All numbers are from runs made on 2026-11-11 on this machine. Re-running is safe (everything uses stand-ins).

| Suite | What it covers | Result |
|---|---|---|
| Node suites, 39 files (`*.test.js`) | nav contract 6, ui-kit 19, theme engine 31, theme schemes 14, morph 16, oauth-ui 40, control-center, approvals, pairing gate, release, hub, live-loop, Nova routes and the rest of the existing suites | **39 of 39 files exit 0** |
| `ui-browser.test.mjs` (Chromium, Playwright 1.56.1, desktop 1440x900 and phone 390x844, stand-in Nova, synthetic data) | navigation, Home with no revenue data, with synthetic revenue (mixed estimates, two currencies) and with the metrics table unreadable, filters, House workspaces, Work, Insights, Ask COCO, notifications, search, dark mode, reduced motion, every desktop bridge method exists in the preload | **31 of 31 PASS** |
| same with `DESKTOP=1` (bridge stub) | the same checks with `window.cocoDesktop` present | **31 of 31 PASS** |
| `theme-browser.test.mjs` (Chromium) | default theme exact colours, six themes in light and dark, system appearance, AA contrast on real pages, no hard-coded colour left, layout in every theme on desktop and phone, persistence, rotation (every launch, 5 h, 7 h, daily, weekly, monthly, closed-app, lock, schedule change), Appearance controls, preview, quick switch, view transition and reduced motion, sharing with compare-and-set and offline | **38 of 38 PASS** |
| same with `DESKTOP=1` | the same | **38 of 38 PASS** |
| `desktop-theme.test.mjs` (real Electron 33 window, real preload, stub main process) | section 11, Desktop | **7 of 7 PASS** |
| Android unit tests (Gradle, JDK 17) | navigation contract, honest-data rules, theme engine with all 125 shared vectors, theme contract (AA for every theme, mode and scope), store and sync against a fake row, plus the 61 existing | **116 run, 0 failed** |
| Preservation audit (script) | every route, RPC, table, bridge method, channel, page id and function of the original page | **0 missing** (section 8) |
| Android emulator drive (manual) | navigation, Appearance, rotation, launch behaviour, pairing gate, offline states | screens 20 to 37 captured |
| **Not run** | Compose UI tests, a release build, a real phone, a real cloud, the packaged Desktop installer, the desktop main process | not executed |

No test failed in the final pass. Earlier in the work these failed and were fixed (not hidden): the Electron theme check (hidden window never painted), a precedence bug that disabled theme animations, preview not notifying listeners, panel colours on stat cards and the Ask drawer, an old navigation assertion in four test files, and the version check in `release.test.js`.

Fixtures are synthetic. Screenshots named "with revenue" show invented numbers on purpose.

How to re-run:

```
cd "C:\Users\Lenovo\coco-redesign\Lounge"
for f in *.test.js; do node "$f" || echo "FAILED $f"; done          # pure and render suites
node ui-browser.test.mjs ; node theme-browser.test.mjs               # Chromium, needs Playwright
DESKTOP=1 node ui-browser.test.mjs ; DESKTOP=1 node theme-browser.test.mjs   # desktop bridge present
ELECTRON_PATH="<path to electron.exe>" node desktop-theme.test.mjs   # real Electron 33 window
cd "..\Lounge Android" ; gradlew.bat testDebugUnitTest assembleDebug # needs JAVA_HOME (JDK 17)
node contract/build-themes.mjs ; node contract/build-vectors.mjs ; node contract/build.mjs   # regenerate after changing a seed
```

---

## 13. Artifacts and screenshots

| Item | Where |
|---|---|
| **Android debug APK** | `C:\Users\Lenovo\coco-redesign\Lounge Android\app\build\outputs\apk\debug\app-debug.apk`, 61,592,893 bytes, built 2026-11-11 23:13, application id `com.goodspace.cocolounge`, versionName 2.11.0, versionCode 22. Debug-signed, local only, not installed on a phone, no release build. |
| Six-theme visual preview | `reports\screenshots\themes\theme-preview-all.png` (image) and `Lounge\theme-preview.html` (open in any browser) |
| This report | `reports\coco-unified-ui-redesign.md` |
| Android details | `reports\android-redesign-notes.md` (sections 1 to 8: pages and parity; T1 to T7: themes) |
| Earlier audit of the old app | `C:\Users\Lenovo\nova-hq\reports\coco-complete-application-inventory.md` |
| Desktop | no installer built; the Desktop app is the same `Lounge/index.html` |

### Screenshots

Every screenshot uses a stand-in Nova with invented data, or the offline emulator. None shows a real company number.

`reports\screenshots\web\` (Chromium; names say desktop or phone, light or dark, and whether the invented revenue fixture is loaded):

```
01-desktop-home-light.png
02-desktop-home-scrolled.png
03-desktop-houses.png
04-desktop-house-gigi-overview.png
05-desktop-house-gigi-automation.png
05-desktop-house-gigi-brains.png
05-desktop-house-gigi-channels.png
06-desktop-work-board.png
07-desktop-work-approvals.png
08-desktop-automation.png
09-desktop-brains-hierarchy.png
10-desktop-insights.png
11-desktop-connections.png
12-desktop-system-control.png
13-desktop-system-devices.png
14-desktop-remote.png
15-desktop-ask-coco-drawer.png
16-desktop-notifications.png
17-desktop-home-with-revenue.png
18-desktop-insights-with-revenue.png
19-desktop-house-poppy-revenue.png
20-desktop-home-dark.png
21-desktop-house-dark.png
22-phone-more-sheet.png
23-phone-ask-coco.png
24-phone-home.png
25-phone-home-scrolled.png
26-phone-houses.png
27-phone-house-lulu.png
28-phone-work.png
29-phone-insights.png
```

`reports\screenshots\themes\` (the review sheet, the Appearance page, quick switch, and Home in several themes):

```
appearance-page-dark.png
appearance-page-gallery.png
appearance-page-rotation.png
appearance-page-top.png
phone-appearance-rotation.png
phone-appearance.png
phone-theme-emerald-light-home.png
phone-theme-orchid-dark-home.png
phone-theme-signature-light-home.png
quick-switch.png
theme-cobalt-dark-home.png
theme-cobalt-light-home.png
theme-emerald-dark-home.png
theme-emerald-hierarchy.png
theme-emerald-insights.png
theme-emerald-light-home.png
theme-orchid-dark-home.png
theme-orchid-light-home.png
theme-preview-all.png
theme-signature-dark-home.png
theme-signature-house-revenue.png
theme-signature-light-home.png
theme-tangerine-dark-home.png
theme-tangerine-house-revenue.png
theme-tangerine-light-home.png
theme-violet-dark-home.png
theme-violet-light-home.png
```

`reports\screenshots\android\` (emulator): **20 to 37 are from the final APK**; 00 to 13 are from the earlier indigo build and are superseded (left in place; deleting files needs your yes). Captions are in `android-redesign-notes.md`, section T6.

```
00_pairing_gate.png
01_home.png
02_houses.png
03_house_workspace_gigi.png
04_house_revenue_tab.png
05_work.png
06_more.png
07_insights.png
08_connections.png
09_system_control_center.png
10_system_emergency_stop.png
11_ask_coco.png
12_remote_control.png
13_home_light.png
20_theme_quick_menu.png
21_appearance_signature_light.png
22_appearance_signature_dark.png
23_appearance_cobalt_light.png
24_appearance_cobalt_dark.png
25_appearance_orchid_light.png
26_appearance_orchid_dark.png
27_home_signature_light.png
28_home_cobalt_dark.png
29_appearance_theme_cards.png
30_theme_preview_bar.png
31_ask_coco_signature_light.png
32_remote_control_signature_light.png
33_appearance_rotation_weekly.png
34_time_picker_dialog.png
35_appearance_header_weekly_schedule.png
36_settings_appearance_card.png
37_pairing_gate_signature.png
```

---

## 14. Blocked, and what was deliberately left alone

| Item | State | Why / what is needed |
|---|---|---|
| **Real revenue on Home** | **BLOCKED** | Nova's table allow-list (`Lounge/api/_nova.js`) does not include `org_metrics`, so the page gets a 404 for the metrics table and **cannot read any revenue, views, sales or audience record** in production. The UI now says exactly that (banner plus "cannot be read from here yet; that does not mean there are none") instead of showing zeros. Fix: add `org_metrics` (read only, RLS stays the authority) to Nova's allow-list and deploy it. That is a production change, so it waits for a founder YES. |
| Brain records on the House Brains tab and the Hierarchy page | depends on the cloud | When the organisation Brain records cannot be read from Coco Cloud, the pages say so and what they wait for (a verified backup and a founder YES for migration 0039). I did not check or change production. |
| Automation templates on the House Templates and Prompts tabs | depends on the cloud | Readable only when the templates are set up in Coco Cloud (migration 0042); otherwise the tab says "not readable" with the reason. I did not check or change production. |
| Production deploy, store listing, public APK release, `origin/main` | **not done on purpose** | Publishing and production deploys need a founder YES. |
| The two reference designs (images 2 and 6, and 3 and 5) named in the theme brief | **not available to me** | I did not receive the images. The Material You Expressive character (large shapes, tonal surfaces, expressive motion, saturated accents) is built from the brief's description and the six seed palettes. Please send the images to compare. |
| Cross-device theme sync across real devices | PARTIAL | Verified in browser tests and Android JVM tests against a stand-in Nova or a fake row (write, newer wins, conflict, offline). Not run across two real devices against the real cloud. Unknown: whether Nova lets a device insert a new `controls` row. |
| Android on a real phone with real data | PARTIAL | Screens were seen on the emulator offline with no pairing; real revenue and live data were not seen. |
| Windows installer / packaged Desktop build | not built | The Desktop app is the same page; a packaged build would be a release step. |
| Compose UI tests on Android | not added | Robolectric and `ui-test-junit4` are not in the Gradle cache (a large first download). Screens were checked on the emulator instead. |

---

## 15. Remaining UI gaps (honest list)

1. **Android is not at 100 percent edit parity with the web.** It reads everything the web page reads and keeps the native Island and device commands, but these stay desktop-only and the Android pages say "edit on desktop": team, agent and company Claude/model/budget controls, workflow on/off, connection assign/disconnect/add for providers other than YouTube and Gumroad, the structure builder, reconciliation decisions, Automation editing/testing/publishing, Notes pin/edit/archive. Reasons are in `reports/android-redesign-notes.md` section 4.
2. The dark floating surfaces (the approvals strip and the Brain capsule) are always dark by design; they now take their colours from the active theme's dark palette instead of fixed greys.
3. House tiles use a fixed identity colour per House (from the contract), not the theme colour, so a House stays recognisable in every theme.
4. Android keeps a few colours on purpose: the Bonbon Club identity marks, the native Island preview and the system-notification accent. Chart colours exist as theme roles, but Android draws no charts yet.
5. Jobs, outputs and links are matched to a House by team and unit name; the web also matches the last segment of a unit id, so a few Android House tabs can be emptier than the web ones.
6. The new Android pages add 19 table reads and 3 Nova calls, at most once a minute while the app is on screen (Nova caches 15 seconds). Watch egress after rollout.
7. There is no guided tour of the new navigation.
8. Android: three old font files (`bagel.ttf`, `fraunces.ttf`, `figtree.ttf`) are no longer used by any code but are still in the project and the debug APK. Deleting files needs your yes, so they are untouched.
9. Android: a theme preview that is left by switching app stays until Cancel is pressed or the Appearance screen is left (it is never saved).

---

## 16. Decisions to confirm

1. Add `org_metrics` to Nova's allow-list so Home can show real revenue (production change, needs YES).
2. Apply the Brain tables (0039) and automation templates (0042) after a verified backup, if they are still pending (needs YES).
3. Send the reference design images, then I can compare and adjust the Expressive details.
4. Remove the three unused old Android fonts (`bagel.ttf`, `fraunces.ttf`, `figtree.ttf`)? Deleting files needs your yes.
5. Commit and open a PR from `ui/unified-redesign` when you are happy (I did not).
