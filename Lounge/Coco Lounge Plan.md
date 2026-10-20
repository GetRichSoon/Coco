# Coco Lounge plan (Boss, 2026-10-15)

All four devices (Boss PC, Boss phone, Big Boss PC, Big Boss phone) work through Coco Cloud. The laptop is just a device; nothing may depend on it.

## Tonight: phone APK (Lounge Android), one build with all of this
1. **Always connected:** a foreground service ("Coco connected" in the notification bar) that keeps the live link open and reconnects by itself when the network comes back. Today the phone only wakes every 15 minutes when the app is closed.
2. **Flow and team updates as notifications** (after this APK is on both phones, set LEGACY = false in nova-hq/scripts/coco-notify.mjs): `activity` rows with action `update` (title | detail). Code is already in `Alerts.kt` (not built yet).
3. **New PC commands in the phone's parser** (`PhoneRemote.understand`, keep it identical to `understand()` in `Lounge Desktop/main.js`): type / likho, press / dabao, screenshot (show the image), bolo / speak, close, party, joke, fact, motivate, laptop dhundo.
4. **Mic in any language** (Hindi, English, Marathi, mixed): the spoken text goes to Coco Cloud (`coco-chat`) which turns it into actions. Needs the Gemini API key in the cloud secrets.
5. **Files between devices:** receive a file from a PC or the other phone (Coco Cloud storage), open it; send a photo/file to a PC.
6. **WhatsApp:** open WhatsApp with the message already typed (Android does not let an app press Send; one tap). Non-family needs a "Bhejun?" first.

## PC app (Lounge Desktop), updated as we go
- Done 2026-10-15: type text, key shortcuts, screenshot, speak, close front app, fun corner (party confetti, joke, fact, motivate, find my PC beep), Flow update notifications.
- Next: find a file on the PC and send it to a phone; receive files from phones; WhatsApp Desktop message (typed and sent on the PC); multi-step plans from the AI ("notepad kholo aur likho ...").

## Cloud (Coco Cloud)
- Gemini key in Supabase secrets (`GEMINI_API_KEY`) so `coco-chat` understands any language and builds multi-step commands.
- Storage bucket for device-to-device files.
- Device offline alert (15 min without a heartbeat) to the other devices.
- The Flow daily Short as a cloud routine (keys in cloud secrets), laptop as backup.

## Coco Voice: "Okay Coco" on all four devices (Boss, 2026-10-16)
**Founder rule 2026-10-16: works even when the Coco app is closed.** All 4 devices stay connected in the background and listen for "Okay Coco" / "Coco" at all times (phones: a foreground service that starts on boot, with the required "Coco listening" notification; PCs: the tray app that starts with Windows). Whatever is said after "Coco" is done.
**Founder rule 2026-10-16: Coco never speaks. It only listens and does.** Feedback is silent: a small glow/tick on screen and the result in the Remote list. Any language works on every device (the cloud brain understands every language Gemini knows; speech-to-text set to auto-detect).
Goal: like "Okay Google", but for Good Space. Say "Okay Coco" (or "Coco") to any device, in any language
(Hindi, English, Marathi, mixed), and keep talking; every step runs on whichever device you name, until you stop.

Example the system must handle in one go:
"Coco, Boss PC kholo, WhatsApp pe Mumu ko bhejo 'kya kar rahe ho', phir YouTube kholo, half screen karo,
10 second skip karo, aur dusre half me Chrome kholo."

### How it works (4 layers)
1. **Wake word, on the device, offline.** A small always-on listener hears only "Okay Coco" / "Coco".
   Nothing leaves the device until the wake word is heard (privacy). Free, open-source engines:
   openWakeWord on the PCs, Vosk keyword spotting on the phones (custom "Coco" model trained once).
2. **Listening session.** After the wake word: a soft chime, the orb glows, the device keeps listening
   (continuous mode) until silence for ~4 s or you say "bas" / "stop" / "thank you Coco".
   Speech to text in any language: Android speech recognizer (hi-IN, mr-IN, en-IN) on phones,
   Whisper (free, local, faster-whisper small) on PCs. Mixed Hinglish is fine.
