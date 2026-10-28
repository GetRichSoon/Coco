/* Overview-only popup — Match & Autofill run on the page logo, not here. */
const SUPABASE_URL = "https://uxwtpbprvtaewnxyiztv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4d3RwYnBydnRhZXdueHlpenR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MDYwMDMsImV4cCI6MjA5NzM4MjAwM30.TgB6bYukp_igt2zZmt-h9CCzFw7CqS6CM6EiAUPrspo";
const DAILY_FREE_MATCH_LIMIT = 20;
const VALID_LICENSE_PREFIX = "RJM-PRO-";

const state = {
  resumes: [null, null, null, null, null],
  apiKey: null,
  session: null,
  profile: null,
  theme: "light",
  displayName: "",
  avatarColor: "#06b6d4",
  plan: "free",
  licenseKey: null,
  usage: { date: null, count: 0 },
  autofillResumeIdx: null,
  qaBank: [],
  appliedLog: [],
  onboardingDismissed: false,
  lastMatchScores: [],
  matchHistory: []
};

function escapeHtml(s) {
  return (s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}
function storageSet(obj) {
  return new Promise((resolve) => chrome.storage.local.set(obj, resolve));
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function showPanel(name) {
  document.querySelectorAll(".panel").forEach((p) => {
    p.classList.toggle("active", p.id === "panel-" + name);
  });
}

function applyTheme() {
  document.documentElement.setAttribute("data-theme", state.theme);
  const sun = document.getElementById("theme-icon-sun");
  const moon = document.getElementById("theme-icon-moon");
  if (sun && moon) {
    sun.style.display = state.theme === "dark" ? "none" : "block";
    moon.style.display = state.theme === "dark" ? "block" : "none";
  }
}

function initialFor(s) {
  s = (s || "").trim();
  return s ? s[0].toUpperCase() : "?";
}

function renderProfileMenu() {
  const initial = initialFor(state.displayName || (state.session && state.session.user && state.session.user.email));
  const color = state.avatarColor || "#06b6d4";
  ["avatar-initial", "avatar-initial-lg"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = initial;
  });
  const btn = document.getElementById("avatar-btn");
  const lg = document.getElementById("avatar-lg");
  if (btn) btn.style.background = color;
  if (lg) lg.style.background = color;
  const emailEl = document.getElementById("profile-menu-email");
  const planEl = document.getElementById("profile-menu-plan");
  if (emailEl) {
    emailEl.textContent = state.session && state.session.user
      ? (state.displayName || state.session.user.email)
      : "Not signed in";
  }
  if (planEl) planEl.textContent = state.plan === "pro" ? "Pro plan" : "Free plan";
}

function resetUsageIfNewDay() {
  if (state.usage.date !== todayStr()) {
    state.usage = { date: todayStr(), count: 0 };
    storageSet({ rjm_usage: state.usage });
  }
}

function renderOverview() {
  resetUsageIfNewDay();
  const used = state.usage.count || 0;
  const resumeCount = state.resumes.filter(Boolean).length;
  const appliedCount = (state.appliedLog || []).filter((x) => x.answer === "yes").length;
  const scores = state.lastMatchScores || [];
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const best = scores.length ? Math.max(...scores) : null;
  const streak = (state.profile && state.profile.streak_count) || 0;
  const ready =
    state.apiKey && resumeCount > 0 ? "Ready" :
    !state.apiKey ? "Add AI key" : "Add resume";

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set("ov-today", String(used));
  set("ov-left", state.plan === "pro" ? "Unlimited" : Math.max(0, DAILY_FREE_MATCH_LIMIT - used) + " left");
  set("ov-total", String((state.matchHistory || []).length));
  set("ov-applied", String(appliedCount));
  set("ov-avg", avg == null ? "—" : avg + "%");
  set("ov-best", best == null ? "Best —" : "Best " + best + "%");
  set("ov-resumes", String(resumeCount));
  set("ov-qa", String((state.qaBank || []).length));
  set("ov-streak", String(streak));
  set("ov-plan", state.plan === "pro" ? "Pro" : "Free");
  set("ov-ready", ready);
  set("overview-ring-used", String(used));
  set("overview-ring-cap", state.plan === "pro" ? "" : "/" + DAILY_FREE_MATCH_LIMIT);

  const greet = document.getElementById("overview-greeting");
  if (greet) {
    const name = state.displayName || (state.session && state.session.user && state.session.user.email
      ? state.session.user.email.split("@")[0] : "");
    greet.textContent = name ? "Welcome back, " + name : "Your job search HQ";
  }

  const ring = document.getElementById("overview-ring-fill");
  if (ring) {
    const pct = state.plan === "pro" ? 0.12 : Math.min(1, used / DAILY_FREE_MATCH_LIMIT);
    const circ = 2 * Math.PI * 30;
    ring.style.strokeDasharray = String(circ);
    ring.style.strokeDashoffset = String(circ * (1 - pct));
    ring.style.stroke = pct > 0.85 ? "#f43f5e" : (pct > 0.55 ? "#f59e0b" : "#06b6d4");
  }

  const list = document.getElementById("overview-recent-list");
  if (list) {
    const items = (state.matchHistory || []).slice(0, 8);
    list.innerHTML = items.length
      ? items.map((m, i) => `
        <div class="ov-recent-item" style="animation-delay:${i * 0.04}s">
          <div class="ov-recent-meta">
            <p class="ov-recent-role">${escapeHtml(m.role || "Role")}</p>
            <p class="ov-recent-sub">${escapeHtml(m.company || "Company")} · ${escapeHtml(m.resumeName || "")}</p>
          </div>
          <span class="ov-recent-score">${m.score != null ? m.score + "%" : "—"}</span>
        </div>`).join("")
      : `<p class="hint">No matches yet. Open a job page and use the floating logo.</p>`;
  }

  renderHistory();
  renderUsageBanner();
  renderOnboarding();
}

function renderHistory() {
  const wrap = document.getElementById("history-list");
  if (!wrap) return;
  const items = (state.appliedLog || []).filter((x) => x.answer === "yes").slice().sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 20);
  if (!items.length) {
    wrap.innerHTML = `<p class="hint">Applied roles will show here after you log them from autofill.</p>`;
    return;
  }
  wrap.innerHTML = items.map((item) => `
    <div class="history-item">
      <div class="history-top">
        <div>
          <p class="history-role">${escapeHtml(item.role || "Role")}</p>
          <p class="history-company">${escapeHtml(item.company || "Company")}</p>
        </div>
        <span class="history-score">OK</span>
      </div>
    </div>`).join("");
}

