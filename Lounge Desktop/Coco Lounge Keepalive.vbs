' Keeps Coco Lounge (PC remote control) running and CONNECTED all the time, window or no window (Boss, 2026-10-22/23).
' Run at logon and every 5 minutes by the scheduled task "Coco Lounge Keepalive".
'   Not running                                -> start it hidden.
'   Running, but no heartbeat reached Coco Cloud for 8 minutes (last-beat.txt) -> it is stuck: end it and start it again.
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
Set wmi = GetObject("winmgmts:")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
beatFile = sh.ExpandEnvironmentStrings("%APPDATA%") & "\Coco Lounge\last-beat.txt"

mainPid = 0
For Each p In wmi.ExecQuery("SELECT ProcessId, CommandLine FROM Win32_Process WHERE Name='electron.exe'")
  If Not IsNull(p.CommandLine) Then
    If InStr(1, p.CommandLine, "Lounge Desktop", 1) > 0 And InStr(p.CommandLine, "--type=") = 0 Then mainPid = p.ProcessId
  End If
Next

If mainPid <> 0 Then
  stuck = False
  If fso.FileExists(beatFile) Then
    stuck = DateDiff("n", fso.GetFile(beatFile).DateLastModified, Now) >= 8
  End If
  If Not stuck Then WScript.Quit
  sh.Run "taskkill /PID " & mainPid & " /T /F", 0, True   ' the helper puts the taskbar back when Coco ends
  WScript.Sleep 3000
End If
sh.CurrentDirectory = dir
sh.Run """" & dir & "\node_modules\electron\dist\electron.exe"" """ & dir & """ --hidden", 0, False
