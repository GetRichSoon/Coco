' Keeps Coco Lounge (PC remote control) running all the time, window or no window (Boss, 2026-10-22).
' Run at logon and every 5 minutes by the scheduled task "Coco Lounge Keepalive"; starts it hidden only when it is not running.
Set sh = CreateObject("WScript.Shell")
Set wmi = GetObject("winmgmts:")
dir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
For Each p In wmi.ExecQuery("SELECT CommandLine FROM Win32_Process WHERE Name='electron.exe'")
  If InStr(1, p.CommandLine, "Lounge Desktop", 1) > 0 And InStr(p.CommandLine, "--type=") = 0 Then WScript.Quit
Next
sh.CurrentDirectory = dir
sh.Run """" & dir & "\node_modules\electron\dist\electron.exe"" """ & dir & """ --hidden", 0, False