function renderUsageBanner() {
  const banner = document.getElementById("usage-banner");
  if (!banner) return;
  if (state.plan === "pro") {
    banner.classList.add("hidden");
    return;
  }
  resetUsageIfNewDay();
  const remaining = Math.max(0, DAILY_FREE_MATCH_LIMIT - (state.usage.count || 0));
  banner.classList.remove("hidden");
  banner.classList.toggle("limit-hit", remaining <= 0);
  banner.textContent = remaining > 0
    ? `Free plan: ${remaining} of ${DAILY_FREE_MATCH_LIMIT} matches left today`
    : `Daily free matches used. Resets at midnight.`;
}

function renderOnboarding() {
  const card = document.getElementById("onboarding-card");
  const list = document.getElementById("onboarding-list");
  if (!card || !list) return;
  const steps = [
    { label: "Upload a resume", done: state.resumes.some(Boolean), panel: "setup" },
    { label: "Add OpenRouter API key", done: !!state.apiKey, panel: "setup" },
    { label: "Match a job via page logo", done: (state.matchHistory || []).length > 0, panel: "overview" }
  ];
  if (state.onboardingDismissed || steps.every((s) => s.done)) {
    card.classList.add("hidden");
    return;
  }
  card.classList.remove("hidden");
  list.innerHTML = steps.map((s) => `
    <li class="${s.done ? "done" : ""}" data-panel="${s.panel}">
      <span class="onboarding-check">${s.done ? "✓" : ""}</span>
      <span>${escapeHtml(s.label)}</span>
    </li>`).join("");
  list.querySelectorAll("li").forEach((li) => {
    li.addEventListener("click", () => {
      if (!li.classList.contains("done")) showPanel(li.dataset.panel);
    });
  });
}