3. **Coco Brain in the cloud (coco-chat + Gemini).** Turns the sentence into a step plan:
   `[{device:"mangesh-pc", do:"open_app", app:"whatsapp"}, {do:"whatsapp_send", to:"Mumu", text:"kya kar rahe ho"},
   {do:"open_url", url:"youtube", layout:"left_half"}, {do:"key", key:"skip_10"}, {do:"open_app", app:"chrome", layout:"right_half"}]`
   Device names it understands: "Boss PC", "mera laptop", "Big Boss phone", "Shreya ka PC", "yahi phone".
   No device named = the device you are talking to.
4. **Runners on each device** do the steps in order, wait for each to finish (window open, page loaded),
   and report back; no voice reply, only a silent tick on screen.

### New abilities needed
- **Window layouts (PC):** left half, right half, full screen, minimise, "isko half karo" = the front window.
  Done with a small native helper (like CocoKeys.exe) using window snapping, not PowerShell (too slow).
- **Media control inside YouTube:** play/pause, skip 10 s, back 10 s, fullscreen (F), next video, volume, speed.
- **WhatsApp:** contacts book in Coco Cloud with a "family" mark. Family = sends straight away
  (PC: WhatsApp Desktop opens the chat with the text, presses Enter; phone: one tap on Send, Android rule).
  Non-family = Coco asks "Bhejun?" first.
- **Follow-ups without the wake word** while the session is open: "ab ruko", "aur tez", "wapas", "band karo".
- **Context memory:** "isko", "wo video", "same cheez Big Boss PC pe" refer to the last thing done.
- **Answers, not only actions:** questions ("battery kitni hai", "The Flow ka aaj ka video kab aayega")
  are answered as text on the screen from live Coco Cloud data.
- **Cross-device hand-off:** "ye video phone pe chalao" continues the same YouTube video at the same second on the phone.
- **Barge-in:** saying "Coco ruko" stops whatever is running on every device at once.

### Safety and privacy
- Wake word runs offline; audio is never stored; only the text of a command goes to the cloud.
- Power actions (restart, switch off), messages to non-family, payments, publishing: always a confirm button on screen first.
- Each phone and PC answers its own founder's voice by default; a command for the other founder's devices
  shows on their device and needs nothing extra only for harmless actions (play, open, volume).
- Microphone always-on shows a visible "Coco listening" notification on phones (Android rule) and a tray dot on PCs;
  one tap / one word ("Coco so jao") turns it off; "office mode" turns it off automatically.

### Build order
1. Cloud brain with Gemini (needs GEMINI_API_KEY) that outputs step plans; test with typed text.
2. PC: wake word + Whisper + runner + window layouts + YouTube keys + WhatsApp Desktop.
3. Phone APK: foreground "Coco listening" service + wake word + continuous speech + runner.
4. Contacts book (family marks), context memory, follow-ups, barge-in, cross-device hand-off.
5. Big Boss devices: same install, her own voice and contacts.
Test sentences for every build (must pass before release): the WhatsApp+YouTube+Chrome example above,
"Coco, Big Boss phone pe bhajan chalao", "Coco, laptop pe ye video half screen karo aur 10 second aage", "Coco ruko".


### Target device rules (Boss, 2026-10-16)
- Phone unlocked, app closed: "Coco ..." still runs in the background.
- No device named = do it on the device that heard you ("Coco, koi song laga de" plays on that phone; calls, messages, apps, anything).
- **Sticky control mode:** "Coco, Boss PC se connect karo" makes Boss PC the target for every next command ("YouTube kholo", "pause", "10 sec aage"), live, until you say "mere phone me karo" / "wapas" / name another device. The phone shows a small banner "Controlling: Boss PC" while this is on.
- Calls: "Coco, Mumu ko call karo" dials from the phone (Android shows the call screen; family only without asking).


