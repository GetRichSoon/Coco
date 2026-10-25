---
name: check-installed-tools
description: "When the founder says he installed a tool, check the whole PC (programs, pip, npm, winget) before saying it is missing"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 3ceab92e-2e49-587d-8804-61379ae90a67
  modified: 2026-10-14T11:32:30.754Z
---

When the founder says "I installed X on the PC" or "where is the tool I installed", check all sources before answering that it is missing:
1. Installed programs: the Uninstall registry keys (HKLM and HKCU, both 32 and 64 bit), filtered by InstallDate.
2. Python packages: `python -m pip list` for every python on PATH (`Get-Command python -All`).
3. Node globals: `npm ls -g --depth=0`.
4. Windows package folder (`%LOCALAPPDATA%\Packages`) and winget if it is on PATH (on this PC it is not).

Report what was found with the date, and say clearly which tool looks like the one he means.

**Why:** On 2026-10-14 the founder said a graph tool was installed on the PC. I searched only the repo and the Python in PATH and told him it was missing; the real check had to go wider. Recent installs were Chrome, Edge WebView2 and VS Code (13 Oct), pandas 2.2.3 and no matplotlib.

**How to apply:** Run all four checks in one go, then answer. Do not claim something is not installed until all four are checked.
