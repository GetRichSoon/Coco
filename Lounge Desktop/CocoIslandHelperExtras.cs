// Coco Island helper, part 2 (compiled together with CocoIslandHelper.cs): volume, Wi-Fi/Bluetooth radios, album art,
// and the open program windows for the Dock. Lines written:
//   {"t":"vol","level":40,"mute":false}
//   {"t":"radio","wifi":true,"bt":false}            (a radio this PC does not have is left out)
//   {"t":"wins","list":[{"name":"chrome","path":"C:\\...\\chrome.exe","title":".."}]}
//   {"t":"wifilist","list":[{"ssid":..,"bars":3,"secure":true,"saved":true,"now":false}]}   after "wifi scan"
//   {"t":"wifiresult","ssid":..,"ok":true,"why":".."}                                    after a connect
//   {"t":"btlist","list":[{"name":..,"connected":true}]}                                after "bt list"
// Commands: "vol <0-100>", "mute", "radio wifi|bt on|off", "wifi scan", "wifi connect <ssid>", "wifi join <ssid><TAB><password>",
// "bt list". The password only goes to Windows' own connect call; it is never written to disk or printed.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Runtime.InteropServices;
using System.Threading;
using Windows.Foundation;
using Windows.Devices.Radios;
using Windows.Devices.WiFi;
using Windows.Devices.Bluetooth;
using Windows.Devices.Enumeration;
using Windows.Security.Credentials;
using Windows.Storage.Streams;