### Always connected setting (Boss, 2026-10-16)
- Every app (both phones, both PCs) gets a Settings switch: **Keep connected** (default ON) / **Disconnect**. ON = stays linked to the other devices and Coco Cloud all the time.
- PC locked: stays connected and keeps running commands (the app runs as a background service, not only a window).
- Phone locked / screen off: stays connected (foreground service, battery-optimisation exception).
- PC switched off or asleep: cannot be online; the other devices show "off since 6:42 PM" and it reconnects by itself at the next start. Later option: wake it from the phone over Wi-Fi (Wake-on-LAN) when on the same network.

### Window and message rules (Boss, 2026-10-16)
- "YouTube kholo" must bring the window to the FRONT and show it on screen (not open in the background). Also: maximize / minimize / bada karo / chhota karo / half screen / band karo for the front window. Handle every phrasing.
- Remote "Message" button: type your own text (emoji keyboard allowed) and it shows as a notification on the chosen device, with emojis.

### Independence from Claude (Boss, 2026-10-16)
The 4 devices, remote control, voice, chat and the whole company run on Coco Cloud (Supabase + Gemini + device apps) and the local AI (Ollama). They never need Claude to work. Claude is one tool Coco calls only for hard work (code, scripts, big builds); if Claude is out of limit, everything else keeps running.

## Rules that stay
- Nothing in git that is a key. Non-family messages need a YES. Commands older than 10 minutes never run.

## Big upgrade plan v3 (Boss, 2026-10-21) — planning only, build after Boss says YES
Boss's points: app feels static/hardcoded; Coco must stay connected without opening the app (also offline / same Wi-Fi);
Lulu shows a browser logo instead of the extension's own logo; chat must be a "second Claude" with full access, fast, and must understand him;
Control tab must be simple and instant; "work like a mouse for Boss PC" must just work; app learns from mistakes and updates itself
to a good version without Boss; daily updates are slow; YouTube channel taps must show real-time data; every page simple, same theme,
continuous circular Material You motion.

1. Live data everywhere: one "live" table set in Coco Cloud (tasks now/next, team state, channel stats) written by the real workers
   (yt-brain, ext-brain, os.mjs, Coco Engine) the moment something changes; app subscribes over Realtime. Nothing hardcoded;
   every card shows "updated X sec ago"; stale > 10 min shows grey.
2. Always connected: phone foreground service + boot start; PC tray app with watchdog. Three paths, first that works wins:
   same Wi-Fi direct (LAN, ~10-50 ms), Coco Cloud realtime (~0.3-1 s), offline queue (runs when back online).
3. Control tab: one big mic + 6 big tiles (Mouse, Media, Volume, Open, Lock, Find PC); long-press for more. Mouse mode = touchpad on the
   phone screen, sent over LAN as tiny packets (feels instant), cloud fallback.
4. Chat = second Claude: questions answered by the cloud brain (Gemini fast for chat, Coco Engine/Claude for real work), with live access to
   tasks, channels, devices, memory. Streams the answer word by word. Understands Hinglish/Marathi voice text.
5. Self-learning + self-update: every failed command/chat is logged; nightly Coco fixes it, runs tests, ships to Boss phone first (canary),
   auto-rollback if crash or errors rise; then Big Boss phone. Silent APK update after the one-time setup.
