@echo off
rem Good Space: connect every YouTube channel that is not connected yet, one after another.
rem Before running: each channel must already exist under sampleshoppp@gmail.com (YouTube > Settings > Add or manage your channels > Create a channel).
rem For each channel a link and a code appear. Open the link on your phone, enter the code, log in as sampleshoppp@gmail.com
rem and pick THAT channel in the chooser (not The Flow). A wrong pick is refused and you can try again.
cd /d "%USERPROFILE%\nova-hq"
for %%S in (biology-health history-geography stories human-behaviour study money mixed ai-software food devotional feminism) do (
  echo.
  echo ===== %%S =====
  node scripts\yt-local.mjs channels | findstr /b /c:"CONNECTED  %%S " >nul && (echo already connected) || node scripts\yt-local.mjs connect %%S
)
echo.
node scripts\yt-local.mjs channels
pause
