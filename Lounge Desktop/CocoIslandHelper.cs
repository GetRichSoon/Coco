// Coco Island helper: one small resident process for the desktop island. Writes one JSON line on stdout when something changes:
//   {"t":"media","title":..,"artist":..,"app":..,"playing":true}   from Windows' media controls (any player: Brave, Spotify...)
//   {"t":"media","none":true}                                       nothing is playing any more
//   {"t":"full","on":true|false}                                    the window in front covers the whole screen (video, game)
// Reads nothing else. Exits when Coco closes its stdin.
// Build: see build-island-helper.cmd
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using Windows.Foundation;
using Windows.Media.Control;

static class Program
{
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")] static extern IntPtr MonitorFromWindow(IntPtr h, uint flags);
    [DllImport("user32.dll")] static extern bool GetMonitorInfo(IntPtr m, ref MONITORINFO mi);
    [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr h, int i);
    [DllImport("user32.dll")] static extern bool IsZoomed(IntPtr h);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
    [StructLayout(LayoutKind.Sequential)] struct RECT { public int L, T, R, B; }
    [StructLayout(LayoutKind.Sequential)] struct MONITORINFO { public int cbSize; public RECT mon, work; public uint flags; }

    // Waits for a WinRT call without the AsTask bridge (that needs SDK files this PC does not have).
    static T Wait<T>(this IAsyncOperation<T> op)
    {
        while (op.Status == AsyncStatus.Started) Thread.Sleep(5);
        return op.GetResults();
    }

    static string last = "";
    static readonly object gate = new object();

    static string J(string s) { return "\"" + (s ?? "").Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", " ").Replace("\r", " ") + "\""; }
    static void Emit(string line) { lock (gate) { Console.Out.WriteLine(line); Console.Out.Flush(); } }

    static GlobalSystemMediaTransportControlsSessionManager mgr;

    static void Media()
    {
        try
        {
            var s = mgr.GetCurrentSession();
            string line;
            if (s == null) line = "{\"t\":\"media\",\"none\":true}";
            else
            {
                var p = s.TryGetMediaPropertiesAsync().Wait();
                var info = s.GetPlaybackInfo();
                bool playing = info.PlaybackStatus == GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing;
                line = "{\"t\":\"media\",\"title\":" + J(p.Title) + ",\"artist\":" + J(p.Artist) + ",\"app\":" + J(s.SourceAppUserModelId) + ",\"playing\":" + (playing ? "true" : "false") + "}";
            }
            if (line != last) { last = line; Emit(line); }
        }
        catch (Exception) { }
    }

    static bool Fullscreen()
    {
        IntPtr h = GetForegroundWindow();
        if (h == IntPtr.Zero) return false;
        StringBuilder c = new StringBuilder(64); GetClassName(h, c, 64);
        string cls = c.ToString();
        if (cls == "Progman" || cls == "WorkerW" || cls == "Shell_TrayWnd") return false;   // the desktop itself
        if ((GetWindowLong(h, -16) & 0x00C00000) == 0x00C00000) return false;   // has a title bar: a normal window
        if (IsZoomed(h)) return false;   // maximised (VS Code, Chrome draw their own title bar), not full screen
        RECT r; if (!GetWindowRect(h, out r)) return false;
        MONITORINFO mi = new MONITORINFO(); mi.cbSize = Marshal.SizeOf(typeof(MONITORINFO));
        if (!GetMonitorInfo(MonitorFromWindow(h, 2), ref mi)) return false;
        return r.L <= mi.mon.L && r.T <= mi.mon.T && r.R >= mi.mon.R && r.B >= mi.mon.B;
    }

    static int Main()
    {
        Console.OutputEncoding = new UTF8Encoding(false);
        try
        {
            mgr = GlobalSystemMediaTransportControlsSessionManager.RequestAsync().Wait();
            Media();
        }
        catch (Exception e) { Emit("{\"t\":\"error\",\"what\":" + J("media: " + e.Message) + "}"); }

        // Coco closing our stdin = Coco quit: stop too.
        new Thread(() => { try { while (Console.In.Read() >= 0) { } } catch (Exception) { } Environment.Exit(0); }) { IsBackground = true }.Start();

        bool full = false;
        Emit("{\"t\":\"full\",\"on\":false}");
        while (true)
        {
            // WinRT events need SDK files this PC lacks, and Windows has no "went full screen" event, so both are looked at
            // once a second; a line is written only when something changed.
            if (mgr != null) Media();
            bool f = Fullscreen();
            if (f != full) { full = f; Emit("{\"t\":\"full\",\"on\":" + (f ? "true" : "false") + "}"); }
            Thread.Sleep(1000);
        }
    }
}