6. YouTube: tap a channel = live page (views, subs, last video, today's numbers) from the YouTube API, refreshed every few minutes.
7. Lulu: use each extension's own icon (from its manifest/store listing), not the browser logo.
8. Design: same Coco theme, Material You shapes (rounded "squircle" cards, wavy circular progress), slow continuous circular motion
   on the Coco orb and loading states; respects "calm" mode.

### Same plan for BOTH apps (Boss, 2026-10-21)
Every point above applies to the phone APK and the PC app (Lounge Desktop) alike: same live data, same chat brain, same simple
Control layout, same theme and circular motion, same self-learning and self-update (PC: git pull + restart, already working;
APK: cloud bucket + silent install after the one-time setup). Feature parity check before every release: a list of features
with a tick per app; a release that drops a feature is blocked.

Per app extras:
- PC app: watchdog keeps it running; mouse/keyboard receiver for phone Mouse mode; LAN server for same-Wi-Fi commands;
  mini floating Coco bubble (always on top, drag anywhere) showing "now doing" + mic.
- APK: foreground service + boot start; touchpad Mouse mode; quick-settings tile and home-screen widget (now/next + mic);
  silent self-update.

### Extra ideas (Boss to pick)
1. Home-screen widget (phone) + floating bubble (PC): current task, next task, one-tap mic.
2. Quick Settings tile "Coco" (phone): pull down, tap, speak.
3. Lock-screen / notification controls: play-pause, volume, "Find PC", without unlocking.
4. Clipboard sync: copy on phone, paste on PC and back.
5. Share-to-Coco: share any link/photo/file from any app to a PC or the other phone.
6. Morning card at 7:00: today's plan, YouTube numbers, approvals waiting, playlist playing.
7. Smart replies on approvals: YES / NO / "later" right in the notification.
8. Routines by voice: "Coco, good night" = lock PC, stop songs, set playlist, phone silent.
9. Phone battery / PC CPU-RAM alerts and "PC offline" alert to the other devices.
10. Command history with replay and undo; favourites pinned on the Control tab.
11. Health page: 4 devices online, last sync, version on each, speed meter (ms per command).
12. "What Coco learned today" list; weekly report of fixes it shipped itself.
13. Big Boss view: same app, her own devices and contacts, shared company pages.
14. Offline mode: last known data cached with "offline" badge, commands queued.
15. Privacy switch: "Coco so jao" pauses mic + control on all devices at once; office mode auto.

Boss picked: ALL 15 extra ideas above (2026-10-21).

## Coco Habits: learn Boss's patterns and act at the right time (Boss, 2026-10-21)
Example from Boss: Rapido. Coco watches for a few days (when, from where, to where, which ride, how much), learns the pattern,
then at the usual time/place asks "Office ke liye Rapido book karun? ~Rs 85, bike" and books on YES.
How it works:
- Signals (phone, private, on-device first): time, place (coarse location / home-office Wi-Fi), app opened, notification seen
  (booking confirmations, payments SMS/UPI notifications for amount), calendar, battery, headphones.
- Pattern engine: after 3-5 repeats it proposes a habit card ("Weekdays 9:40, Home -> Office, Rapido bike, avg Rs 82").
  Boss taps Keep / Change / Never. Budget = average + max he allows.
- Action: one notification at the right moment with the price estimate and a YES button. Booking costs money, so it always
  asks unless Boss sets an auto-rule ("office ride under Rs 120: book without asking").
- Honest limits: Rapido/Uber/Ola have no public booking API for us. Coco opens the app with pickup/drop filled where the app
  allows it, then taps through with Android Accessibility (private app only, needs one permission). If the app changes its
  screens, Coco stops and asks instead of guessing. Payment screens are never tapped without Boss.
- Privacy: location and history stay on the phone and Boss's private Coco Cloud; "Coco so jao" stops it; delete-all button.

### More habit ideas (phone + laptop)
1. Rides: Rapido/Uber/Ola auto-suggest, "late? leave in 5 min" based on traffic.
2. Food: usual order at usual time (Swiggy/Zomato) with budget check.
3. Recharge & bills: mobile recharge, electricity, Wi-Fi before due date; asks first.
4. Spends: monthly spend summary from UPI/SMS notifications, category budgets, "this month you spent 30% more on food".
5. Work start: reach office Wi-Fi -> laptop office mode, Cursor opens, phone silent; reach home -> home mode, playlist.
6. Sleep: after 23:30 phone idle -> PC lock, songs stop, alarm check, tomorrow's first ride/meeting reminder.
7. Calls & messages: "Mumu ko roz 9 baje call karte ho, aaj nahi kiya" gentle nudge; birthdays from contacts.
8. Laptop: learns which apps/files Boss opens per time of day and has them ready; auto-clean Downloads weekly (asks before delete).
9. Battery: charge reminders before usual leave time; laptop charge limit.
10. Shopping: price watch on items Boss looked at, alert on drop.
11. Health: water/stand-up/walk nudges from phone activity; screen-time summary.
12. Travel: tickets from email/SMS -> reminders, cab booking near departure, boarding pass on lock screen.
13. YouTube/work: "you usually check The Flow numbers at 8 PM" -> card ready at 8.
14. Weekly "Coco learned about you" page: every habit it found, with on/off and edit.

## Boss-specific ideas v2 (2026-10-21): Coco as Boss's company remote + personal operator
Boss said the habit list was too generic. These fit his real day: running Good Space (13 YouTube channels, extensions, apps)
from his phone and two PCs, with Big Boss.
1. Company in one tap: "Coco, aaj kya hua?" -> 30-second spoken/visual brief: videos published, views today vs yesterday,
   extension installs, money in, what failed, what needs YES.
2. Say it, it gets made: "Coco, space pe ek Short banao" from the phone -> team starts on the PC/cloud, live progress bar on the
   phone (script -> voice -> render -> QA), preview plays on the phone, YES = publish.
3. Idea catcher: any idea spoken anytime (walking, in a ride) goes to the right team's inbox with a score next morning.
4. Watch the PC from the phone: live screen view of Boss PC (view-only or control), see a render, a terminal, a stuck window.
5. Phone as the PC's remote brain: "Boss PC pe Blender band karo aur render shuru karo", "laptop pe jo error aaya wo dikhao" (screenshot + Coco's fix).
6. Money view: earnings per channel / extension, costs (Claude plan, APIs), profit this month, Big Boss sees the same.
7. Competitor radar: daily "these 3 channels in your category grew fast, here's why" with a Short idea from it.
8. Approval inbox like WhatsApp: swipe right YES, left NO, voice note for "change this".
9. Two-founder room: Boss and Big Boss see each other's asks and decisions live; Coco settles who does what.
10. Coco on the go: Bluetooth earbuds = talk to Coco hands-free in a ride ("next video kab aayega?").
11. Laptop guard: if render/upload fails at night, Coco fixes or retries; morning card says what it did.
12. One "Now" screen on every device: what Coco is doing this second, what's next, what's blocked.

