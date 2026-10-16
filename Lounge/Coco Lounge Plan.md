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

## Rules that stay
- Nothing in git that is a key. Non-family messages need a YES. Commands older than 10 minutes never run.
