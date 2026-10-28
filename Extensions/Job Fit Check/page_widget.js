/* On-page Job Fit Check — tapping the logo opens the full feature panel. */
(function () {
  if (window.__jfcWidgetInstalled) return;
  window.__jfcWidgetInstalled = true;

  const ROOT_ID = "jfc-root";
  let pageKind = "none";
  let open = false;
  let busy = false;
  let lastKind = null;
  let activeTab = "home";
  let dashboard = null;
  let lastScan = null;

  function logoUrl() {
    try { return chrome.runtime.getURL("icons/jfc-logo.png"); } catch (e) { return ""; }
  }

  function safeSend(msg, cb) {
    try {
      chrome.runtime.sendMessage(msg, (resp) => {
        if (chrome.runtime.lastError) {
          if (cb) cb(null, chrome.runtime.lastError.message);
          return;
        }
        if (cb) cb(resp, null);
      });
    } catch (e) {
      if (cb) cb(null, e.message || "Extension context invalidated");
    }
  }

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function looksLikeJobListing() {
    const url = (location.href || "").toLowerCase();
    const title = (document.title || "").toLowerCase();
    let text = "";
    try { text = ((document.body && document.body.innerText) || "").slice(0, 14000).toLowerCase(); } catch (e) {}
    const urlHit = /\/jobs?\/|\/careers?\/|\/positions?\/|\/openings?\/|greenhouse\.io|lever\.co|ashbyhq\.com|myworkdayjobs\.|workday\.|smartrecruiters\.|icims\.|linkedin\.com\/jobs|indeed\.com\/|glassdoor\.|wellfound\.|jobvite|boards\.|apply\./.test(url);
    const titleHit = /\b(job|career|opening|position|hiring|apply|vacancy)\b/.test(title);
    const bodySignals = [
      "job description", "about the role", "responsibilities", "requirements",
      "qualifications", "what you'll do", "nice to have", "must have",
      "years of experience", "apply now", "we are looking for"
    ].filter((s) => text.includes(s)).length;
    return urlHit || (titleHit && bodySignals >= 2) || bodySignals >= 4;
  }

  function looksLikeApplication() {
    let fields = [];
    try {
      fields = Array.from(document.querySelectorAll("input, textarea, select")).filter((el) => {
        const type = (el.getAttribute("type") || "text").toLowerCase();
        if (["hidden", "submit", "button", "reset", "image"].includes(type)) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
    } catch (e) { return false; }
    if (fields.length < 3) return false;
    let pageText = "";
    try { pageText = ((document.body && document.body.innerText) || "").toLowerCase(); } catch (e) {}
    const url = (location.href || "").toLowerCase();
    const signals = [
      "first name", "last name", "email", "phone", "resume", "cover letter",
      "submit application", "veteran status", "work authorization", "easy apply"
    ];
    const score =
      signals.filter((s) => pageText.includes(s)).length +
      (fields.length >= 5 ? 3 : 0) +
      (document.querySelectorAll('input[type="file"]').length ? 4 : 0) +
      (/apply|application/.test(url) ? 2 : 0);
    return score >= 6;
  }

  function detectKind() {
    if (looksLikeApplication()) return "application";
    if (looksLikeJobListing()) return "job";
    return "none";
  }

  function ensureRoot() {
    let root = document.getElementById(ROOT_ID);
    if (root) return root;

    root = document.createElement("div");
    root.id = ROOT_ID;
    root.innerHTML = `
      <div class="jfc-pointer" style="position:relative;">
        <div id="jfc-panel" class="jfc-pointer" role="dialog" aria-label="Job Fit Check">
          <div class="jfc-head">
            <div class="jfc-logo-sm"><img alt="" src="${logoUrl()}" /></div>
            <div class="jfc-head-text">
              <p class="jfc-title">Job Fit Check</p>
              <p class="jfc-sub" id="jfc-sub">All features on this page</p>
            </div>
            <button type="button" class="jfc-x" data-act="close" aria-label="Close">×</button>
          </div>

          <div id="jfc-badge" class="jfc-badge job">
            <span class="jfc-badge-dot"></span>
            <span id="jfc-badge-text">Job page</span>
          </div>

          <nav class="jfc-nav" id="jfc-nav">
            <button type="button" class="jfc-nav-btn active" data-tab="home">Home</button>
            <button type="button" class="jfc-nav-btn" data-tab="match">Match</button>
            <button type="button" class="jfc-nav-btn" data-tab="autofill">Autofill</button>
            <button type="button" class="jfc-nav-btn" data-tab="resumes">Resumes</button>
            <button type="button" class="jfc-nav-btn" data-tab="history">History</button>
          </nav>

          <div class="jfc-body" id="jfc-body"></div>
          <p class="jfc-status" id="jfc-status"></p>
        </div>

        <button type="button" id="jfc-fab" class="jfc-pointer" aria-label="Open Job Fit Check" title="Job Fit Check">
          <img alt="Job Fit Check" src="${logoUrl()}" />
        </button>
      </div>
    `;
    (document.body || document.documentElement).appendChild(root);

    root.querySelector("#jfc-fab").addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      open = !open;
      root.classList.toggle("jfc-open", open);
      if (open) {
        activeTab = "home";
        loadDashboard(true);
      }
    });

    root.querySelectorAll("[data-act]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleChromeAction(btn.getAttribute("data-act"));
      });
    });

    root.querySelector("#jfc-nav").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-tab]");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      activeTab = btn.getAttribute("data-tab");
      root.querySelectorAll(".jfc-nav-btn").forEach((b) => b.classList.toggle("active", b === btn));
      renderBody();
    });

    root.querySelector("#jfc-body").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-act]");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      handleChromeAction(btn.getAttribute("data-act"), btn);
    });

    document.addEventListener("click", (e) => {
      if (!open) return;
      if (root.contains(e.target)) return;
      open = false;
      root.classList.remove("jfc-open");
    }, true);

    return root;
  }

  function setStatus(text) {
    const el = document.getElementById("jfc-status");
    if (el) el.textContent = text || "";
  }

  function loadDashboard(render) {
    safeSend({ type: "jfc_get_dashboard" }, (resp) => {
      if (resp && resp.ok !== false) dashboard = resp;
      if (render) renderBody();
      updateHeaderStats();
    });
  }

  function updateHeaderStats() {
    /* reserved for future compact header stats */
  }

  function updateUiForKind(kind) {
    const root = ensureRoot();
    const badge = root.querySelector("#jfc-badge");
    const badgeText = root.querySelector("#jfc-badge-text");
    const sub = root.querySelector("#jfc-sub");
    if (kind === "application") {
      badge.className = "jfc-badge app";
      badgeText.textContent = "Application form";
      if (sub) sub.textContent = "Autofill + match available";
    } else if (kind === "job") {
      badge.className = "jfc-badge job";
      badgeText.textContent = "Job listing";
      if (sub) sub.textContent = "Match this role on-page";
    } else {
      badge.className = "jfc-badge muted";
      badgeText.textContent = "Browse mode";
      if (sub) sub.textContent = "Open a job page for best results";
    }
  }

  function readinessHtml() {
    const d = dashboard || {};
    const items = [
      { ok: !!d.hasKey, label: "AI key saved" },
      { ok: (d.resumeCount || 0) > 0, label: "Resume uploaded" },
      { ok: pageKind === "job" || pageKind === "application", label: "Job / apply page" }
    ];
    return `<div class="jfc-ready-list">${items.map((it) => `
      <div class="jfc-ready ${it.ok ? "ok" : "miss"}">
        <span class="jfc-ready-dot"></span>
        <span>${escapeHtml(it.label)}</span>
      </div>`).join("")}</div>`;
  }

  function renderHome() {
    const d = dashboard || {};
    const left = (d.plan === "pro" || d.todayLeft === -1) ? "∞" : String(d.todayLeft != null ? d.todayLeft : 0);
    return `
      <div class="jfc-stats">
        <div class="jfc-stat"><b>${d.todayUsed != null ? d.todayUsed : 0}</b><span>Today</span></div>
        <div class="jfc-stat"><b>${left}</b><span>Left</span></div>
        <div class="jfc-stat"><b>${d.appliedCount != null ? d.appliedCount : 0}</b><span>Applied</span></div>
        <div class="jfc-stat"><b>${d.avgScore ? d.avgScore + "%" : "—"}</b><span>Avg</span></div>
      </div>
      <div class="jfc-section">
        <p class="jfc-section-title">Setup status</p>
        ${readinessHtml()}
        ${!d.hasKey || !(d.resumeCount > 0) ? `<p class="jfc-hint">Finish setup in the toolbar overview (resumes + API key).</p>` : ""}
      </div>
      <div class="jfc-section">
        <p class="jfc-section-title">Quick actions</p>
        <div class="jfc-actions">
          <button type="button" class="jfc-btn jfc-btn-primary" data-act="match">Match this job</button>
          <button type="button" class="jfc-btn jfc-btn-secondary" data-act="autofill">Autofill form</button>
          <button type="button" class="jfc-btn jfc-btn-ghost" data-act="scan">Scan form only</button>
        </div>
      </div>
      <div class="jfc-section">
        <p class="jfc-section-title">Active resume</p>
        <p class="jfc-active-resume">${escapeHtml(d.activeResumeName || "None selected")}</p>
      </div>`;
  }

  function renderMatch() {
    return `
      <div class="jfc-section">
        <p class="jfc-section-title">AI job match</p>
        <p class="jfc-hint">Grabs this page’s JD and scores it against your resumes.</p>
        <div class="jfc-actions">
          <button type="button" class="jfc-btn jfc-btn-primary" data-act="match">Run match</button>
          <button type="button" class="jfc-btn jfc-btn-ghost" data-act="grab-preview">Preview JD length</button>
        </div>
      </div>
      <div id="jfc-results" class="jfc-results"></div>`;
  }

  function renderAutofill() {
    const scanHtml = lastScan ? `
      <div class="jfc-section">
        <p class="jfc-section-title">Last scan</p>
        <p class="jfc-hint">${lastScan.filled != null ? "Filled " + lastScan.filled + " / " + lastScan.total : (lastScan.message || "")}</p>
        ${(lastScan.preview || []).slice(0, 8).map((f) => `
          <div class="jfc-field-row">
            <span class="jfc-field-lab">${escapeHtml((f.label || "").slice(0, 28))}</span>
            <span class="jfc-field-val">${escapeHtml(String(f.value || "—").slice(0, 24))}</span>
          </div>`).join("")}
      </div>` : `<p class="jfc-hint">Scan this page to preview fields, then fill instantly.</p>`;

    return `
      <div class="jfc-section">
        <p class="jfc-section-title">Smart autofill</p>
        <p class="jfc-hint">Uses resume facts + learned answers. No AI call required.</p>
        <div class="jfc-actions">
          <button type="button" class="jfc-btn jfc-btn-primary" data-act="autofill">Fill application</button>
          <button type="button" class="jfc-btn jfc-btn-ghost" data-act="scan">Scan fields</button>
        </div>
      </div>
      ${scanHtml}`;
  }

  function renderResumes() {
    const resumes = (dashboard && dashboard.resumes) || [];
    if (!resumes.length) {
      return `
        <div class="jfc-section">
          <p class="jfc-section-title">Resumes</p>
          <p class="jfc-hint">No resumes yet. Open the toolbar overview → Setup to upload.</p>
        </div>`;
    }
    return `
      <div class="jfc-section">
        <p class="jfc-section-title">Choose active resume</p>
        <p class="jfc-hint">Used for match scoring and autofill facts.</p>
        <div class="jfc-resume-list">
          ${resumes.map((r) => `
            <button type="button" class="jfc-resume-row ${r.active ? "active" : ""}" data-act="set-resume" data-idx="${r.idx}">
              <span class="jfc-resume-name">${escapeHtml(r.name)}</span>
              <span class="jfc-resume-meta">${r.active ? "Active" : "Use"} · ${r.chars.toLocaleString()} chars</span>
            </button>`).join("")}
        </div>
      </div>`;
  }

  function renderHistory() {
    const items = (dashboard && dashboard.recentMatches) || [];
    if (!items.length) {
      return `<div class="jfc-section"><p class="jfc-section-title">History</p><p class="jfc-hint">Run a match to see scores here.</p></div>`;
    }
    return `
      <div class="jfc-section">
        <p class="jfc-section-title">Recent matches</p>
        <div class="jfc-history-list">
          ${items.map((m) => `
            <div class="jfc-hist-row">
              <div>
                <b>${escapeHtml(m.role || "Role")}</b>
                <p>${escapeHtml(m.company || "")} · ${escapeHtml(m.resumeName || "")}</p>
              </div>
              <span class="jfc-score">${m.score != null ? m.score + "%" : "—"}</span>
            </div>`).join("")}
        </div>
      </div>
      <div class="jfc-section">
        <p class="jfc-section-title">Totals</p>
        <div class="jfc-stats">
          <div class="jfc-stat"><b>${dashboard.totalMatches || 0}</b><span>Matches</span></div>
          <div class="jfc-stat"><b>${dashboard.bestScore ? dashboard.bestScore + "%" : "—"}</b><span>Best</span></div>
          <div class="jfc-stat"><b>${dashboard.qaCount || 0}</b><span>Q&amp;A</span></div>
        </div>
      </div>`;
  }

  function renderBody() {
    const body = document.getElementById("jfc-body");
    if (!body) return;
    const map = {
      home: renderHome,
      match: renderMatch,
      autofill: renderAutofill,
      resumes: renderResumes,
      history: renderHistory
    };
    body.innerHTML = (map[activeTab] || renderHome)();

    // Re-attach results if match tab and we stored HTML
    if (activeTab === "match" && window.__jfcLastMatchHtml) {
      const results = document.getElementById("jfc-results");
      if (results) results.innerHTML = window.__jfcLastMatchHtml;
    }
  }

  function renderMatchResults(payload) {
    if (!payload || !payload.ok) return "";
    const meta = payload.meta || {};
    const cards = (payload.results || []).map((r) => {
      if (r.error) {
        return `<div class="jfc-card jfc-card-err"><b>${escapeHtml(r.resumeName)}</b><p>${escapeHtml(r.error)}</p></div>`;
      }
      const tips = (r.tips || []).slice(0, 2).map((t) => `<li>${escapeHtml(t)}</li>`).join("");
      const missing = (r.missing || []).slice(0, 2).map((m) => `<li>${escapeHtml(m.requirement || m)}</li>`).join("");
      return `<div class="jfc-card">
        <div class="jfc-card-top">
          <div>
            <b>${escapeHtml(r.resumeName)}</b>
            <p>${escapeHtml(r.recommendation || r.verdict || "")}</p>
          </div>
          <span class="jfc-score">${r.score}%</span>
        </div>
        ${tips ? `<p class="jfc-mini-lab">Tips</p><ul class="jfc-tips">${tips}</ul>` : ""}
        ${missing ? `<p class="jfc-mini-lab">Gaps</p><ul class="jfc-tips">${missing}</ul>` : ""}
      </div>`;
    }).join("");
    return `
      <div class="jfc-meta">${escapeHtml(meta.role || "Role")} · ${escapeHtml(meta.company || "")}</div>
      ${cards || "<p class='jfc-empty'>No scores returned.</p>"}`;
  }

  function handleChromeAction(act, el) {
    if (act === "close") {
      open = false;
      const root = document.getElementById(ROOT_ID);
      if (root) root.classList.remove("jfc-open");
      return;
    }
    if (act === "hide") {
      try { sessionStorage.setItem("jfc_hide_" + location.origin + location.pathname, "1"); } catch (e) {}
      hideWidget();
      return;
    }
    if (busy) return;

    if (act === "set-resume") {
      const idx = parseInt(el && el.getAttribute("data-idx"), 10);
      if (isNaN(idx)) return;
      setStatus("Setting active resume…");
      safeSend({ type: "jfc_set_active_resume", idx }, (resp, err) => {
        if (err || !resp || !resp.ok) {
          setStatus((resp && resp.error) || err || "Could not set resume.");
          return;
        }
        setStatus("Active resume updated.");
        loadDashboard(true);
      });
      return;
    }

    if (act === "grab-preview") {
      busy = true;
      setStatus("Reading page JD…");
      safeSend({ type: "jfc_grab_jd_preview", url: location.href, title: document.title }, (resp, err) => {
        busy = false;
        if (err || !resp || !resp.ok) {
          setStatus((resp && resp.error) || err || "Could not read JD.");
          return;
        }
        setStatus("JD preview: " + resp.chars + " chars · " + resp.words + " words (" + resp.source + ")");
      });
      return;
    }

    if (act === "match") {
      busy = true;
      activeTab = "match";
      syncNav();
      renderBody();
      setStatus("Matching resumes to this job…");
      const resultsEl = () => document.getElementById("jfc-results");
      if (resultsEl()) resultsEl().innerHTML = `<div class="jfc-loading"><span class="jfc-spin"></span> Scoring…</div>`;
      safeSend({ type: "jfc_run_match", url: location.href, title: document.title }, (resp, err) => {
        busy = false;
        if (err) {
          setStatus("Reload the extension, then try again.");
          return;
        }
        if (!resp || !resp.ok) {
          setStatus((resp && resp.error) || "Match failed.");
          if (resultsEl()) resultsEl().innerHTML = "";
          return;
        }
        const html = renderMatchResults(resp);
        window.__jfcLastMatchHtml = html;
        if (resultsEl()) resultsEl().innerHTML = html;
        setStatus("Match complete — saved to history.");
        loadDashboard(false);
      });
      return;
    }

    if (act === "autofill") {
      busy = true;
      activeTab = "autofill";
      syncNav();
      renderBody();
      setStatus("Filling application form…");
      safeSend({ type: "jfc_run_autofill" }, (resp, err) => {
        busy = false;
        if (err) {
          setStatus("Reload the extension, then try again.");
          return;
        }
        if (!resp || !resp.ok) {
          setStatus((resp && resp.error) || "Autofill failed.");
          return;
        }
        lastScan = {
          filled: resp.filled,
          total: resp.total,
          message: resp.message,
          preview: resp.preview || []
        };
        setStatus(resp.message || ("Filled " + (resp.filled || 0) + " fields."));
        renderBody();
        loadDashboard(false);
      });
      return;
    }

    if (act === "scan") {
      busy = true;
      activeTab = "autofill";
      syncNav();
      renderBody();
      setStatus("Scanning form fields…");
      safeSend({ type: "jfc_scan_form" }, (resp, err) => {
        busy = false;
        if (err || !resp || !resp.ok) {
          setStatus((resp && resp.error) || err || "Scan failed.");
          return;
        }
        lastScan = {
          filled: resp.resolved || 0,
          total: resp.total || 0,
          message: "Ready: " + (resp.resolved || 0) + " of " + (resp.total || 0) + " fields",
          preview: resp.preview || []
        };
        setStatus(lastScan.message);
        renderBody();
      });
    }
  }

  function syncNav() {
    const root = document.getElementById(ROOT_ID);
    if (!root) return;
    root.querySelectorAll(".jfc-nav-btn").forEach((b) => {
      b.classList.toggle("active", b.getAttribute("data-tab") === activeTab);
    });
  }

  function showWidget(kind) {
    pageKind = kind;
    try {
      if (sessionStorage.getItem("jfc_hide_" + location.origin + location.pathname) === "1") return;
    } catch (e) {}
    const root = ensureRoot();
    root.style.display = "block";
    updateUiForKind(kind);
    if (kind !== lastKind) {
      lastKind = kind;
      safeSend({
        type: kind === "application" ? "rjm_application_detected" : "jfc_job_page_detected",
        url: location.href,
        title: document.title,
        kind
      });
    }
  }

  function hideWidget() {
    const root = document.getElementById(ROOT_ID);
    if (root) root.style.display = "none";
    open = false;
    lastKind = null;
  }

  function tick() {
    try {
      const kind = detectKind();
      // Always show logo on job/application pages; also show lightly on career-ish URLs
      if (kind === "none") {
        const url = (location.href || "").toLowerCase();
        if (/career|job|hiring|recruit|greenhouse|lever|ashby|workday/.test(url)) {
          showWidget("job");
          return;
        }
        if (lastKind) hideWidget();
        return;
      }
      showWidget(kind);
    } catch (e) {}
  }

  function start() {
    tick();
    setTimeout(tick, 800);
    setTimeout(tick, 2500);
    setTimeout(tick, 5000);
    let timer = null;
    try {
      new MutationObserver(() => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(tick, 900);
      }).observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) {}
    let lastHref = location.href;
    setInterval(() => {
      if (location.href !== lastHref) {
        lastHref = location.href;
        lastKind = null;
        tick();
      }
    }, 1000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
