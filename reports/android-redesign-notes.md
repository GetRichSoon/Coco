# Coco Lounge Android: unified redesign notes (2.11.0 / 22)

Branch `ui/unified-redesign`, worktree `C:\Users\Lenovo\coco-redesign`, folder `Lounge Android\` only. Nothing committed,
nothing published, no phone touched, no signing, backend, database or API change.

## 1. Files changed

| File | What changed |
|---|---|
| `app/build.gradle.kts` | versionCode 21→22, versionName 2.10.0→2.11.0; `sourceSets { getByName("main") { assets.srcDir("../../Lounge/contract") } }` (resolves to `coco-redesign\Lounge\contract`; verified inside the APK as `assets/nav-contract.json`) |
| `NavContract.kt` (new) | Parses `nav-contract.json` from assets (org.json): sections, pages, globals, `phone_bottom`, 7 Houses (label, icon, colour, metrics, platforms), 20 `house_tabs`, `legacy_pages`. `resolve()` tolerates notes after a route (`"global/remote (also system/remote)"`). `ANDROID_PAGES` lists every page id Android draws. |
| `Facts.kt` (new) | Pure rules: House filter (`id == house` or starts with `house.`), House metrics incl. its products, "table missing vs network error", revenue/metric headline with the **same rules as the web `ui-kit.js`** (exact metric name `revenue`, last 28 UTC days, currencies never added, estimates by source never mixed with actuals, missing never 0), failed jobs of the last 3 days. |
| `Pages.kt` (new) | Every section page + shared pieces (`Line`, `SetupCard`, `table()` honest states, `Kpi`, `Measure`, `HouseGrid`, `NotReadBanner`, More menu, Material Symbols→icon map). |
| `Houses.kt` (new) | House workspace: contract identity header + the 20 `house_tabs` as a scrollable tab row, each tab filtered to that House. |
| `Screens.kt` | New `Tab` enum = `phone_bottom` (Home, Houses, Work, More); new contract-driven `LoungeApp` shell (section tab rows, top-bar Remote Control + Ask COCO on every screen, Back handling, not-read banner); old Home/Tile/More menu removed (moved/rebuilt in `Pages.kt`); `Card` = 16 dp radius, 16 dp padding, 1 dp outline; Remote shows an honest empty state. Existing screens (Board, Approvals, Rules, Devices, Settings, Teams, Remote, Dialogs, CommandBar) kept as they were. |
| `Lounge.kt` | `Rows` reads for the new pages (19 tables + 3 Nova routes, at most once a minute, only with the app on screen), `dataAt` (when the company was last read), `addNote`, `control` (coco_control), `oauthBegin` / `oauthVerify` (Nova), plain "No connection to Coco Cloud right now" instead of raw socket errors. |
| `Cloud.kt` | Error text also reads Nova's `reason` / `detail` fields. |
| `Theme.kt` | Redesign tokens (light/dark neutrals, indigo primary, status colours), shape `large` 24→16 dp. Dynamic colour ("Match my wallpaper") kept. |
| `Expressive.kt` | `FloatingNav` takes contract labels; the approvals badge moved from More to Work. |
| `app/src/test/.../NavContractTest.kt` (new) | `NavContractTest` (5 tests) + `FactsTest` (7 tests). |

Not touched: `MainActivity`, `Connected`, `Updater`, `Alerts`, `Heal`, `PhoneRemote`, `island/*`, `IslandPage`, `Chat*`, `Hq`, `Brand`, `Glass`, manifest, release files, `publish-update.mjs`, keystores.

Heads-up for the commit: this repo tracks `Lounge Android/.gradle/` and `Lounge Android/app/build/` in git, so every build shows hundreds of modified build files. Commit only `app/build.gradle.kts`, `app/src/**`. Line endings are LF like the index (checked with `git ls-files --eol`).

## 2. Navigation tree (all labels from the contract)

```
Top bar on every screen:  [Remote Control ● dot = a PC/phone online]  [Ask COCO]
Bottom bar (phone_bottom): Home | Houses | Work (badge = approvals waiting) | More

Home ─ Overview
Houses ─ All Houses | Organization | Structure | Teams | People & Resources
   └ tap a House ─ House workspace: Overview · Organization · Teams & Subteams · Categories · Channels & Products ·
                    Brains · Agents · Automation · Templates · Prompt Instructions · Connections · Reference Assets ·
                    Production · Outputs · Scheduler · Approvals · Analytics · Revenue · Activity History · Settings
Work ─ Board | Notes | Approvals | Runs
More ─ Automation (Templates & Prompts | Workflows)
     ─ Brains & Agents (Hierarchy | Brain records | Agents)
     ─ Insights (Business | AI usage)
     ─ Connections (Integration Hub)
     ─ System (Control Center | Runtime & Policies | Cloud Workers | Devices | Remote Control | Rules | Settings)
     ─ Ask COCO (global) · Remote Control (global) · Coco Island
Back: closes Ask COCO / Remote → closes the House → closes the More section → returns to Home.
```

All 26 ids in `legacy_pages` (the 23 original web pages + `houses`, `house`, `hierarchy`) resolve to an Android
destination; `house` is the House workspace. The test checks this against the live contract file.

## 3. Pages: data source, writes

Every table goes through Nova (`https://cocolounge.vercel.app/rest/v1/<table>`, header `x-device-key`). Each read has
four honest states: reading, **Not set up in Coco Cloud yet** (404 / relation missing), **could not be read right now:
<reason>**, or the rows. Until the first full company read succeeds, every section shows a banner and counts read
"Unavailable" / "not read yet", never 0.

| Page | Source | Writable on Android |
|---|---|---|
| Home / Overview | Revenue KPI `org_metrics`; YouTube `/api/youtube/latest`; approvals, tasks; live ops `jobs` (running/queued/blocked, failed in 3 days), cloud-worker device, `runs`; 7 House cards (contract identity + `houses`, `tasks`, `org_units`); Coco HQ, Next up (`events`), Team talk (`agent_messages`, `activity`, `members`) | Quick command bar (existing `commands` insert) |
| Houses / All Houses | contract houses + `houses` + `tasks` + `org_units` | no |
| Houses / Organization | `org_units`, `org_agents` (heads), `decisions` | no |
| Houses / Structure | `org_units`, `org_products` | no (web `coco_structure` builder stays on desktop) |
| Houses / Teams | existing screen: `houses`, `pipelines`, `categories`, `offerings` | no |
| Houses / People & Resources | `members`, `member_houses`, `member_tools`, `tools` | no |
| House workspace | Overview `houses`/`org_*`/`tasks`/`approvals`; Organization, Teams, Categories `org_units` (+`categories`); Channels `org_products` (+`offerings`); Brains `org_brains`, `brain_items`; Agents `org_agents`; Automation `pipelines`; Templates/Prompts `/api/automation/templates`, `/prompts`; Connections `integration_links` + `integration_accounts`; References `org_refs`; Production open `tasks` + `jobs`; Outputs `outputs`; Scheduler `events`; Approvals `approvals.team`; Analytics `org_metrics` (+ YouTube for Gigi); Revenue `org_metrics`; Activity the House's `tasks`; Settings `policies` | Approvals tab: existing YES / No |
| Work / Board | `tasks`, `task_notes`, `houses` (existing) | `submit_task` RPC, stop task, add points (existing) |
| Work / Notes | `notes` (`created_at desc`, archived hidden, pinned first) | **Add**: exact web insert `{kind: link\|note, source_url, text, status:'new', created_by, device_id}` |
| Work / Approvals | `approvals` (existing) | YES / No: state-guarded update + `decisions` insert (same as web `decideApproval`) |
| Work / Runs | `runs` (60), `run_events` (600), tap a run for its trace | no |
| Automation / Templates & Prompts | `GET /api/automation/templates`, `GET /api/automation/prompts` | read-only, says "edit on desktop" |
| Automation / Workflows | `pipelines` + `policies` (scope `workflow`, key `enabled`) | read-only (see gaps) |
| Brains / Hierarchy | `org_brains` tree (+ `org_units`/`org_products` names) | read-only, like the web |
| Brains / Brain records | `brain_records_latest` (goals, open escalations), `brain_items` where `retired=false` | read-only |
| Brains / Agents | `org_agents` grouped by top unit, `org_units` names | read-only |
| Insights / Business | Company revenue + per-House measures from `org_metrics` (+`org_products`), YouTube `/api/youtube/latest`; every number shows source, basis (actual/estimated/mixed) and as-of | no |
| Insights / AI usage | `ai_calls` (200): totals, by model / agent / team, latest 30 | no |
| Connections / Integration Hub | `integrations`, `integration_accounts`, `integration_links`, `integration_registry` facts, `cloud_providers`, `provider_switches`. `secret_ref` is only classified (vault name / file on one PC / none), never shown | **Connect / Reconnect** (YouTube, Gumroad): `POST /api/oauth/begin {provider, connection_id[, team, subteam for gumroad]}` → opens the returned `authorize_url` in the browser; **Verify**: `POST /api/oauth/verify {connection_id}`; provider switch approve / roll back (existing `coco_provider_switch`) |
| System / Control Center | `policies` (emergency stop), `controls` (pause), approvals, tasks, `jobs`, `ai_calls`, devices, `runs`, `releases` | Pause switch (existing `controls` update), disabled until the real state is read |
| System / Runtime & Policies | `policies`, `control_ops` (audit) | **Emergency stop**: `coco_control {p_scope:'company', p_scope_id:'*', p_key:'paused', p_value:true\|false, p_note}`, with a confirm dialog; offered only when policies were read; resume asks for a YES server-side |
| System / Cloud Workers | `jobs` counts by status, failed (3 days) / blocked list, cloud-worker device, all devices' heartbeat | no |
| System / Devices, Rules, Settings | existing screens | existing writes (pairing code, switch on/off, rules insert, local settings) |
| System / Remote Control and global Remote | existing `remote()` (`devices`, `commands`) | existing `commands` insert |
| Ask COCO (global) | existing `ChatScreen` (`/api/chat`, `/api/chat/tree`, `chat`) | existing `/api/chat` |
| Coco Island | existing `islandPage()` | unchanged |

## 4. Read-only on Android, and why

- **Team / agent / company Claude, model and budget controls** (web `pick()` / `numberCtl()` → `coco_control`): payload known, but the web
  builds them from `control-plane.json` ids (teams, agents) that Android does not load; kept on desktop rather than guess ids.
- **Workflow on/off**: the web toggles `coco_control('workflow', <control-plane pipeline id>, 'enabled')`; Android lists the `pipelines` table, whose ids may not match.
- **Connections assign / disconnect / add account / reconnect for non-OAuth providers** (`coco_connection` with extra fields per op): not built; only YouTube and Gumroad have a cloud connect/verify flow (same limit as the web).
- **Structure builder** (`coco_structure`), **reconciliation decisions** (`org_reconcile_decide`), **Automation editing / tests / publishing** (`/api/automation/*` POST routes): large flows, desktop only; the pages say so.
- **Notes pin / edit / archive / "Make it a plan"**: add only, as asked.

## 5. Tests

Command: `JAVA_HOME="C:\Program Files\Microsoft\jdk-17.0.21.21-hotspot"`, `gradlew.bat testDebugUnitTest assembleDebug` in `Lounge Android`.

- Before any change (baseline run): 61 tests, 7 classes, 0 failures.
- Final run (2026-11-11 21:02, `BUILD SUCCESSFUL in 3m 43s`, `testDebugUnitTest` executed): **73 tests, 0 failures, 0 errors, 0 skipped**
  (JUnit XML in `app\build\test-results\testDebugUnitTest\`):
  ChatScopeTest 5, HealTest 5, HqTest 5, RefreshTest 10, TalkTest 3, UpdaterSessionsTest 6, IslandRulesTest 27 (the 61 existing, all still green)
  + NavContractTest 5 + FactsTest 7 (new).
- New tests: `NavContractTest` - contract parses (7 Houses, 20 tabs, globals, opaque colours); bottom bar = `phone_bottom`; all 23 original
  page ids are present and **every** `legacy_pages` id is reachable; every contract page id is drawn; routes with notes resolve.
  `FactsTest` - House filter (prefix, not substring), House metrics include its products, missing revenue = "unavailable" (no rows, null, "",
  wrong metric name), old revenue = "no records" not 0, currencies and estimates never added, failed jobs only for 3 days, missing table vs network error.
- During the work the new contract test caught the other agent's contract update (new `houses`, `hierarchy`, `remote` pages, 26 legacy ids,
  annotated routes); Android was updated to match, then it passed.
- **Compose UI tests: not added.** Neither Robolectric nor `ui-test-junit4` is in the Gradle cache; adding them means a large first download
  (Robolectric's android-all runtime) and unit-test config changes. Bottom nav and More were checked on the emulator instead (section 7).

## 6. Build artifact

- `C:\Users\Lenovo\coco-redesign\Lounge Android\app\build\outputs\apk\debug\app-debug.apk` - 61,306,026 bytes (debug, unminified), built 2026-11-11 21:01.
- `output-metadata.json`: applicationId `com.goodspace.cocolounge`, variant `debug`, **versionName 2.11.0, versionCode 22**.
- The `nav-contract.json` inside the APK is byte-identical to `Lounge\contract\nav-contract.json` (sha1 `e7d2fb1d6cca…`, the version saved at 20:02).
- `assets/` in the APK: `nav-contract.json` (+ `nav-contract.js` and `build.mjs`, 6 KB, because the whole contract folder is the asset dir, as specified).
- `assembleRelease` not run.

## 7. Screenshots (emulator only)

`C:\Users\Lenovo\coco-redesign\reports\screenshots\android\` - AVD `nova_test` (API 36, 1080x2400), dark theme unless named light.

| File | Screen |
|---|---|
| `00_pairing_gate.png` | Pairing gate (no device key), new dark tokens |
| `01_home.png` | Home: not-read banner, Revenue / YouTube / approvals / tasks KPIs all "Unavailable", live operations, House cards |
| `02_houses.png` | Houses → All Houses: 7 cards with contract colour + icon, section tab row |
| `03_house_workspace_gigi.png` | Gigi Social workspace, 20-tab row, Overview |
| `04_house_revenue_tab.png` | Gigi → Revenue tab: "Unavailable" with the reason, never 0 |
| `05_work.png` | Work → Board (Board / Notes / Approvals / Runs) |
| `06_more.png` | More: Automation, Brains & Agents, Insights, Connections, System, Ask COCO, Remote Control, Coco Island |
| `07_insights.png` | Insights → Business: company revenue, YouTube, Performance by House |
| `08_connections.png` | Connections → Integration Hub |
| `09_system_control_center.png` | System → Control Center (stop state unknown, pause switch disabled until read) |
| `10_system_emergency_stop.png` | System → Runtime & Policies: emergency stop "State unknown", not offered |
| `11_ask_coco.png` | Ask COCO (top-bar action) |
| `12_remote_control.png` | Remote Control (top-bar action), honest empty state |
| `13_home_light.png` | Home in light theme (light tokens) |

How they were taken: the emulator's **network was switched off first** (airplane mode, ping checked), the debug APK was installed over the
emulator's old 2.8.2 test install (same signing key, `install -r`, data kept; it had never been paired - no `coco_lounge` prefs). The pairing
gate was captured as is. Then a **placeholder device key** was written into the debug app's private prefs so the app shell opens; with no
network every read fails locally, so the screens show the honest offline states (banner, "Unavailable", "not read yet", "no connection to Coco
Cloud right now"). No request reached production and nothing was paired. Afterwards the placeholder prefs file (the one file I
wrote) was removed, the app was checked back at "Pair this phone", night mode was restored, the network was switched back on, and the
emulator (which I had started) was shut down. The emulator now has the 2.11.0 debug build installed instead of its old 2.8.2 test build.

The emulator pass found real problems, which were fixed before the final build:

- With no data read, Home said "Everything is moving", "0 waiting", "All clear".
- Control Center said "Company work is running" and offered the pause switch without having read the state.
- Cloud Workers said "No cloud worker device is paired".
- Raw socket errors appeared on screen.

Now a banner explains the not-read state, counts show "Unavailable" or "not read yet", and the stop and pause controls are not offered
until their real state is known.

## 8. Remaining gaps

1. **`org_metrics` is not in Nova's table allow-list** (`Lounge/api/_nova.js` `TABLES`), so through Nova it answers 404: revenue and every
   business metric show "Not connected / Unavailable" on Android (and, via Nova, on the web too). Backend change needed, not made here.
2. **Web `ui-kit.js` turns a null revenue value into 0** (`Number(null)` is 0, which passes `Number.isFinite`). Android skips non-numeric values,
   so the two can differ for rows with a null `value`. Worth fixing on the web side.
3. Jobs, outputs and links are matched to a House by unit-id prefix (as specified). The web also matches the last segment of a unit id (registry team
   names like `youtube`), so the House Production / Outputs / Connections tabs can be emptier on Android.
4. Control Center lacks the web's control-plane snapshot numbers (budget %, plan, Claude/cloud step split): they come from `control-plane.json`, which Android does not read.
5. Remote panel and the Home command bar still use the old Good Space palette colours (functional, not restyled). Fonts unchanged (Fraunces / Figtree).
6. The new pages add 19 table reads and 3 Nova calls, at most once a minute while the app is on screen (Nova caches 15 s). Watch egress.
7. On real data the screens were not seen (no pairing allowed); layouts were checked offline only.


---

# Themes: six Material You themes with automatic rotation (same unreleased 2.11.0 / 22 build)

Sources of truth, read-only on Android: `Lounge\contract\themes.json` and `theme-schemes.json` (both are in the APK assets, byte for byte; nothing is
generated or edited here) and `Lounge\theme-engine.js` (ported to Kotlin). Nothing under `Lounge\` was touched.

## T1. Files changed

New, in `app\src\main\java\com\goodspace\cocolounge\`:

| File | What it is |
|---|---|
| `ThemeContract.kt` | Parses the two contract files (org.json): 6 themes, 7 frequencies, 2 orders, defaults, and the 58 colour roles for every theme x light/dark x page/panel as ARGB ints. Pure (no Android). |
| `ThemeEngine.kt` | The Kotlin port of `theme-engine.js`, line for line, pure (no Android imports): `normalize`, `nextDueAt` / `isDue` / `lastBoundary` / `boundaryAfter` on `java.time` (`ZoneId`, `ZonedDateTime`; a wall time that happens twice means the earlier instant, one that does not exist moves later by the gap, exactly like the JS), `pickNext` (sequential, or seeded random from 32-bit FNV-1a), `preview`, `applyManual`, `advance`, `setRotation`, `setLocked`, `setAppearance`, `reset`, `evaluate`, `newer`, and the ISO date parsing/printing the document needs. |
| `ThemeStore.kt` | Persistence and sync, pure over two small interfaces (a key-value store, one cloud row): local copy, adopt-the-newer, compare-and-set write, retry once, silent failure. |
| `ThemeController.kt` | The Android side: SharedPreferences, the Nova `controls` row adapter, the Compose state every screen observes, preview state, launch and 60 s tick. |
| `Widgets.kt` | Themed `TextButton`, `FilterChip`, `AlertDialog`, `DropdownMenu`, `OutlinedTextField`, `segmentedColors()` and `PanelSurface`. They live in the app package under the Material names (Kotlin resolves a package member before a star import), so every existing call picked the theme up without being edited. |
| `Appearance.kt` | The Appearance screen, the Apply / Cancel preview bar and the palette quick-switch menu. |

Changed: `Theme.kt` (rewritten: roles to Material scheme, spring cross-fade, `CocoPanel`, `LocalCocoRoles`, Space Grotesk type), `Screens.kt` (panel top bar with the palette icon, panel section tab strip, `Card` is a panel, status chips from the roles, command bar and YouTube card restyled, Settings), `Pages.kt`, `Houses.kt`, `Hq.kt`, `Chat.kt`, `IslandPage.kt`, `Expressive.kt` (floating nav is a panel, CTA edge on buttons), `Lounge.kt` (owns the controller; old light/dark + wallpaper settings removed), `MainActivity.kt` (launch + 60 s ticker), `NavContract.kt` (the contract now lists the page `themes`).
The contract itself changed while I worked (page id `themes` = "Appearance" in System, legacy id `themes`); Android follows the live file.

## T2. How the roles map

Every colour on screen comes from the roles of the active theme; the only literals left are the House identity colours (contract), the Bonbon Club identity marks (`Mu`, Brand.kt), the native island preview and the system-notification accent.

| Material slot | Role | Why |
|---|---|---|
| `primary` / `onPrimary` | `cta` / `onCta` | A default Button is the vivid call to action: yellow in Signature, the seed colour elsewhere. Buttons on the page also get the `ctaEdge` hairline (black on Signature-light, transparent on panels). |
| `primaryContainer` / `onPrimaryContainer` | `selected` / `onSelected` | Selected states: the nav pill, chosen segment, chosen chip (pink in Signature). The selected tab's text and indicator use `link`. |
| `secondary*`, `tertiaryContainer*` | same-named roles | |
| `tertiary` / `onTertiary` | `highlight` / `onHighlight` | |
| `background`, `surface`, `onSurface`, `surfaceVariant`, `outline`, `outlineVariant`, `inverse*`, `scrim`, `error*`, `surfaceContainer*` | same-named roles | `surfaceBright` / `surfaceDim` = `surfaceContainerHighest` / `Lowest`; `surfaceTint` is transparent so a panel is exactly its role colour. |
| (CompositionLocal `LocalCocoRoles`) | `accent`, `link`, `success*`, `warning*`, `cardSurface`, `fieldSurface`, `fieldSurface2`, `ctaEdge`, `chart1..3`, plus `cta`, `selected`, `highlight` pairs | `link` is the accessible text colour: `TextButton`, `MuOutlined`, eyebrows, link text, focused text-field label/border/cursor, selected tab text use it, never `primary`. |

Page vs panel: the root `MaterialTheme` wears the **page** scheme. `CocoPanel { }` re-themes its content with the **panel** scheme and is used by every `Card`, `PanelSurface`, the top bar, the section tab strip, the floating nav, `ModalBottomSheet`, `AlertDialog` and `DropdownMenu`. Result: Signature-light is a lavender page with black cards, black top bar, black tab strip and black nav, with light text on them; the other five themes have one scheme for both.
Status chips keep their meaning from the roles (error red, success green, warning amber). House tiles keep their fixed identity colours. Space Grotesk (the variable font, weights 300-700) is the typeface for all 15 text styles. The system status-bar icon colour follows the top bar, the gesture-bar icon colour follows the page.
Motion: a change cross-fades every role on a spring (stiffness 300, no bounce, about half a second) in both scopes at once; it cuts instead when Settings "Calm motion" is on or the system animator duration scale is 0.

## T3. Behaviour

- **Document**: exactly the agreed JSON (`v, appearance, themeId, previousThemeId, lastSwitchedAt, seq, locked, reason, rotation{enabled, frequency, order, time, weekday, dayOfMonth, tz, seed, anchorAt}, updatedAt, updatedBy`), local key `coco_theme_prefs` in the `coco_settings` SharedPreferences. A first run with no document keeps the old Light / Dark / System choice (`theme` key) as `appearance`; the old "Match my wallpaper" (Material You dynamic colour) is **removed** from Settings and from the colour pipeline (one active COCO theme controls the whole app; its stale preference key is simply never read).
- **Cloud copy, no migration**: table `controls`, row `id = "ui_theme." + lowercase(owner email)`, `value` = the document, `updated_by` = device id, `updated_at` = the document's own `updatedAt`. Read `GET controls?select=*&id=eq.<id>`; write `PATCH controls?id=eq.<id>&updated_at=eq.<previous updated_at>` (`Prefer: return=representation`, no row back = lost the race), `POST` when there is no row. Lost race: read again, adopt the other document if it is newer, otherwise one more compare-and-set. The later `updatedAt` inside the document wins. A running session adopts a newer remote document at once: the periodic company read already carries the `controls` rows, so this costs no extra request. Cloud read or write failures are silent (no toast, no crash); after 5 failures it stops asking until the next user action.
- **What reaches the cloud**: user actions and scheduled rotations only. A switch made because the app opened ("every launch") stays on that device. "Needs writing" is derived from the two documents (not a flag), so a change made offline is still sent after a restart.
- **Launch / resume / tick**: a launch is a **fresh Activity** (`savedInstanceState == null`: the launcher icon, or re-opening after the app was closed). That is the closest Android has to "a new session": the foreground service keeps the process alive, so a cold process start would miss most opens. A screen rotation, a resume or a process restore is not a launch. The engine is evaluated at launch (launch = true), on every resume and from a 60 s ticker that only runs while the app is on screen (launch = false). A schedule that fell due while closed takes ONE step at the next open; it is decided only after the cloud copy has been looked at (at most two seconds), so a device that was closed for a while cannot step the theme over a newer choice made elsewhere.
- **Rules (all from the engine, all covered by the 125 JS vectors)**: sequential follows themes.json order 1..6 then wraps; random never picks the theme in use (nor the one before it when 4 or more remain) and, for scheduled switches, is computed from the shared seed so every device agrees; saving a new schedule resets `anchorAt` so it never fires immediately; a locked theme never changes automatically.
- **Appearance screen** (System section, also from Settings, and from the palette icon in the top bar): header card (name, number, swatches, mode, "Last switched <when> (<reason>)", "Next scheduled switch <local date time> -> <theme>" or "Never (manual only)" / "On the next launch"), Light / Dark / System, six theme cards in 2 columns each with a live mini preview in both modes drawn from that theme's own roles, number + name + tagline, Current / Next badges, Preview (whole app wears it; Apply / Cancel bar; leaving the screen reverts) and Apply; automatic rotation switch, the 7 frequencies (labels from themes.json), Sequential / Random, time picker (daily, weekly, monthly), weekday chips (weekly), day-of-month stepper (monthly), the time zone in use, "Apply next theme now", "Lock this theme", "Reset to default".
- **Read-only vs writable**: the contract files and the colour tables are read-only. The only thing Android writes is the theme document (local, and the one `controls` row). Nothing else new is written.

## T4. Tests

`gradlew.bat testDebugUnitTest assembleDebug` (JAVA_HOME `C:\Program Files\Microsoft\jdk-17.0.21.21-hotspot`), run on the final sources: **116 tests, 0 failures, 0 errors, 0 skipped** (`BUILD SUCCESSFUL in 3m 8s`, JUnit XML in `app\build\test-results\testDebugUnitTest\`, run 23:14 local). The 73 that existed before all still pass: ChatScopeTest 5, FactsTest 7, HealTest 5, HqTest 5, NavContractTest 5, RefreshTest 10, TalkTest 3, UpdaterSessionsTest 6, IslandRulesTest 27. 43 are new.
New: `ThemeContractTest` 7 (six themes; Signature's five brand colours exactly - black #151313 as light and dark panel card surface, hot pink #FF39A8 as accent and selected, yellow #FFE52E as cta and highlight, #24152E dark and #F0EAF7 light background; Signature-light is lavender page + black panel; the other five have page == panel; all 58 roles in every scope; **WCAG AA 4.5:1 for onSurface/surface, onSurfaceVariant/surface, onCta/cta, onSelected/selected, link/surface for every theme, mode and scope, plus text on the cards the screens draw (panel scope)** - all pass), `ThemeEngineTest` 18 (sequential wrap, random never the current/previous, same random on every device, due times, a new schedule never fires at once, launch vs resume, one step for many missed boundaries, locked / manual / off never change, DST and time zones, round-trips), `ThemeVectorsTest` 1 test that runs **all 125 vectors** of `theme-vectors.json` (fnv1a32 6, pickNext 35, nextDueAt 59, evaluate 16, applyManual 2, advance 2, setRotation 1, setLocked 2, reset 1, normalize 1) against the Kotlin engine: all 125 pass, `ThemeStoreTest` 13 (persistence round trip, legacy light/dark migration, create / compare-and-set / lost race adopt / retry once / row created first, launch switch not written, scheduled rotation written, newer remote adopted at once, unreadable cloud silent and capped, offline change sent after a restart, no owner = nothing leaves the device), `ThemeSchemeMappingTest` 3 (role to Material slot mapping for every theme/mode/scope), and 1 more `NavContractTest` case (the `themes` page).
Compose UI tests: not added (no Robolectric / ui-test-junit4 in the Gradle cache; a large first download). Nav and More were checked on the emulator instead.

## T5. Build artifact

- `C:\Users\Lenovo\coco-redesign\Lounge Android\app\build\outputs\apk\debug\app-debug.apk` - 61,592,893 bytes, built 2026-11-11 23:13, sha256 prefix `2e13eb47...`, debug build only (`assembleRelease` was not run).
- `output-metadata.json`: `com.goodspace.cocolounge`, **versionName 2.11.0, versionCode 22** (unchanged, same unreleased build).
- Inside the APK, `assets\themes.json`, `theme-schemes.json` and `nav-contract.json` are byte-identical to the files in `Lounge\contract` (sha1 checked). `res\font\space_grotesk.ttf` is in; the three old fonts are still in too (gap 3).
- The emulator now has this build installed (replacing the previous 2.11.0 test build).

## T6. Screenshots (emulator only)

`C:\Users\Lenovo\coco-redesign\reports\screenshots\android\`. Emulator `nova_test`, **network off** (airplane mode, ping checked) before anything was installed; a placeholder device key was written only so the app shell opens, and removed at the end; no request reached production and nothing was paired.

| File | Screen (final APK, freshly booted emulator) |
|---|---|
| `20_theme_quick_menu.png` | The palette icon's menu: six themes with swatches, "In use" tick, Appearance settings |
| `21_appearance_signature_light.png` | Appearance, **Signature, light**: lavender page, black top bar / tab strip / cards / nav, pink selected states |
| `22_appearance_signature_dark.png` | Appearance, Signature, dark (aubergine page, black cards) |
| `23_appearance_cobalt_light.png`, `24_appearance_cobalt_dark.png` | Appearance, Electric Cobalt, light and dark |
| `25_appearance_orchid_light.png`, `26_appearance_orchid_dark.png` | Appearance, Digital Orchid, light and dark |
| `27_home_signature_light.png` | **Home in Signature light** |
| `28_home_cobalt_dark.png` | **Home in a non-Signature dark** (Electric Cobalt) |
| `29_appearance_theme_cards.png` | The theme grid: mini previews in both modes, Current badge, Preview / Apply, "In use" |
| `30_theme_preview_bar.png` | Preview of Royal Violet: the whole app wears it, Apply / Cancel bar, "Previewing" badge |
| `31_ask_coco_signature_light.png`, `32_remote_control_signature_light.png` | The two global actions in Signature light |
| `33_appearance_rotation_weekly.png` | Automatic rotation on, Weekly, Sequential, time button, weekday chips |
| `34_time_picker_dialog.png` | The time picker, a panel dialog |
| `35_appearance_header_weekly_schedule.png` | The Appearance header after setting Weekly: "Next scheduled switch: Mon 16 Nov, 09:00 → 3. Royal Violet" |
| `36_settings_appearance_card.png` | Settings: the new Appearance card ("Open Appearance"); the wallpaper switch is gone |
| `37_pairing_gate_signature.png` | The pairing gate in the default theme (taken last, after the placeholder key was removed) |

`00_` to `13_` in the same folder are from the earlier **indigo** build and are **superseded** by 20 to 37 (left in place: deleting files needs the founder's yes).

After the shots: the placeholder key and the theme preferences were removed from the app, it was opened once more (pairing gate), night mode went back to auto, the network back on, and the emulator (which I had started) was shut down.

Checked on the emulator (final APK) by reading the stored document after each step: with "Every time COCO opens" + sequential on, a screen sleep/wake (a resume) left the theme unchanged (Cobalt, seq 4), and force-stop + open from the launcher moved it to the next theme (Cobalt to Violet, seq 4 to 5, reason `launch`); the offline cloud did not break anything. (The same check on the previous build gave Violet to Emerald.)

## T7. Remaining gaps

1. **Cloud sync not exercised against the real cloud** (offline emulator, no pairing allowed). It is covered by JVM tests against a fake row only. Unknown until tried: whether Nova's RLS lets a device INSERT a new `controls` row (then the first write stays local and silent), and the compare-and-set depends on `updated_at` being exactly what we wrote (we always write it ourselves with millisecond precision; Nova hands it back as milliseconds, going by `Loungepi\_nova.js`, so a writer that sets `now()` with microseconds would make our write miss and fall back to local; not tried live).
2. The 60 s ticker and the resume check are on-screen only; a rotation never fires while the app is closed (by design: it takes one step at the next open).
3. Old font files are not deleted: `res\font\bagel.ttf` (1.5 MB), `fraunces.ttf` (360 KB), `figtree.ttf` (63 KB) are no longer referenced by any code; deleting files needs the founder's yes (standing rule), release builds shrink unreferenced resources anyway, the debug APK still carries them. **Say yes and I remove them.**
4. Text-field focus: Material draws the focused label, border and cursor in the accent. I route them to `link` (done in `Widgets.kt`), but the vivid CTA itself is 3.4 to 4.4 : 1 on cards in Emerald (light and dark), Tangerine light and Orchid dark, so anywhere a screen puts the raw `primary` on text it would be below AA; I found none.
5. `chart1..3` are in `LocalCocoRoles` but Android draws no charts yet.
6. The Bonbon Club identity marks (`Mu`, House and member marks), the native island preview and the system-notification accent (`#B83A12`) keep their own colours on purpose (identity / native surfaces).
7. Dismissing a theme preview by switching app (background) keeps the preview until the Appearance screen is left or Cancel is pressed; it is never saved.
8. A theme change repaints the whole screen every frame for about half a second (all colours move together); on the emulator this was fine until the host ran out of memory (see below), on a real phone it is unmeasured.
9. The whole `Lounge\contract` folder is the assets source, so six extra files (`.js`, `.mjs`, `theme-vectors.json`) ride along in the APK (about 200 KB).
10. Not exercised on a device: the "Calm motion" and system "Remove animations" cuts (a few lines in `animateCocoScheme`), and the palette menu / preview on a physical phone.
11. Emulator note: after about an hour of use, with the host down to about 1 GB of free memory, the emulator itself stalled (HWUI frames of 10 s+) and Android showed "Coco Lounge isn't responding" during a long automated tapping run. The stall was in the emulator's rendering (frames waiting on the GPU side), not in an app loop; the app was stopped, the emulator restarted and the screenshots redone. I did not reproduce it on a fresh emulator.