static partial class Program
{
    // ---- Core Audio: the default speaker's master volume (the same slider as the Windows volume flyout) ----
    [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumerator { }
    [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDeviceEnumerator { int NotImpl1(); [PreserveSig] int GetDefaultAudioEndpoint(int flow, int role, out IMMDevice dev); }
    [Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IMMDevice { [PreserveSig] int Activate(ref Guid iid, int ctx, IntPtr p, [MarshalAs(UnmanagedType.IUnknown)] out object o); }
    [Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IAudioEndpointVolume
    {
        int RegisterControlChangeNotify(IntPtr n); int UnregisterControlChangeNotify(IntPtr n); int GetChannelCount(out int c);
        int SetMasterVolumeLevel(float db, Guid ctx); int SetMasterVolumeLevelScalar(float level, ref Guid ctx);
        int GetMasterVolumeLevel(out float db); int GetMasterVolumeLevelScalar(out float level);
        int SetChannelVolumeLevel(uint ch, float db, Guid ctx); int SetChannelVolumeLevelScalar(uint ch, float level, Guid ctx);
        int GetChannelVolumeLevel(uint ch, out float db); int GetChannelVolumeLevelScalar(uint ch, out float level);
        int SetMute([MarshalAs(UnmanagedType.Bool)] bool mute, ref Guid ctx); int GetMute([MarshalAs(UnmanagedType.Bool)] out bool mute);
    }

    static IAudioEndpointVolume Speaker()
    {
        IMMDevice dev;
        if (((IMMDeviceEnumerator)new MMDeviceEnumerator()).GetDefaultAudioEndpoint(0, 1, out dev) != 0) return null;
        Guid iid = typeof(IAudioEndpointVolume).GUID; object o;
        return dev.Activate(ref iid, 23, IntPtr.Zero, out o) == 0 ? (IAudioEndpointVolume)o : null;
    }

    static string lastVol = "";
    static void Vol()
    {
        try
        {
            var v = Speaker(); if (v == null) return;
            float l; bool m; v.GetMasterVolumeLevelScalar(out l); v.GetMute(out m);
            string line = "{\"t\":\"vol\",\"level\":" + (int)Math.Round(l * 100) + ",\"mute\":" + (m ? "true" : "false") + "}";
            if (line != lastVol) { lastVol = line; Emit(line); }
        }
        catch (Exception) { }
    }
    static void SetVol(int level)
    {
        try { var v = Speaker(); Guid g = Guid.Empty; if (v != null) { v.SetMute(false, ref g); v.SetMasterVolumeLevelScalar(Math.Max(0, Math.Min(100, level)) / 100f, ref g); } } catch (Exception) { }
        Vol();
    }
    static void ToggleMute()
    {
        try { var v = Speaker(); Guid g = Guid.Empty; bool m; if (v != null) { v.GetMute(out m); v.SetMute(!m, ref g); } } catch (Exception) { }
        Vol();
    }

    // ---- Wi-Fi and Bluetooth radios (the same switches as Quick Settings; no admin needed) ----
    static IReadOnlyList<Radio> radios;
    static string lastRadio = "";
    static bool radiosBroken = false;   // after one failure the radio tiles fall back to opening Settings
    static void Radios()
    {
        if (radiosBroken) return;
        try
        {
            if (radios == null) { Radio.RequestAccessAsync().Wait(); radios = Radio.GetRadiosAsync().Wait(); }
            var parts = new List<string>();
            foreach (Radio r in radios)
            {
                if (r.Kind == RadioKind.WiFi) parts.Add("\"wifi\":" + (r.State == RadioState.On ? "true" : "false"));
                if (r.Kind == RadioKind.Bluetooth) parts.Add("\"bt\":" + (r.State == RadioState.On ? "true" : "false"));
            }
            string line = "{\"t\":\"radio\"," + string.Join(",", parts.Distinct().ToArray()) + "}";
            if (line != lastRadio) { lastRadio = line; Emit(line); }
        }
        catch (Exception e) { radiosBroken = true; Emit("{\"t\":\"error\",\"what\":" + J("radios: " + e.Message) + "}"); }
    }
    static void SetRadio(string kind, bool on)
    {
        try
        {
            if (radios == null) Radios();
            foreach (Radio r in radios)
                if ((kind == "wifi" && r.Kind == RadioKind.WiFi) || (kind == "bt" && r.Kind == RadioKind.Bluetooth))
                    r.SetStateAsync(on ? RadioState.On : RadioState.Off).Wait();
        }
        catch (Exception) { }
        Radios();
    }

    // ---- album art of the song playing (a small JPEG/PNG as a data URL, read once per song) ----
    static string ArtOf(Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties p)
    {
        try
        {
            if (p.Thumbnail == null) return "";
            var s = p.Thumbnail.OpenReadAsync().Wait();
            if (s.Size == 0 || s.Size > 600000) return "";
            var r = new DataReader(s.GetInputStreamAt(0));
            uint n = r.LoadAsync((uint)s.Size).Wait();
            byte[] b = new byte[n]; r.ReadBytes(b);
            return "data:" + (string.IsNullOrEmpty(s.ContentType) ? "image/png" : s.ContentType) + ";base64," + Convert.ToBase64String(b);
        }
        catch (Exception) { return ""; }
    }

    // ---- open windows for the Dock: every top-level app window (like the taskbar), not one per program ----
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc p, IntPtr lp);
    delegate bool EnumProc(IntPtr h, IntPtr lp);
    [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr h, uint cmd);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowTextW(IntPtr h, System.Text.StringBuilder s, int n);
    [DllImport("user32.dll")] static extern int GetWindowLongW(IntPtr h, int i);
    [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h, int attr, out int v, int size);

    static string lastWins = "", lastProcs2 = "";
    static readonly Dictionary<uint, string[]> procInfo = new Dictionary<uint, string[]>();
    static void Wins()
    {
        var items = new List<string>();
        var live = new HashSet<uint>();
        var names2 = new List<string>();
        EnumWindows((h, lp) =>
        {
            if (!IsWindowVisible(h) || GetWindow(h, 4) != IntPtr.Zero) return true;            // hidden, or owned (dialogs)
            int ex = GetWindowLongW(h, -20);
            if ((ex & 0x80) != 0 && (ex & 0x40000) == 0) return true;                              // tool window, not forced into the taskbar
            int cloaked; if (DwmGetWindowAttribute(h, 14, out cloaked, 4) == 0 && cloaked != 0) return true;   // other desktop / suspended app
            var t = new System.Text.StringBuilder(256); GetWindowTextW(h, t, 256);
            if (t.Length == 0) return true;
            uint pid; GetWindowThreadProcessId(h, out pid); live.Add(pid);
            string[] info;
            if (!procInfo.TryGetValue(pid, out info))
            {
                info = new[] { "", "" };
                try { var p = Process.GetProcessById((int)pid); info[0] = p.ProcessName.ToLowerInvariant(); try { info[1] = p.MainModule.FileName; } catch (Exception) { } } catch (Exception) { }
                procInfo[pid] = info;
            }
            if (info[0] == "electron" || info[0] == "textinputhost" || info[0] == "explorer" && t.ToString() == "Program Manager") return true;
            string title = t.ToString(); if (title.Length > 90) title = title.Substring(0, 90);
            names2.Add(info[0]);
            items.Add("{\"hwnd\":" + h.ToInt64() + ",\"name\":" + J(info[0]) + ",\"path\":" + J(info[1]) + ",\"title\":" + J(title) + "}");
            return true;
        }, IntPtr.Zero);
        foreach (uint gone in procInfo.Keys.Where(k => !live.Contains(k)).ToList()) procInfo.Remove(gone);
        string line = "{\"t\":\"wins\",\"front\":" + GetForegroundWindow().ToInt64() + ",\"list\":[" + string.Join(",", items.ToArray()) + "]}";
        if (line != lastWins) { lastWins = line; Emit(line); }
        // "procs" for the Dock's open dots = the program names behind these same windows (before: a second pass over every process)
        var names = new System.Collections.Generic.SortedSet<string>(); foreach (var kv in names2) names.Add(kv);
        string pl = "{\"t\":\"procs\",\"names\":[" + string.Join(",", System.Linq.Enumerable.Select(names, J)) + "]}";
        if (pl != lastProcs2) { lastProcs2 = pl; Emit(pl); }
    }

    static void MinHwnd(long n) { ShowWindow(new IntPtr(n), 6); }

    static void FocusHwnd(long n)
    {
        IntPtr h = new IntPtr(n);
        keybd_event(0x12, 0, 0, UIntPtr.Zero); keybd_event(0x12, 0, 2, UIntPtr.Zero);
        if (IsIconic(h)) ShowWindow(h, 9);
        SetForegroundWindow(h);
    }

    // ---- Wi-Fi list and connect (Windows' Wi-Fi API: a real scan, saved and new networks) ----
    static WiFiAdapter wifi;
    static WiFiAdapter Adapter()
    {
        if (wifi != null) return wifi;
        WiFiAdapter.RequestAccessAsync().Wait();
        var all = WiFiAdapter.FindAllAdaptersAsync().Wait();
        wifi = all.Count > 0 ? all[0] : null;
        return wifi;
    }

    static void WifiScan()
    {
        try
        {
            var a = Adapter(); if (a == null) { Emit("{\"t\":\"wifilist\",\"list\":[],\"why\":\"No Wi-Fi adapter\"}"); return; }
            var done = a.ScanAsync(); for (int i = 0; i < 1600 && done.Status == AsyncStatus.Started; i++) Thread.Sleep(5);   // a scan takes 2-4 s
            string now = "";
            try { var p = a.NetworkAdapter.GetConnectedProfileAsync().Wait(); if (p != null) now = p.ProfileName; } catch (Exception) { }
            var saved = new HashSet<string>(SavedProfiles());
            var best = new Dictionary<string, WiFiAvailableNetwork>();
            foreach (var n in a.NetworkReport.AvailableNetworks)
                if (!string.IsNullOrEmpty(n.Ssid) && (!best.ContainsKey(n.Ssid) || best[n.Ssid].SignalBars < n.SignalBars)) best[n.Ssid] = n;
            var items = best.Values.OrderByDescending(n => n.Ssid == now).ThenByDescending(n => n.SignalBars).Take(15).Select(n =>
                "{\"ssid\":" + J(n.Ssid) + ",\"bars\":" + n.SignalBars + ",\"secure\":" + (n.SecuritySettings.NetworkAuthenticationType.ToString() != "Open80211" ? "true" : "false") +
                ",\"saved\":" + (saved.Contains(n.Ssid) ? "true" : "false") + ",\"now\":" + (n.Ssid == now ? "true" : "false") + "}");
            Emit("{\"t\":\"wifilist\",\"list\":[" + string.Join(",", items.ToArray()) + "]}");
        }
        catch (Exception e) { Emit("{\"t\":\"wifilist\",\"list\":[],\"why\":" + J(e.Message) + "}"); }
    }

    static IEnumerable<string> SavedProfiles()
    {
        var list = new List<string>();
        try
        {
            ProcessStartInfo psi = new ProcessStartInfo("netsh", "wlan show profiles");
            psi.UseShellExecute = false; psi.RedirectStandardOutput = true; psi.CreateNoWindow = true;
            string o; using (Process p = Process.Start(psi)) { o = p.StandardOutput.ReadToEnd(); p.WaitForExit(5000); }
            foreach (System.Text.RegularExpressions.Match m in System.Text.RegularExpressions.Regex.Matches(o, @"Profile\s*:\s*(.+?)\s*$", System.Text.RegularExpressions.RegexOptions.Multiline)) list.Add(m.Groups[1].Value);
        }
        catch (Exception) { }
        return list;
    }

    // The password of a network THIS PC has already saved (same as Windows Settings > "Show password"). Owner's own
    // networks only: netsh can only read profiles stored on this machine, never a network we have not joined.
    static void WifiPassword(string ssid)
    {
        string pw = "", why = "";
        try
        {
            ProcessStartInfo psi = new ProcessStartInfo("netsh", "wlan show profile name=\"" + ssid.Replace("\"", "") + "\" key=clear");
            psi.UseShellExecute = false; psi.RedirectStandardOutput = true; psi.CreateNoWindow = true;
            string o; using (Process p = Process.Start(psi)) { o = p.StandardOutput.ReadToEnd(); p.WaitForExit(5000); }
            var m = System.Text.RegularExpressions.Regex.Match(o, @"Key Content\s*:\s*(.+?)\s*$", System.Text.RegularExpressions.RegexOptions.Multiline);
            if (m.Success) pw = m.Groups[1].Value;
            else if (System.Text.RegularExpressions.Regex.IsMatch(o, @"Security key\s*:\s*Absent")) why = "This is an open network, it has no password";
            else why = "Not saved on this PC";
        }
        catch (Exception e) { why = e.Message; }
        Emit("{\"t\":\"wifipass\",\"ssid\":" + J(ssid) + ",\"password\":" + J(pw) + ",\"why\":" + J(why) + "}");
    }

    static void WifiConnect(string ssid, string password)
    {
        string why = "";
        bool ok = false;
        try
        {
            var a = Adapter();
            WiFiAvailableNetwork net = a == null ? null : a.NetworkReport.AvailableNetworks.FirstOrDefault(n => n.Ssid == ssid);
            if (net == null && a != null)
            {
                // At a new place the network may not be in the last scan yet: scan once more, then look again.
                var sc = a.ScanAsync(); for (int i = 0; i < 1600 && sc.Status == AsyncStatus.Started; i++) Thread.Sleep(5);
                net = a.NetworkReport.AvailableNetworks.FirstOrDefault(n => n.Ssid == ssid);
            }
            if (net == null) why = "Network not in range";
            else
            {
                IAsyncOperation<WiFiConnectionResult> op = password == null
                    ? a.ConnectAsync(net, WiFiReconnectionKind.Automatic)
                    : a.ConnectAsync(net, WiFiReconnectionKind.Automatic, new PasswordCredential { Password = password });
                for (int i = 0; i < 3000 && op.Status == AsyncStatus.Started; i++) Thread.Sleep(5);   // up to 15 s
                var r = op.Status == AsyncStatus.Completed ? op.GetResults().ConnectionStatus : WiFiConnectionStatus.Timeout;
                ok = r == WiFiConnectionStatus.Success;
                why = ok ? "" : r == WiFiConnectionStatus.InvalidCredential ? "Wrong password" : r.ToString();
            }
        }
        catch (Exception e) { why = e.Message; }
        Emit("{\"t\":\"wifiresult\",\"ssid\":" + J(ssid) + ",\"ok\":" + (ok ? "true" : "false") + ",\"why\":" + J(why) + "}");
        Net();
    }

    // ---- Bluetooth: paired devices and whether each is connected (connecting is done in Windows Settings) ----
    static void BtList()
    {
        try
        {
            var devs = DeviceInformation.FindAllAsync(BluetoothDevice.GetDeviceSelectorFromPairingState(true)).Wait();
            var items = new List<string>();
            foreach (var d in devs.Take(12))
            {
                bool c = false;
                try { var b = BluetoothDevice.FromIdAsync(d.Id).Wait(); c = b != null && b.ConnectionStatus == BluetoothConnectionStatus.Connected; } catch (Exception) { }
                items.Add("{\"name\":" + J(d.Name) + ",\"connected\":" + (c ? "true" : "false") + "}");
            }
            Emit("{\"t\":\"btlist\",\"list\":[" + string.Join(",", items.ToArray()) + "]}");
        }
        catch (Exception e) { Emit("{\"t\":\"btlist\",\"list\":[],\"why\":" + J(e.Message) + "}"); }
    }
}
