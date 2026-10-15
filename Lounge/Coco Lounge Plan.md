# Coco Lounge plan (Boss, 2026-10-15)

All four devices (Boss PC, Boss phone, Big Boss PC, Big Boss phone) work through Coco Cloud. The laptop is just a device; nothing may depend on it.

## Tonight: phone APK (Lounge Android), one build with all of this
1. **Always connected:** a foreground service ("Coco connected" in the notification bar) that keeps the live link open and reconnects by itself when the network comes back. Today the phone only wakes every 15 minutes when the app is closed.
2. **Flow and team updates as notifications:** `activity` rows with action `update` (title | detail). Code is already in `Alerts.kt` (not built yet).
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

## Rules that stay
- Nothing in git that is a key. Non-family messages need a YES. Commands older than 10 minutes never run.