function checkPageStatus() {
  chrome.runtime.sendMessage({ type: "rjm_check_application" }, (resp) => {
    const pill = document.getElementById("page-live-pill");
    const detail = document.getElementById("page-status-detail");
    if (!pill) return;
    pill.classList.remove("hot", "warn");
    if (resp && resp.detected) {
      pill.textContent = "Application live";
      pill.classList.add("hot");
      if (detail) detail.textContent = "Application form on this tab — use the floating logo to Autofill.";
    } else if (resp && resp.jobPage) {
      pill.textContent = "Job page live";
      pill.classList.add("hot");
      if (detail) detail.textContent = "Job listing detected — use the floating logo to Match.";
    } else {
      pill.textContent = "No job page";
      pill.classList.add("warn");
      if (detail) detail.textContent = "Open a job listing or application form. The logo appears there for Match & Autofill.";
    }
  });
}

function extractResumeFacts(resumeText) {
  const facts = {};
  const emailMatch = resumeText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) facts.email = emailMatch[0];
  const phoneMatch = resumeText.match(/(\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
  if (phoneMatch) facts.phone = phoneMatch[0].trim();
  const linkedinMatch = resumeText.match(/(https?:\/\/)?(www\.)?linkedin\.com\/in\/[a-zA-Z0-9-_/]+/i);
  if (linkedinMatch) facts.linkedin = linkedinMatch[0];
  const githubMatch = resumeText.match(/(https?:\/\/)?(www\.)?github\.com\/[a-zA-Z0-9-_/]+/i);
  if (githubMatch) facts.github = githubMatch[0];
  const firstLines = resumeText.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 5);
  for (const rawLine of firstLines) {
    const segment = rawLine.split(/\s[-|\u2013]\s/)[0].trim();
    if (segment.length < 60 && !/[@\d]/.test(segment)) {
      const words = segment.split(/\s+/);
      if (words.length >= 2 && words.length <= 4) {
        facts.fullName = segment;
        facts.firstName = words[0];
        facts.lastName = words[words.length - 1];
        break;
      }
    }
  }
  return facts;
}

async function syncActiveFacts() {
  const idx = state.autofillResumeIdx;
  const resume = idx != null ? state.resumes[idx] : null;
  if (!resume) {
    await storageSet({ rjm_active_facts: null });
    return;
  }
  const stored = await storageGet(["rjm_active_facts_overrides_" + idx]);
  const base = extractResumeFacts(resume.text);
  const overrides = stored["rjm_active_facts_overrides_" + idx] || {};
  await storageSet({ rjm_active_facts: Object.assign({}, base, overrides) });
}

