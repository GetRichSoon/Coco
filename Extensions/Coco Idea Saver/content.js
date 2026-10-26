// "Save to Coco" chip on YouTube watch pages. Click = save now; long-press (450 ms) or a
// click while the saved-tick still shows = 1-line "why this idea" box. Draggable, position kept.
(() => {
  if (window.__cocoIdeaSaver) return; window.__cocoIdeaSaver = true;
  const HOLD_MS = 450, TICK_MS = 1800, DRAG_PX = 6, LABEL = 'Save to Coco';

  const chip = document.createElement('button');
  chip.id = 'coco-idea-chip';
  chip.type = 'button';
  chip.textContent = LABEL;
  chip.title = 'Click: save this video to Coco Notes. Hold: add a 1-line note first. Drag to move.';
  document.documentElement.appendChild(chip);

  const clamp = (v, max) => Math.min(Math.max(v, 8), max);
  const place = (x, y) => {
    chip.style.left = clamp(x, innerWidth - chip.offsetWidth - 8) + 'px';
    chip.style.top = clamp(y, innerHeight - chip.offsetHeight - 8) + 'px';
  };
  chrome.storage.local.get('chipPos').then(({ chipPos }) => {
    place(chipPos ? chipPos.x : innerWidth - 160, chipPos ? chipPos.y : 72);
  });

  let box = null;
  function closeBox() { if (box) { box.remove(); box = null; } }

  const onWatch = () => location.pathname === '/watch';
  const sync = () => { chip.style.display = onWatch() ? 'block' : 'none'; closeBox(); };
  document.addEventListener('yt-navigate-finish', sync);
  sync();

  const videoTitle = () => (document.title || '').replace(/ - YouTube$/, '').trim();
  let tickUntil = 0;
  const show = (text, cls) => {
    chip.textContent = text; chip.className = cls || '';
    tickUntil = Date.now() + TICK_MS;
    setTimeout(() => { if (Date.now() >= tickUntil) { chip.textContent = LABEL; chip.className = ''; } }, TICK_MS);
  };
  const save = (why) => {
    const title = videoTitle().slice(0, 200);
    chrome.runtime.sendMessage({ type: 'coco-save', note: {
      kind: 'link', source_url: location.href, title,
      text: ((why ? why + ' — ' : '') + title).slice(0, 4000),
    } }, (r) => show(r && r.ok ? '✓ Saved' : '⏳ Queued', r && r.ok ? 'coco-ok' : 'coco-queued'));
  };

  // one-line "why this idea" box (box/closeBox declared above, before first sync())
  const openBox = () => {
    if (box) return;
    box = document.createElement('div');
    box.id = 'coco-idea-box';
    const input = document.createElement('input');
    input.placeholder = 'why this idea';
    input.maxLength = 300;
    const btn = document.createElement('button');
    btn.type = 'button'; btn.textContent = 'Save';
    const go = () => { save(input.value.trim()); closeBox(); };
    btn.addEventListener('click', go);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); if (e.key === 'Escape') closeBox(); e.stopPropagation(); });
    input.addEventListener('keyup', (e) => e.stopPropagation()); // keep YouTube shortcuts out of the input
    box.append(input, btn);
    document.documentElement.appendChild(box);
    const r = chip.getBoundingClientRect();
    box.style.left = clamp(r.left, innerWidth - 280) + 'px';
    box.style.top = (r.bottom + 8 > innerHeight - 50 ? r.top - 48 : r.bottom + 8) + 'px';
    input.focus();
  };

  // pointer logic: drag vs click vs long-press
  let down = null, dragged = false, holdTimer = 0, held = false;
  chip.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY, left: chip.offsetLeft, top: chip.offsetTop };
    dragged = false; held = false;
    chip.setPointerCapture(e.pointerId);
    holdTimer = setTimeout(() => { if (!dragged) { held = true; openBox(); } }, HOLD_MS);
  });
  chip.addEventListener('pointermove', (e) => {
    if (!down) return;
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (!dragged && Math.hypot(dx, dy) < DRAG_PX) return;
    dragged = true; clearTimeout(holdTimer);
    place(down.left + dx, down.top + dy);
  });
  chip.addEventListener('pointerup', () => {
    clearTimeout(holdTimer);
    if (dragged) chrome.storage.local.set({ chipPos: { x: chip.offsetLeft, y: chip.offsetTop } });
    else if (!held) { if (Date.now() < tickUntil) openBox(); else save(''); } // second click during tick = note box
    down = null;
  });
  addEventListener('resize', () => place(chip.offsetLeft, chip.offsetTop));
})();
