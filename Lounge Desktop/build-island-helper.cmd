@echo off
rem Builds CocoIslandHelper.exe (song info + full-screen watch for the desktop island) with the C# compiler that ships with Windows.
set F=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319
set W=%WINDIR%\System32\WinMetadata
"%F%\csc.exe" /nologo /optimize+ /target:exe /out:"%~dp0CocoIslandHelper.exe" /r:"%F%\System.Runtime.WindowsRuntime.dll" /r:"%F%\System.Runtime.dll" /r:"%F%\System.Threading.Tasks.dll" /r:"%W%\Windows.Foundation.winmd" /r:"%W%\Windows.Media.winmd" "%~dp0CocoIslandHelper.cs"