function renderResumeSlots() {
  const wrap = document.getElementById("resume-slots");
  if (!wrap) return;
  wrap.innerHTML = "";
  state.resumes.forEach((r, i) => {
    const slot = document.createElement("div");
    slot.className = "slot" + (r ? " filled" : "");
    if (r) {
      slot.innerHTML = `
        <span class="slot-icon slot-icon-doc" aria-hidden="true"></span>
        <div class="slot-text">
          <p class="slot-name">${escapeHtml(r.name)}</p>
          <p class="slot-meta">Slot ${i + 1} · ${r.text.length.toLocaleString()} chars</p>
        </div>
        <button class="slot-btn" data-act="replace">Replace</button>
        <button class="slot-btn" data-act="remove">Remove</button>
        <input type="file" accept=".txt,.docx" style="display:none" />`;
    } else {
      slot.innerHTML = `
        <div class="upload-icon"></div>
        <div class="slot-text">
          <div class="upload-title">Upload resume</div>
          <div class="upload-subtitle">.txt or .docx · slot ${i + 1}</div>
        </div>
        <input type="file" accept=".txt,.docx" style="display:none" />`;
      slot.addEventListener("click", (e) => {
        if (e.target.tagName === "INPUT") return;
        slot.querySelector("input[type=file]").click();
      });
    }
    wrap.appendChild(slot);
    const fileInput = slot.querySelector("input[type=file]");
    fileInput.addEventListener("change", (e) => handleFile(i, e.target.files[0]));
    slot.querySelectorAll(".slot-btn").forEach((b) => {
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        if (b.dataset.act === "replace") fileInput.click();
        else if (b.dataset.act === "remove") removeResume(i);
      });
    });
  });
}

async function handleFile(idx, file) {
  if (!file) return;
  let text = "";
  try {
    if (file.name.toLowerCase().endsWith(".docx")) {
      const buf = await file.arrayBuffer();
      if (!window.miniDocx) throw new Error("docx parser unavailable");
      text = await window.miniDocx.extractDocxText(buf);
    } else {
      text = await file.text();
    }
  } catch (e) {
    alert("Could not read that file (" + e.message + ").");
    return;
  }
  state.resumes[idx] = { name: file.name, text };
  await storageSet({ rjm_resumes: state.resumes });
  if (state.autofillResumeIdx == null) {
    state.autofillResumeIdx = idx;
    await storageSet({ rjm_autofill_resume_idx: idx });
  }
  await syncActiveFacts();
  renderResumeSlots();
  renderOverview();
}

async function removeResume(idx) {
  state.resumes[idx] = null;
  await storageSet({ rjm_resumes: state.resumes });
  if (state.autofillResumeIdx === idx) {
    const next = state.resumes.findIndex(Boolean);
    state.autofillResumeIdx = next === -1 ? null : next;
    await storageSet({ rjm_autofill_resume_idx: state.autofillResumeIdx });
  }
  await syncActiveFacts();
  renderResumeSlots();
  renderOverview();
}

function renderKeyStatus() {
  const el = document.getElementById("key-status");
  if (!el) return;
  el.textContent = state.apiKey
    ? "Key saved (…" + state.apiKey.slice(-4) + ")"
    : "No key saved yet.";
}

function renderAccount() {
  const out = document.getElementById("account-logged-out");
  const inn = document.getElementById("account-logged-in");
  if (!out || !inn) return;
  if (state.session && state.session.user) {
    out.classList.add("hidden");
    inn.classList.remove("hidden");
    const email = document.getElementById("account-email-display");
    if (email) email.textContent = state.session.user.email;
    const name = document.getElementById("account-display-name");
    if (name) name.value = state.displayName || "";
    const color = document.getElementById("account-avatar-color");
    if (color) color.value = state.avatarColor || "";
  } else {
    out.classList.remove("hidden");
    inn.classList.add("hidden");
  }
  renderPlanSection();
  renderProfileMenu();
}

