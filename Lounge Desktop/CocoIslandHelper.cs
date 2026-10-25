// Coco Island helper: one small resident process for the desktop island. Writes one JSON line on stdout when something changes:
//   {"t":"media","title":..,"artist":..,"app":..,"playing":true}   from Windows' media controls (any player: Brave, Spotify...)
//   {"t":"media","none":true}                                       nothing is playing any more
//   {"t":"full","on":true|false}                                    the window in front covers the whole screen (video, game)
//   {"t":"net","ssid":..,"signal":80,"on":true}                     Wi-Fi name and strength (every 10 s, only when changed)
//   {"t":"bright","level":60}                                       screen brightness (laptop panel; absent on desktop monitors)
//   {"t":"max","on":true|false}                                     the window in front is maximised (its title/tab bar is at the top)
//   {"t":"procs","names":["brave","code",...]}                     programs with a window (for the Dock's open dots), when changed
// Reads commands on stdin: "bright <0-100>", "focus <process name>" (bring its window to the front), "start" (Start menu),
// "autohide on|off" (Windows taskbar auto-hide), "taskbar hide|show" (the Coco Dock replaces it; kept hidden until "show"). Exits when Coco closes its stdin.
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

static partial class Program
{
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern bool PostMessage(IntPtr h, uint msg, IntPtr w, IntPtr l);
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
        // Never wait more than 3 s: a call that hangs (radios without access) must not stop the island's loop.
        for (int i = 0; i < 600 && op.Status == AsyncStatus.Started; i++) Thread.Sleep(5);
        if (op.Status == AsyncStatus.Started) { try { op.Cancel(); } catch (Exception) { } throw new TimeoutException("WinRT call took over 3 s"); }
        return op.GetResults();
    }

    static string last = "", lastArtTitle = "", lastArt = "";
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
                if (p.Title != lastArtTitle) { lastArtTitle = p.Title; lastArt = ArtOf(p); }   // the picture is read once per song
                line = "{\"t\":\"media\",\"title\":" + J(p.Title) + ",\"artist\":" + J(p.Artist) + ",\"app\":" + J(s.SourceAppUserModelId) + ",\"playing\":" + (playing ? "true" : "false") + ",\"art\":" + J(lastArt) + "}";
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

    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int cmd);
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
    [DllImport("user32.dll")] static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
    [DllImport("shell32.dll")] static extern IntPtr SHAppBarMessage(uint msg, ref APPBARDATA d);
    [StructLayout(LayoutKind.Sequential)] struct APPBARDATA { public int cbSize; public IntPtr hWnd; public uint cb; public uint edge; public RECT rc; public IntPtr lParam; }
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern IntPtr FindWindow(string cls, string title);

    static string lastProcs = "";
    static void Procs()
    {
        var names = new System.Collections.Generic.SortedSet<string>();
        foreach (Process p in Process.GetProcesses()) { try { if (p.MainWindowHandle != IntPtr.Zero) names.Add(p.ProcessName.ToLowerInvariant()); } catch (Exception) { } }
        string line = "{\"t\":\"procs\",\"names\":[" + string.Join(",", System.Linq.Enumerable.Select(names, J)) + "]}";
        if (line != lastProcs) { lastProcs = line; Emit(line); }
    }

    // Windows only lets the app in front hand over focus; a tap of Alt first is the documented way around that for a user click.
    static void Focus(string name)
    {
        foreach (Process p in Process.GetProcessesByName(name))
        {
            IntPtr h = p.MainWindowHandle; if (h == IntPtr.Zero) continue;
            keybd_event(0x12, 0, 0, UIntPtr.Zero); keybd_event(0x12, 0, 2, UIntPtr.Zero);
            if (IsIconic(h)) ShowWindow(h, 9);
            SetForegroundWindow(h);
            return;
        }
    }

    static void AutoHide(bool on)
    {
        APPBARDATA d = new APPBARDATA(); d.cbSize = Marshal.SizeOf(typeof(APPBARDATA)); d.hWnd = FindWindow("Shell_TrayWnd", null);
        d.lParam = (IntPtr)(on ? 1 : 2);   // ABS_AUTOHIDE / ABS_ALWAYSONTOP
        SHAppBarMessage(10, ref d);        // ABM_SETSTATE
    }

    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
    static bool hideBar = false;
    // Explorer brings the taskbar back now and then (Start, new monitor); while the Dock runs it is hidden again within a second.
    static void Bars(bool show)
    {
        foreach (string cls in new[] { "Shell_TrayWnd", "Shell_SecondaryTrayWnd" })
        {
            IntPtr h = FindWindow(cls, null);
            if (h != IntPtr.Zero && IsWindowVisible(h) != show) ShowWindow(h, show ? 5 : 0);
        }
    }

    // Maximised = its top edge is the screen's top edge and it spans the width (Chrome and VS Code draw their own bar).
    static bool Maximised()
    {
        IntPtr h = GetForegroundWindow();
        if (h == IntPtr.Zero || IsIconic(h)) return false;
        if (IsZoomed(h)) return true;
        RECT r; if (!GetWindowRect(h, out r)) return false;
        MONITORINFO mi = new MONITORINFO(); mi.cbSize = Marshal.SizeOf(typeof(MONITORINFO));
        if (!GetMonitorInfo(MonitorFromWindow(h, 2), ref mi)) return false;
        return r.T <= mi.work.T + 2 && r.L <= mi.work.L + 10 && r.R >= mi.work.R - 10;
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
                    Match f = Regex.Match(cmd, @"^focus ([\w .-]{1,60})$");
                    if (f.Success) Focus(f.Groups[1].Value);
                    if (cmd == "start") { keybd_event(0x5B, 0, 0, UIntPtr.Zero); keybd_event(0x5B, 0, 2, UIntPtr.Zero); }
                    if (cmd == "autohide on" || cmd == "autohide off") AutoHide(cmd.EndsWith("on"));
                    Match v = Regex.Match(cmd, @"^vol (\d{1,3})$");
                    if (v.Success) SetVol(int.Parse(v.Groups[1].Value));
                    if (cmd == "mute") ToggleMute();
                    Match fh = Regex.Match(cmd, @"^focushwnd (\d{1,19})$");
                    if (fh.Success) FocusHwnd(long.Parse(fh.Groups[1].Value));
                    Match ch = Regex.Match(cmd, @"^closehwnd (\d{1,19})$");
                    if (ch.Success) PostMessage(new IntPtr(long.Parse(ch.Groups[1].Value)), 0x10, IntPtr.Zero, IntPtr.Zero);   // WM_CLOSE: the app may still ask to save
                    Match mh = Regex.Match(cmd, @"^minhwnd (\d{1,19})$");
                    if (mh.Success) MinHwnd(long.Parse(mh.Groups[1].Value));
                    Match rd = Regex.Match(cmd, @"^radio (wifi|bt) (on|off)$");
                    if (rd.Success) SetRadio(rd.Groups[1].Value, rd.Groups[2].Value == "on");
                    // slow calls (scan, connect, device list) run on their own thread so the island never waits
                    if (cmd == "wifi scan") new Thread(WifiScan) { IsBackground = true }.Start();
                    if (cmd == "bt list") new Thread(BtList) { IsBackground = true }.Start();
                    if (cmd.StartsWith("wifi connect ")) { string id = cmd.Substring(13); new Thread(() => WifiConnect(id, null)) { IsBackground = true }.Start(); }
                    if (cmd.StartsWith("wifi join ") && cmd.IndexOf('	') > 10) { string id = cmd.Substring(10, cmd.IndexOf('	') - 10), pw = cmd.Substring(cmd.IndexOf('	') + 1); new Thread(() => WifiConnect(id, pw)) { IsBackground = true }.Start(); }
                    if (cmd.StartsWith("wifi pass ")) { string id = cmd.Substring(10); new Thread(() => WifiPassword(id)) { IsBackground = true }.Start(); }
                    if (cmd == "taskbar hide") { hideBar = true; AutoHide(true); Bars(false); }
                    if (cmd == "taskbar show") { hideBar = false; Bars(true); AutoHide(false); }
                }
            }
            catch (Exception) { }
            if (hideBar) Bars(true);   // Coco is gone (quit or killed): never leave the PC without a taskbar
            Environment.Exit(0);
        }) { IsBackground = true }.Start();

        bool full = false, max = false;
        Emit("{\"t\":\"max\",\"on\":false}");
        int tick = 0;
        Emit("{\"t\":\"full\",\"on\":false}");
        while (true)
        {
            // WinRT events need SDK files this PC lacks, and Windows has no "went full screen" event, so both are looked at
            // once a second; a line is written only when something changed.
            if (mgr != null) Media();
            bool f = Fullscreen();
            if (f != full) { full = f; Emit("{\"t\":\"full\",\"on\":" + (f ? "true" : "false") + "}"); }
            bool mx = !f && Maximised();
            if (mx != max) { max = mx; Emit("{\"t\":\"max\",\"on\":" + (mx ? "true" : "false") + "}"); }
            if (hideBar) Bars(false);
            if (tick % 4 == 0) Procs();
            if (tick % 2 == 0) Wins();
            if (tick % 2 == 0) Vol();
            if (tick % 8 == 0) Radios();
            if (tick++ % 20 == 0) { Net(); Bright(); }   // Wi-Fi and brightness change rarely: every 10 s
            Thread.Sleep(500);
        }
    }
}
