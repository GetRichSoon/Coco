/* A miniature of the Coco app, painted with ONE theme in ONE mode. Used by the theme review sheet (theme-preview.html) and by the theme cards in
   the app, so the preview and the real thing cannot disagree: the mock is styled with the same CSS variable names the app uses, taken from the
   same generated tables (CocoThemeCore.cssFor). Panels (cards, the sidebar, the top bar) re-declare their colours from the panel copy of the
   palette exactly as the real stylesheet does, which is how Original Signature has black cards on a lavender page. */
(function (root) {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let cssText = null;
  // the panel remap, built from the engine's own list so it can never fall out of step with the real stylesheet
  function css(engine) {
    if (cssText) return cssText;
    const remap = engine.PANEL_VARS.map((v) => `${v}: var(--p-${v.slice(2)});`).join(' ');
    cssText = `
.cm { display: grid; grid-template-columns: 64px 1fr; gap: 0; background: var(--surface); color: var(--on-surface); font: 500 11px/1.35 'Space Grotesk', system-ui, sans-serif; border-radius: 18px; overflow: hidden; position: relative; min-height: 210px; box-shadow: inset 0 0 0 1px var(--outline); }
.cm .cm-panel { ${remap} background: var(--surface-1); color: var(--on-surface); }
.cm .cm-rail { display: grid; align-content: start; gap: 7px; padding: 10px 8px; border-right: 1px solid var(--outline); }
.cm .cm-brand { width: 22px; height: 22px; border-radius: 8px; background: var(--primary); margin: 0 auto 4px; }
.cm .cm-nav { height: 22px; border-radius: 11px; display: flex; align-items: center; gap: 5px; padding: 0 6px; color: var(--muted); }
.cm .cm-nav i { width: 9px; height: 9px; border-radius: 3px; background: currentColor; opacity: .75; flex: none; }
.cm .cm-nav b { height: 4px; border-radius: 2px; background: currentColor; opacity: .35; flex: 1; }
.cm .cm-nav.on { background: var(--sel); color: var(--on-sel); } .cm .cm-nav.on i, .cm .cm-nav.on b { opacity: 1; }
.cm .cm-main { display: grid; gap: 8px; padding: 9px; align-content: start; min-width: 0; }
.cm .cm-top { display: flex; align-items: center; gap: 6px; padding: 5px 8px; border-radius: 14px; border: 1px solid var(--outline); }
.cm .cm-search { flex: 1; height: 12px; border-radius: 6px; background: var(--surface-2); } .cm .cm-av { width: 14px; height: 14px; border-radius: 50%; background: var(--primary); }
.cm .cm-card { padding: 9px 10px; border-radius: 16px; display: grid; gap: 5px; border: 1px solid var(--outline); }
.cm .cm-lbl { color: var(--muted); font-size: 9.5px; font-weight: 600; } .cm .cm-big { font-size: 21px; font-weight: 700; letter-spacing: -.02em; line-height: 1.05; }
.cm .cm-chips { display: flex; gap: 4px; flex-wrap: wrap; } .cm .cm-chip { padding: 1px 7px; border-radius: 8px; font-size: 9px; font-weight: 700; background: var(--good-c); color: var(--on-good-c); }
.cm .cm-chip.hl { background: var(--hl); color: var(--on-hl); } .cm .cm-chip.warn { background: var(--warn-c); color: var(--on-warn-c); } .cm .cm-chip.bad { background: var(--bad-c); color: var(--on-bad-c); } .cm .cm-chip.t { background: var(--primary-c); color: var(--on-primary-c); }
.cm .cm-bars { display: flex; align-items: flex-end; gap: 4px; height: 30px; } .cm .cm-bars i { flex: 1; border-radius: 3px 3px 0 0; } .cm .cm-bars i:nth-child(3n+1) { background: var(--chart-1); } .cm .cm-bars i:nth-child(3n+2) { background: var(--chart-2); } .cm .cm-bars i:nth-child(3n) { background: var(--chart-3); }
.cm .cm-row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.cm .cm-btn { height: 20px; padding: 0 10px; border-radius: 10px; display: inline-flex; align-items: center; font-weight: 700; font-size: 9.5px; background: var(--cta); color: var(--on-cta); box-shadow: inset 0 0 0 1.5px var(--cta-edge); }
.cm .cm-btn.t { background: var(--primary-c); color: var(--on-primary-c); box-shadow: none; } .cm .cm-link { color: var(--link); font-weight: 700; font-size: 9.5px; }
.cm .cm-sw { width: 24px; height: 14px; border-radius: 7px; background: var(--primary); position: relative; margin-left: auto; } .cm .cm-sw::after { content: ''; position: absolute; right: 2px; top: 2px; width: 10px; height: 10px; border-radius: 50%; background: var(--on-primary); }
.cm .cm-err { color: var(--bad); font-weight: 700; font-size: 9.5px; }
.cm.big { min-height: 250px; font-size: 12.5px; grid-template-columns: 78px 1fr; } .cm.big .cm-big { font-size: 26px; } .cm.big .cm-lbl, .cm.big .cm-chip, .cm.big .cm-btn, .cm.big .cm-link, .cm.big .cm-err { font-size: 11px; } .cm.big .cm-btn { height: 24px; border-radius: 12px; } .cm.big .cm-bars { height: 38px; } .cm.big .cm-nav { height: 26px; }
`;
    return cssText;
  }
  // inline style carrying every variable of the theme (page and panel copies) for one mode
  const styleOf = (engine, themeId, mode) => Object.entries(engine.cssFor(themeId, mode)).map(([k, v]) => `${k}:${v}`).join(';');
  function html(engine, themeId, mode, opt) {
    const o = opt || {};
    return `<div class="cm${o.big ? ' big' : ''}" data-theme-mock="${esc(themeId)}:${esc(mode)}" style="${styleOf(engine, themeId, mode)}" role="img" aria-label="${esc((engine.byId(themeId) || {}).name || themeId)}, ${esc(mode)} mode, preview">
      <div class="cm-panel cm-rail"><div class="cm-brand"></div><div class="cm-nav on"><i></i><b></b></div><div class="cm-nav"><i></i><b></b></div><div class="cm-nav"><i></i><b></b></div><div class="cm-nav"><i></i><b></b></div></div>
      <div class="cm-main">
        <div class="cm-panel cm-top"><span class="cm-search"></span><span class="cm-av"></span></div>
        <div class="cm-panel cm-card"><span class="cm-lbl">Sample card</span><span class="cm-big">1,234</span><div class="cm-chips"><span class="cm-chip">Actual</span><span class="cm-chip hl">New</span><span class="cm-chip t">Selected</span><span class="cm-chip warn">Warning</span><span class="cm-chip bad">Error</span></div>
          <div class="cm-bars"><i style="height:45%"></i><i style="height:80%"></i><i style="height:60%"></i><i style="height:100%"></i><i style="height:55%"></i><i style="height:35%"></i></div></div>
        <div class="cm-row"><span class="cm-btn">Create</span><span class="cm-btn t">Open</span><span class="cm-link">Details</span><span class="cm-sw"></span></div>
      </div></div>`;
  }
  root.CocoThemeMock = { css, html, styleOf, esc };
})(typeof window !== 'undefined' ? window : globalThis);