function renderPlanSection() {
  const wrap = document.getElementById("account-plan-section");
  if (!wrap) return;
  if (state.plan === "pro") {
    wrap.innerHTML = `<div class="pricing-card"><span class="plan-badge">Pro</span><p class="hint" style="margin-top:8px;">Unlimited matches.</p></div>`;
    return;
  }
  wrap.innerHTML = `
    <div class="pricing-card">
      <span class="plan-badge">Free</span>
      <p class="hint" style="margin-top:8px;">${DAILY_FREE_MATCH_LIMIT} matches / day</p>
      <div class="row-gap" style="margin-top:10px;">
        <input type="text" id="license-input" placeholder="RJM-PRO-XXXXXX" />
        <button id="license-redeem-btn" class="btn-primary-small" type="button">Unlock</button>
      </div>
      <p id="license-status" class="hint"></p>
    </div>`;
  const btn = document.getElementById("license-redeem-btn");
  if (btn) {
    btn.addEventListener("click", async () => {
      const code = (document.getElementById("license-input").value || "").trim().toUpperCase();
      const status = document.getElementById("license-status");
      if (!code.startsWith(VALID_LICENSE_PREFIX) || code.length < VALID_LICENSE_PREFIX.length + 6) {
        status.textContent = "Invalid license.";
        return;
      }
      state.plan = "pro";
      state.licenseKey = code;
      await storageSet({ rjm_plan: "pro", rjm_license_key: code });
      renderPlanSection();
      renderOverview();
      status.textContent = "Pro unlocked.";
    });
  }
}

async function supabaseAuth(path, body) {
  const res = await fetch(SUPABASE_URL + path, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: "Bearer " + SUPABASE_ANON_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error_description || data.msg || data.error || ("HTTP " + res.status));
  return data;
}

function sessionFromAuth(data) {
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at || (Math.floor(Date.now() / 1000) + (data.expires_in || 3600)),
    user: data.user
  };
}

async function loadAll() {
  const data = await storageGet([
    "rjm_resumes", "rjm_apikey", "rjm_session", "rjm_theme", "rjm_display_name",
    "rjm_avatar_color", "rjm_plan", "rjm_license_key", "rjm_usage",
    "rjm_autofill_resume_idx", "rjm_qa_bank", "rjm_applied_log",
    "rjm_onboarding_dismissed", "rjm_last_match_scores", "rjm_match_history"
  ]);
  if (data.rjm_resumes) state.resumes = data.rjm_resumes;
  if (data.rjm_apikey) state.apiKey = data.rjm_apikey;
  if (data.rjm_session) state.session = data.rjm_session;
  if (data.rjm_theme) state.theme = data.rjm_theme;
  if (data.rjm_display_name) state.displayName = data.rjm_display_name;
  if (data.rjm_avatar_color) state.avatarColor = data.rjm_avatar_color;
  if (data.rjm_plan) state.plan = data.rjm_plan;
  if (data.rjm_license_key) state.licenseKey = data.rjm_license_key;
  if (data.rjm_usage) state.usage = data.rjm_usage;
  if (typeof data.rjm_autofill_resume_idx === "number") state.autofillResumeIdx = data.rjm_autofill_resume_idx;
  if (data.rjm_qa_bank) state.qaBank = data.rjm_qa_bank;
  if (data.rjm_applied_log) state.appliedLog = data.rjm_applied_log;
  if (data.rjm_onboarding_dismissed) state.onboardingDismissed = true;
  if (Array.isArray(data.rjm_last_match_scores)) state.lastMatchScores = data.rjm_last_match_scores;
  if (Array.isArray(data.rjm_match_history)) state.matchHistory = data.rjm_match_history;

  if (state.autofillResumeIdx == null) {
    const first = state.resumes.findIndex(Boolean);
    if (first !== -1) {
      state.autofillResumeIdx = first;
      await storageSet({ rjm_autofill_resume_idx: first });
    }
  }

  applyTheme();
  await syncActiveFacts();
  renderResumeSlots();
  renderKeyStatus();
  renderAccount();
  renderOverview();
  checkPageStatus();
  showPanel("overview");
}

/* Events */
document.getElementById("theme-toggle-btn").addEventListener("click", async () => {
  state.theme = state.theme === "dark" ? "light" : "dark";
  applyTheme();
  await storageSet({ rjm_theme: state.theme });
});

