// Coco Keys: the small fast helper Coco Lounge uses for phone commands (starts in ~0.3 s; PowerShell can take 10+ s).
// Usage:
//   CocoKeys.exe <key> [times]      key = playpause | next | prev | mute | up | down
//   CocoKeys.exe type "<text>"       types the text into the window in front (Unicode, any language)
//   CocoKeys.exe combo <keys>        one shortcut, e.g. ctrl+c, alt+f4, win+d, ctrl+shift+esc, enter, esc
//   CocoKeys.exe speak "<text>"      the PC says the text out loud (Windows voice)
//   CocoKeys.exe beep                loud "find my PC" beeps
//   CocoKeys.exe closeplayer         closes Coco's YouTube player windows (one song at a time)
// Build: C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe /nologo /r:C:\Windows\Microsoft.NET\Framework64\v4.0.30319\WPF\System.Speech.dll /out:CocoKeys.exe CocoKeys.cs
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Threading;

static class CocoKeys {
    [DllImport("user32.dll")] static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
    [DllImport("user32.dll")] static extern uint SendInput(uint n, INPUT[] inputs, int size);
    [DllImport("kernel32.dll")] static extern bool Beep(uint freq, uint ms);
    delegate bool EnumProc(IntPtr h, IntPtr l);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc p, IntPtr l);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, System.Text.StringBuilder s, int n);
    [DllImport("user32.dll")] static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l);

    [StructLayout(LayoutKind.Sequential)] struct KEYBDINPUT { public ushort wVk, wScan; public uint dwFlags, time; public IntPtr extra; }
    [StructLayout(LayoutKind.Sequential)] struct MOUSEINPUT { public int dx, dy; public uint data, flags, time; public IntPtr extra; }
    [StructLayout(LayoutKind.Explicit)] struct UNION { [FieldOffset(0)] public MOUSEINPUT mi; [FieldOffset(0)] public KEYBDINPUT ki; }
    [StructLayout(LayoutKind.Sequential)] struct INPUT { public uint type; public UNION u; }
    const uint KEYUP = 2, UNICODE = 4;

    static void Tap(byte vk) { keybd_event(vk, 0, 1, UIntPtr.Zero); keybd_event(vk, 0, 3, UIntPtr.Zero); }

    static void TypeText(string s) {
        var list = new List<INPUT>();
        foreach (char c in s) {
            if (c == '\n') { list.Add(Key(0x0D, 0)); list.Add(Key(0x0D, KEYUP)); continue; }
            list.Add(Uni(c, 0)); list.Add(Uni(c, KEYUP));
        }
        var arr = list.ToArray();
        SendInput((uint)arr.Length, arr, Marshal.SizeOf(typeof(INPUT)));
    }
    static INPUT Uni(char c, uint up) { var i = new INPUT { type = 1 }; i.u.ki = new KEYBDINPUT { wScan = c, dwFlags = UNICODE | up }; return i; }
    static INPUT Key(ushort vk, uint up) { var i = new INPUT { type = 1 }; i.u.ki = new KEYBDINPUT { wVk = vk, dwFlags = up }; return i; }

    static readonly Dictionary<string, byte> Names = new Dictionary<string, byte> {
        {"ctrl",0x11},{"control",0x11},{"alt",0x12},{"shift",0x10},{"win",0x5B},{"enter",0x0D},{"esc",0x1B},{"escape",0x1B},{"tab",0x09},
        {"space",0x20},{"backspace",0x08},{"delete",0x2E},{"del",0x2E},{"up",0x26},{"down",0x28},{"left",0x25},{"right",0x27},
        {"home",0x24},{"end",0x23},{"pageup",0x21},{"pagedown",0x22},{"printscreen",0x2C}
    };
    static bool Combo(string spec) {
        var vks = new List<byte>();
        foreach (var raw in spec.ToLowerInvariant().Split('+')) {
            var k = raw.Trim(); byte vk; int n;
            if (Names.TryGetValue(k, out vk)) vks.Add(vk);
            else if (k.Length == 1 && char.IsLetterOrDigit(k[0])) vks.Add((byte)char.ToUpperInvariant(k[0]));
            else if (k.Length >= 2 && k[0] == 'f' && int.TryParse(k.Substring(1), out n) && n >= 1 && n <= 12) vks.Add((byte)(0x6F + n));
            else return false;
        }
        foreach (var vk in vks) keybd_event(vk, 0, 0, UIntPtr.Zero);
        for (int i = vks.Count - 1; i >= 0; i--) keybd_event(vks[i], 0, 2, UIntPtr.Zero);
        return true;
    }

    static int Main(string[] a) {
        if (a.Length < 1) return 1;
        switch (a[0]) {
            case "type": if (a.Length < 2) return 1; TypeText(a[1]); return 0;
            case "combo": if (a.Length < 2) return 1; return Combo(a[1]) ? 0 : 2;
            case "speak": {
                if (a.Length < 2) return 1;
                using (var s = new System.Speech.Synthesis.SpeechSynthesizer()) { s.Volume = 100; s.Speak(a[1]); }
                return 0;
            }
            case "beep": for (int i = 0; i < 6; i++) { Beep(2000, 220); Thread.Sleep(80); Beep(2600, 220); Thread.Sleep(160); } return 0;
            case "closeplayer": {
                // Closes Coco's own YouTube player windows (Brave app windows: title ends " - YouTube", never "- Brave"),
                // so only one song plays at a time. Normal browser windows are never touched.
                int n = 0;
                EnumWindows((h, l) => {
                    if (!IsWindowVisible(h)) return true;
                    var sb = new System.Text.StringBuilder(512); GetWindowText(h, sb, 512); var t = sb.ToString();
                    if (t.EndsWith(" - YouTube") || t == "YouTube") { PostMessage(h, 0x10, IntPtr.Zero, IntPtr.Zero); n++; }
                    return true;
                }, IntPtr.Zero);
                Console.Write(n); return 0;
            }
        }
        byte mk;
        switch (a[0]) {
            case "playpause": mk = 0xB3; break; case "next": mk = 0xB0; break; case "prev": mk = 0xB1; break;
            case "mute": mk = 0xAD; break; case "down": mk = 0xAE; break; case "up": mk = 0xAF; break;
            default: return 2;
        }
        int times = 1; if (a.Length > 1) int.TryParse(a[1], out times);
        times = Math.Max(1, Math.Min(10, times));
        for (int i = 0; i < times; i++) Tap(mk);
        return 0;
    }
}