## Coco Save: everything Boss sees goes to the right team (Boss, 2026-10-21)
Problem: Boss keeps seeing useful things on Instagram, YouTube, X, websites, WhatsApp, screenshots, text; he can't save and
sort them, so the teams never get them.
1. Save from anywhere: Android "Share -> Coco" on any app (reel, video, post, link, text, photo); PC: right-click/tray
   "Save to Coco" + Ctrl+Shift+S hotkey; screenshot folder watch; voice "Coco, ye save karo"; copy a link = small "Save?" chip.
2. Coco reads it: link title + caption, video transcript (YouTube/Reels audio -> text), image text (OCR), who posted, views.
3. Coco sorts it: what it is (video style, hook, topic, tool, app idea, extension idea, design, quote, competitor) and which team
   it is for (YouTube channel X, Extension team, Apps, Design, Boss personal). One-line "why it's useful".
4. Teams get it: a card in that team's inbox (yt-brain / ext-brain idea) with source link + Coco's note; next morning it is scored,
   and the team says what they will do with it ("used in Short on 24 Oct" shows back on the card).
5. Boss's Saved page: simple grid by team, search ("wo AI wala reel"), filters, one tap to change team or delete; weekly
   "your saves turned into 4 videos and 1 extension idea".
6. Quality: duplicates merged; copyright respected (style/idea only, never reuse the video itself).
7. Daily Saves log (Boss, 2026-10-21): every day has its own list. Each item shows: time Boss sent it, what it was
   (reel/video/text/link + thumbnail), where it is stored (team inbox file / Coco Cloud row, tappable), which team's Ideas
   section it went to, and its status (new -> scored -> planned -> used in <video/extension> / skipped with reason).
   Phone + PC: "Saves" page opens on Today; swipe for past days; calendar view. Night summary card: "Aaj 6 saves:
   4 YouTube (The Flow 3, Kahani Ghar 1), 1 Extension, 1 personal". Also written to Good Space\Coco\memory\saves\YYYY-MM-DD.md.