document.getElementById("avatar-btn").addEventListener("click", (e) => {
  e.stopPropagation();
  document.getElementById("profile-menu").classList.toggle("hidden");
});
document.addEventListener("click", (e) => {
  const menu = document.getElementById("profile-menu");
  const btn = document.getElementById("avatar-btn");
  if (menu && !menu.classList.contains("hidden") && !menu.contains(e.target) && e.target !== btn) {
    menu.classList.add("hidden");
  }
});

document.querySelectorAll(".profile-menu-item").forEach((item) => {
  item.addEventListener("click", async () => {
    document.getElementById("profile-menu").classList.add("hidden");
    const act = item.dataset.act;
    if (act === "setup") showPanel("setup");
    if (act === "account") {
      showPanel("account");
      renderAccount();
    }
    if (act === "logout") {
      state.session = null;
      await storageSet({ rjm_session: null });
      renderAccount();
      renderOverview();
    }
  });
});

document.getElementById("back-overview")?.addEventListener("click", () => showPanel("overview"));
document.getElementById("back-overview-2")?.addEventListener("click", () => showPanel("overview"));

document.getElementById("onboarding-dismiss")?.addEventListener("click", async () => {
  state.onboardingDismissed = true;
  await storageSet({ rjm_onboarding_dismissed: true });
  renderOnboarding();
});

document.getElementById("ov-clear-matches")?.addEventListener("click", async () => {
  state.matchHistory = [];
  state.lastMatchScores = [];
  await storageSet({ rjm_match_history: [], rjm_last_match_scores: [] });
  renderOverview();
});

document.getElementById("clear-history-btn")?.addEventListener("click", async () => {
  state.appliedLog = [];
  await storageSet({ rjm_applied_log: [] });
  renderOverview();
});

document.getElementById("save-key-btn")?.addEventListener("click", async () => {
  const v = (document.getElementById("api-key-input").value || "").trim();
  if (!v) return;
  state.apiKey = v;
  await storageSet({ rjm_apikey: v });
  document.getElementById("api-key-input").value = "";
  renderKeyStatus();
  renderOverview();
});

document.getElementById("account-login-btn")?.addEventListener("click", async () => {
  const status = document.getElementById("account-status");
  const email = document.getElementById("account-email-input").value.trim();
  const password = document.getElementById("account-password-input").value;
  if (!email || !password) { status.textContent = "Enter email and password."; return; }
  status.textContent = "Logging in…";
  try {
    const data = await supabaseAuth("/auth/v1/token?grant_type=password", { email, password });
    state.session = sessionFromAuth(data);
    await storageSet({ rjm_session: state.session });
    status.textContent = "Logged in.";
    renderAccount();
    renderOverview();
  } catch (e) {
    status.textContent = e.message;
  }
});

document.getElementById("account-signup-btn")?.addEventListener("click", async () => {
  const status = document.getElementById("account-status");
  const email = document.getElementById("account-email-input").value.trim();
  const password = document.getElementById("account-password-input").value;
  if (!email || password.length < 6) { status.textContent = "Use email + password (6+ chars)."; return; }
  status.textContent = "Creating…";
  try {
    await supabaseAuth("/auth/v1/signup", { email, password });
    status.textContent = "Account created — log in.";
  } catch (e) {
    status.textContent = e.message;
  }
});

document.getElementById("account-logout-btn")?.addEventListener("click", async () => {
  state.session = null;
  await storageSet({ rjm_session: null });
  renderAccount();
  renderOverview();
});

document.getElementById("account-save-profile-btn")?.addEventListener("click", async () => {
  state.displayName = document.getElementById("account-display-name").value.trim();
  const color = document.getElementById("account-avatar-color").value.trim();
  if (color) state.avatarColor = color;
  await storageSet({ rjm_display_name: state.displayName, rjm_avatar_color: state.avatarColor });
  renderProfileMenu();
  renderOverview();
});

document.getElementById("google-login-btn")?.addEventListener("click", async () => {
  const status = document.getElementById("account-status");
  status.textContent = "Google sign-in requires OAuth client setup in this build. Use email login.";
});

loadAll();
