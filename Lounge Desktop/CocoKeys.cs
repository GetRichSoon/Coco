// Coco Keys: presses one media or volume key, a few times. Used by Coco Lounge for phone commands.
// Usage: CocoKeys.exe <key> [times]   key = playpause | next | prev | mute | up | down
using System;
using System.Runtime.InteropServices;
static class CocoKeys {
    [DllImport("user32.dll")] static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
    static int Main(string[] a) {
        if (a.Length < 1) return 1;
        byte vk;
        switch (a[0]) {
            case "playpause": vk = 0xB3; break; case "next": vk = 0xB0; break; case "prev": vk = 0xB1; break;
            case "mute": vk = 0xAD; break; case "down": vk = 0xAE; break; case "up": vk = 0xAF; break;
            default: return 2;
        }
        int times = 1; if (a.Length > 1) int.TryParse(a[1], out times);
        times = Math.Max(1, Math.Min(10, times));
        for (int i = 0; i < times; i++) { keybd_event(vk, 0, 1, UIntPtr.Zero); keybd_event(vk, 0, 3, UIntPtr.Zero); }
        return 0;
    }
}