8. Idea reminders (Boss, 2026-10-21): saves waiting for Boss come back as simple reminder cards, not a long list.
   Each card: thumbnail + one line "what this is" + Coco's suggestion ("Make a Short for The Flow from this hook") and 3 big
   buttons: Approve (team does it), Change (voice note: "isko Kahani Ghar ke liye karo"), Skip. Snooze = "kal yaad dilana".
   When: one bundle at a time Boss picks (default 9 PM, max 5 cards), plus a nudge if an idea is time-sensitive (trend dies fast).
   Pending count on the Saves page and home widget; ideas never get lost: after 7 days unanswered Coco decides itself
   (low-risk: team keeps it in backlog) and tells Boss.

## Structure approved (Boss, 2026-10-21)
Phone tabs: Home | Chat | Control | Saves | Company. PC: same 5 pages in a side bar + Health.
PC extras approved: tray + start with Windows + watchdog; floating bubble (Now + mic); Ctrl+Shift+S save + screenshot watch;
Wi-Fi server for phone mouse/keyboard/commands; runner (apps, window half/full, YouTube keys, render); self-update.

## Control page v2: "say anything, it happens" (Boss, 2026-10-21)
Top: device chips (Boss PC · Laptop · Big Boss PC · Phones), last used is selected.
Centre: ONE command bar (type or mic, any language): "chrome kholo, hello likho, youtube pe kesariya chalao, 10 sec aage".
  -> Coco turns it into steps and shows them live as a checklist (✓ done / ⏳ running / ✗ failed + why + Retry).
  -> anything the runner can't do yet: Coco tells which step, logs it, and the nightly self-learning adds it.
Live screen strip: small live view of the chosen PC (tap = full screen; in Mouse mode the phone screen is a touchpad over it).
Smart tiles (change by what's running): YouTube open -> Play/Pause, -10, +10, Next, Fullscreen, Volume; Chrome -> New tab, Back,
  Close tab; nothing -> Mouse, Keyboard, Open app, Lock, Find PC, Volume.
Keyboard mode: phone keyboard types straight into the PC (Hindi too), shortcuts row (Ctrl+C/V/Z, Alt+Tab, Win).
Bottom: Favourites (pinned sentences, one tap) · History (replay / undo).
Speed: same Wi-Fi direct path first; every step shows its ms. Safety: shutdown, sending messages to non-family, payments ->
  confirm button.
Command bar brain (Boss: "understand anything, like Claude"):
- 3 layers, fastest first: (1) instant rules on the device for common phrases (<50 ms); (2) cloud AI brain (Gemini Flash,
  ~1 s) for everything else: any language, typos, Hinglish voice text, "isko", "wo wala", multi-step; (3) offline: local
  Ollama on the PC when there is no internet.
- The brain sees context: chosen device, open windows/apps, what is playing, last 10 commands, Boss's favourites and habits.
- Output is always a step plan in a fixed action list (open_app, type, key, click, window, media, open_url, play_youtube, file,
  message, power...); the runner checks each step, so the AI can never run arbitrary code.
- Unclear? It asks ONE short question with buttons ("Kaunsa Chrome profile?") instead of failing.
- Can't do a step? It says why, offers the closest thing, logs it; nightly self-learning adds the missing action.
- Test set of 200 real Boss sentences (Hindi/Marathi/English/mixed) must pass >95% before every release.
Needs: GEMINI_API_KEY in Coco Cloud secrets.

## All 4 devices (Boss, 2026-10-21)
Everything in this plan ships on all four: Boss PC, Boss phone, Big Boss PC, Big Boss phone. Same app version, same features,
same command bar brain; any device can control any other device (with the same safety rules). Each founder sees and controls
her/his own devices by default; the other founder's devices only for harmless actions unless they allow more.
Release order every time: Boss phone + Boss PC first (canary) -> if healthy for 24 h -> Big Boss devices.
Big Boss setup needs her one-time steps: install 2.2.0 APK once (tap + allow "install unknown apps"), PC app once.
