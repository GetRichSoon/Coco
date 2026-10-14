# The Grand Estate

Good Space drawn as a private island estate: Coco's palace, the four Houses, the Bonbon Club,
the Shared Shelf and the platform balloons.

| Name | What it is |
|---|---|
| Estate Architect.py | Blender script that builds the estate and renders it (day + night, 24 angles) |
| Grand Estate.blend | the Blender scene it saves (open in Blender to edit by hand) |
| Portraits | the rendered pictures + hotspots.json used by the web page |
| Motion Picture | the 8 second looping film of the team at work (Estate in Motion.mp4) + poster + label positions |
| Gallery | the web pages: Estate Map (flat), Estate in 3D (live), Estate Showcase (Blender) |

Published pages (private to the founders until shared):
- Estate Showcase (Blender, main): https://claude.ai/artifact/ERVbspiqA1BbTQ5kWD4SJB
- Estate Map (flat): https://claude.ai/artifact/RkBcG9nwzJ1yRErqLjyMPU

Re-render: `blender -b -P "Estate Architect.py" -- Portraits 24 1280 720`

Re-render the film: `blender -b -P "Estate Architect.py" -- "Motion Picture" 192 1280 720 film`
