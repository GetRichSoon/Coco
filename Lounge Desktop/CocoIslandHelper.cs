// Coco Island helper: one small resident process for the desktop island. Writes one JSON line on stdout when something changes:
//   {"t":"media","title":..,"artist":..,"app":..,"playing":true}   from Windows' media controls (any player: Brave, Spotify...)
//   {"t":"media","none":true}                                       nothing is playing any more
//   {"t":"full","on":true|false}                                    the window in front covers the whole screen (video, game)
//   {"t":"net","ssid":..,"signal":80,"on":true}                     Wi-Fi name and strength (every 10 s, only when changed)
//   {"t":"bright","level":60}                                       screen brightness (laptop panel; absent on desktop monitors)
// Reads one command on stdin: "bright <0-100>". Exits when Coco closes its stdin.
// Build: see build-island-helper.cmd
using System;
using System.Diagnostics;
using System.Management;
using System.Runtime.InteropServices;
using System.Text.RegularExpressions;
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
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
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

    static string lastNet = "", lastBright = "";

    static void Net()
    {
        try
        {
            ProcessStartInfo psi = new ProcessStartInfo("netsh", "wlan show interfaces");
            psi.UseShellExecute = false; psi.RedirectStandardOutput = true; psi.CreateNoWindow = true;
            string o; using (Process p = Process.Start(psi)) { o = p.StandardOutput.ReadToEnd(); p.WaitForExit(5000); }
            Match ssid = Regex.Match(o, @"^\s*SSID\s*:\s*(.+?)\s*$", RegexOptions.Multiline);
            Match sig = Regex.Match(o, @"^\s*Signal\s*:\s*(\d+)%", RegexOptions.Multiline);
            bool on = Regex.IsMatch(o, @"^\s*State\s*:\s*connected", RegexOptions.Multiline | RegexOptions.IgnoreCase);
            string line = "{\"t\":\"net\",\"ssid\":" + J(on && ssid.Success ? ssid.Groups[1].Value : "") + ",\"signal\":" + (sig.Success ? sig.Groups[1].Value : "0") + ",\"on\":" + (on ? "true" : "false") + "}";
            if (line != lastNet) { lastNet = line; Emit(line); }
        }
        catch (Exception) { }
    }

    // Laptop panels only (WMI); a desktop monitor has no such object and nothing is sent.
    static void Bright()
    {
        try
        {
            using (var q = new ManagementObjectSearcher(@"root\wmi", "SELECT CurrentBrightness FROM WmiMonitorBrightness"))
                foreach (ManagementObject m in q.Get())
                {
                    string line = "{\"t\":\"bright\",\"level\":" + m["CurrentBrightness"] + "}";
                    if (line != lastBright) { lastBright = line; Emit(line); }
                    return;
                }
        }
        catch (Exception) { }
    }

    static void SetBright(int level)
    {
        try
        {
            using (var q = new ManagementObjectSearcher(@"root\wmi", "SELECT * FROM WmiMonitorBrightnessMethods"))
                foreach (ManagementObject m in q.Get()) m.InvokeMethod("WmiSetBrightness", new object[] { (uint)1, (byte)Math.Max(0, Math.Min(100, level)) });
        }
        catch (Exception) { }
        Bright();
    }

    static bool Fullscreen()
    {
        IntPtr h = GetForegroundWindow();
        if (h == IntPtr.Zero) return false;
        StringBuilder c = new StringBuilder(64); GetClassName(h, c, 64);
        string cls = c.ToString();
        if (cls == "Progman" || cls == "WorkerW" || cls == "Shell_TrayWnd") return false;   // the desktop itself
        // Explorer's own screen-sized layers (XamlExplorerHostIslandWindow, Start, Task View) are not full-screen apps.
        uint pid; GetWindowThreadProcessId(h, out pid);
        try { if (Process.GetProcessById((int)pid).ProcessName.Equals("explorer", StringComparison.OrdinalIgnoreCase)) return false; } catch (Exception) { }
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
        new Thread(() =>
        {
            try
            {
                string cmd;
                while ((cmd = Console.In.ReadLine()) != null)
                {
                    Match b = Regex.Match(cmd, @"^bright (\d{1,3})$");
                    if (b.Success) SetBright(int.Parse(b.Groups[1].Value));
                }
            }
            catch (Exception) { }
            Environment.Exit(0);
        }) { IsBackground = true }.Start();

        bool full = false;
        int tick = 0;
        Emit("{\"t\":\"full\",\"on\":false}");
        while (true)
        {
            // WinRT events need SDK files this PC lacks, and Windows has no "went full screen" event, so both are looked at
            // once a second; a line is written only when something changed.
            if (mgr != null) Media();
            bool f = Fullscreen();
            if (f != full) { full = f; Emit("{\"t\":\"full\",\"on\":" + (f ? "true" : "false") + "}"); }
            if (tick++ % 10 == 0) { Net(); Bright(); }   // Wi-Fi and brightness change rarely: every 10 s
            Thread.Sleep(1000);
        }
    }
}
