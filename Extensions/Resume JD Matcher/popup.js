/* =========================================================================
   CONFIG — fill these in with YOUR Supabase project before you ship this
   extension to anyone. These two values are safe to ship inside the
   extension (the anon key is meant to be public; row-level security in
   Postgres is what actually protects each user's data).
   ========================================================================= */
const SUPABASE_URL = "https://uxwtpbprvtaewnxyiztv.supabase.co";

const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4d3RwYnBydnRhZXdueHlpenR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MDYwMDMsImV4cCI6MjA5NzM4MjAwM30.TgB6bYukp_igt2zZmt-h9CCzFw7CqS6CM6EiAUPrspo";        // TODO: replace
const SEND_EMAIL_FN_URL = SUPABASE_URL + "/functions/v1/resend-email";

// Only fast, reliable free/low-cost models here — NOT a giant 100+ model
// list. Trying models one-by-one with a long timeout is what makes a match
// take minutes; a short list raced in parallel (see callOpenRouter) is what
// keeps a single resume result landing in a few seconds.
const FALLBACK_FREE_MODELS = [
  "google/gemini-2.5-flash-lite",
  "google/gemini-2.5-flash",
  "qwen/qwen3-30b-a3b:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "deepseek/deepseek-chat-v3.1:free",
  "mistralai/mistral-small-3.2-24b-instruct:free",
  "moonshotai/kimi-k2:free"
];
let state = {
  resumes: [null, null, null, null, null],
  apiKey: null,
  models: FALLBACK_FREE_MODELS.slice(),
  selectedResumeIdx: new Set(),
  session: null,        // { access_token, refresh_token, expires_at, user: { id, email } }
  profile: null,        // { streak_count, last_active }
  lastJdMeta: null,      // { pageTitle, url } captured on "Grab from page"
  theme: "light",
  displayName: "",
  avatarColor: "#111111",
  plan: "free",          // "free" | "pro"
  licenseKey: null,
  usage: { date: null, count: 0 },
  autofillResumeIdx: null,
  lastScanFields: null,
  qaBank: [],             // [{ id, normLabel, rawLabel, answer, updatedAt }] — learned answers, reused across every site
  appliedLog: []          // [{ company, role, resumeName, score, answer, at }]
};

const DAILY_FREE_MATCH_LIMIT = 20;
const VALID_LICENSE_PREFIX = "RJM-PRO-"; // licenses you issue manually look like RJM-PRO-XXXXXXXX

// Weights used to turn the AI's four sub-scores into one final percentage.
// Skills + experience carry the most weight because they're what recruiters
// actually screen on first; requirements coverage and education round it
// out. Bonus points are added on top and are resume-specific, which is why
// two different resumes against the same JD land on different numbers.
const SCORE_WEIGHTS = { skills: 0.40, experience: 0.30, requirements: 0.20, education: 0.10 };
const MAX_BONUS = 8;

function escapeHtml(s) {
  return (s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function normalizeLabel(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[*:?]/g, " ")
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}
function storageSet(obj) {
  return new Promise((resolve) => chrome.storage.local.set(obj, resolve));
}

async function loadAll() {
  const data = await storageGet([
    "rjm_resumes", "rjm_apikey", "rjm_models", "rjm_session",
    "rjm_theme", "rjm_display_name", "rjm_avatar_color",
    "rjm_plan", "rjm_license_key", "rjm_usage",
    "rjm_autofill_resume_idx", "rjm_qa_bank", "rjm_applied_log"
  ]);
  if (data.rjm_resumes) state.resumes = data.rjm_resumes;
  if (data.rjm_apikey) state.apiKey = data.rjm_apikey;
  if (data.rjm_models) state.models = data.rjm_models;
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

  applyTheme();
  resetUsageIfNewDay();
  renderResumeSlots();
  renderResumePicker();
  renderAutofillResumePicker();
  renderModelList();
  renderKeyStatus();

  // First resume uploaded automatically becomes the active autofill profile
  // until the user changes it — no extra step needed before autofilling.
  if (state.autofillResumeIdx == null) {
    const firstFilled = state.resumes.findIndex((r) => r);
    if (firstFilled !== -1) {
      state.autofillResumeIdx = firstFilled;
      await persistAutofillResumeIdx();
    }
  }
  await syncActiveFacts();
  renderAutofillResumePicker();
  renderActiveFactsEditor();
  renderQaBank();

  if (state.session) {
    await ensureFreshSession();
    if (state.session) await refreshProfile();
  }
  renderAccountPanel();
  renderMatchGate();
  renderProfileMenu();
  renderUsageBanner();
  renderPlanSection();
  checkApplicationDetected();
}

function persistResumes() { return storageSet({ rjm_resumes: state.resumes }); }
function persistModels() { return storageSet({ rjm_models: state.models }); }
function persistSession() { return storageSet({ rjm_session: state.session }); }
function persistTheme() { return storageSet({ rjm_theme: state.theme }); }
function persistProfileFields() { return storageSet({ rjm_display_name: state.displayName, rjm_avatar_color: state.avatarColor }); }
function persistPlan() { return storageSet({ rjm_plan: state.plan, rjm_license_key: state.licenseKey }); }
function persistUsage() { return storageSet({ rjm_usage: state.usage }); }
function persistAutofillResumeIdx() { return storageSet({ rjm_autofill_resume_idx: state.autofillResumeIdx }); }
function persistQaBank() { return storageSet({ rjm_qa_bank: state.qaBank }); }
function persistAppliedLog() { return storageSet({ rjm_applied_log: state.appliedLog }); }

// =========================================================================
// Application-detection banner (set by background.js + detect_application.js)
// =========================================================================
async function checkApplicationDetected() {
  try {
    chrome.runtime.sendMessage({ type: "rjm_check_application" }, (resp) => {
      const bannerMatch = document.getElementById("app-detected-banner-match");
      const bannerAutofill = document.getElementById("app-detected-banner-autofill");
      const detected = !!(resp && resp.detected);
      if (bannerMatch) bannerMatch.classList.toggle("hidden", !detected);
      if (bannerAutofill) bannerAutofill.classList.toggle("hidden", !detected);
    });
  } catch (e) { /* ignore */ }
}

// =========================================================================
// Theme (dark / light) — pure black & white minimalist, no accent color
// =========================================================================
function applyTheme() {
  document.documentElement.setAttribute("data-theme", state.theme);
  const sun = document.getElementById("theme-icon-sun");
  const moon = document.getElementById("theme-icon-moon");
  if (sun && moon) {
    sun.style.display = state.theme === "dark" ? "none" : "block";
    moon.style.display = state.theme === "dark" ? "block" : "none";
  }
}

document.getElementById("theme-toggle-btn").addEventListener("click", async () => {
  state.theme = state.theme === "dark" ? "light" : "dark";
  applyTheme();
  await persistTheme();
});

// =========================================================================
// Profile avatar + dropdown menu
// =========================================================================
function initialFor(emailOrName) {
  const s = (emailOrName || "").trim();
  return s ? s[0].toUpperCase() : "?";
}

function renderProfileMenu() {
  const initial = initialFor(state.displayName || (state.session && state.session.user && state.session.user.email));
  const color = state.avatarColor || "#111111";

  ["avatar-initial", "avatar-initial-lg"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = initial;
  });
  document.getElementById("avatar-btn").style.background = color;
  document.getElementById("avatar-lg").style.background = color;

  const emailEl = document.getElementById("profile-menu-email");
  const planEl = document.getElementById("profile-menu-plan");
  if (state.session && state.session.user) {
    emailEl.textContent = state.displayName || state.session.user.email;
  } else {
    emailEl.textContent = "Not signed in";
  }
  planEl.textContent = state.plan === "pro" ? "Pro plan" : "Free plan";

  const accAvatar = document.getElementById("account-avatar-lg");
  const accInitial = document.getElementById("account-avatar-initial");
  if (accAvatar && accInitial) {
    accAvatar.style.background = color;
    accInitial.textContent = initial;
  }
}

document.getElementById("avatar-btn").addEventListener("click", (e) => {
  e.stopPropagation();
  document.getElementById("profile-menu").classList.toggle("hidden");
});

document.addEventListener("click", (e) => {
  const menu = document.getElementById("profile-menu");
  const btn = document.getElementById("avatar-btn");
  if (!menu.classList.contains("hidden") && !menu.contains(e.target) && e.target !== btn) {
    menu.classList.add("hidden");
  }
});

document.querySelectorAll(".profile-menu-item").forEach((item) => {
  item.addEventListener("click", () => {
    document.getElementById("profile-menu").classList.add("hidden");
    const act = item.dataset.act;
    if (act === "goto-account" || act === "goto-upgrade") goToTab("account");
    if (act === "logout") document.getElementById("account-logout-btn").click();
    if (act === "goto-upgrade") {
      setTimeout(() => {
        const planSection = document.getElementById("account-plan-section");
        if (planSection) planSection.scrollIntoView({ behavior: "smooth" });
      }, 80);
    }
  });
});

document.getElementById("account-save-profile-btn").addEventListener("click", async () => {
  state.displayName = document.getElementById("account-display-name").value.trim();
  const color = document.getElementById("account-avatar-color").value.trim();
  if (color) state.avatarColor = color;
  await persistProfileFields();
  renderProfileMenu();
});

// =========================================================================
// Daily usage limits (free tier: 20 matches/day; autofill always unlimited)
// =========================================================================
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function resetUsageIfNewDay() {
  if (state.usage.date !== todayStr()) {
    state.usage = { date: todayStr(), count: 0 };
    persistUsage();
  }
}

function matchesRemainingToday() {
  if (state.plan === "pro") return Infinity;
  resetUsageIfNewDay();
  return Math.max(0, DAILY_FREE_MATCH_LIMIT - state.usage.count);
}

async function recordMatchUsage() {
  if (state.plan === "pro") return;
  resetUsageIfNewDay();
  state.usage.count += 1;
  await persistUsage();
}

function renderUsageBanner() {
  const banner = document.getElementById("usage-banner");
  if (state.plan === "pro") {
    banner.classList.add("hidden");
    return;
  }
  resetUsageIfNewDay();
  const remaining = matchesRemainingToday();
  banner.classList.remove("hidden");
  banner.classList.toggle("limit-hit", remaining <= 0);
  banner.textContent = remaining > 0
    ? `Free plan: ${remaining} of ${DAILY_FREE_MATCH_LIMIT} matches left today \u00b7 Autofill is unlimited`
    : `You've used today's ${DAILY_FREE_MATCH_LIMIT} free matches. Resets at midnight, or upgrade for unlimited.`;
}

// =========================================================================
// Plan / paywall / license
// =========================================================================
function renderPlanSection() {
  const wrap = document.getElementById("account-plan-section");
  if (!wrap) return;

  if (state.plan === "pro") {
    wrap.innerHTML = `
      <div class="row-between">
        <span class="plan-badge pro">Pro plan active</span>
        <span class="hint" style="margin:0;">License ${escapeHtml((state.licenseKey || "").slice(0, 12))}&hellip;</span>
      </div>
      <p class="hint" style="margin-top:8px;">Unlimited matches, unlimited autofill, no daily reset.</p>
    `;
    return;
  }

  wrap.innerHTML = `
  <p class="hint">
    Free plan active.
  </p>
`;

  const redeemBtn = document.getElementById("license-redeem-btn");
  if (redeemBtn) {
    redeemBtn.addEventListener("click", async () => {
      const input = document.getElementById("license-input");
      const statusEl = document.getElementById("license-status");
      const code = input.value.trim().toUpperCase();
      if (!code.startsWith(VALID_LICENSE_PREFIX) || code.length < VALID_LICENSE_PREFIX.length + 6) {
        statusEl.textContent = "That doesn't look like a valid license code.";
        statusEl.style.color = "var(--danger-text)";
        return;
      }
      state.plan = "pro";
      state.licenseKey = code;
      await persistPlan();
      renderPlanSection();
      renderUsageBanner();
      renderProfileMenu();
      statusEl.textContent = "";
    });
  }
}

const RAZORPAY_LINK_MONTHLY = "https://razorpay.me/@yourbrand?monthly"; // TODO: replace with your real Razorpay Payment Link
const RAZORPAY_LINK_YEARLY = "https://razorpay.me/@yourbrand?yearly";   // TODO: replace with your real Razorpay Payment Link

const PAY_LOGOS = `
<svg viewBox="0 0 38 24" width="34" height="22" aria-label="Visa"><rect width="38" height="24" rx="4" fill="#1434CB"/><text x="19" y="16" font-family="Arial, sans-serif" font-size="9" font-weight="700" fill="#fff" text-anchor="middle" font-style="italic">VISA</text></svg>
<svg viewBox="0 0 38 24" width="34" height="22" aria-label="Mastercard"><rect width="38" height="24" rx="4" fill="#16203A"/><circle cx="16" cy="12" r="6.2" fill="#EB001B"/><circle cx="23" cy="12" r="6.2" fill="#F79E1B" opacity="0.95"/></svg>
<svg viewBox="0 0 38 24" width="34" height="22" aria-label="RuPay"><rect width="38" height="24" rx="4" fill="#fff" stroke="#ddd"/><text x="19" y="15" font-family="Arial, sans-serif" font-size="7.5" font-weight="800" fill="#0a5c36" text-anchor="middle">RuPay</text></svg>
<svg viewBox="0 0 38 24" width="34" height="22" aria-label="UPI"><rect width="38" height="24" rx="4" fill="#fff" stroke="#ddd"/><text x="19" y="15" font-family="Arial, sans-serif" font-size="8.5" font-weight="800" fill="#4d4d4d" text-anchor="middle">UPI</text></svg>
<svg viewBox="0 0 38 24" width="34" height="22" aria-label="Google Pay"><rect width="38" height="24" rx="4" fill="#fff" stroke="#ddd"/><text x="19" y="15" font-family="Arial, sans-serif" font-size="6.5" font-weight="700" fill="#5f6368" text-anchor="middle">G Pay</text></svg>
<svg viewBox="0 0 38 24" width="34" height="22" aria-label="PhonePe"><rect width="38" height="24" rx="4" fill="#5f259f"/><text x="19" y="15" font-family="Arial, sans-serif" font-size="6.5" font-weight="700" fill="#fff" text-anchor="middle">PhonePe</text></svg>
`;

// ---------- Tabs ----------
document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b === btn));
    document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("active", p.id === "panel-" + tab));
  });
});

function goToTab(tab) {
  document.querySelector('.tab[data-tab="' + tab + '"]').click();
}

// =========================================================================
// Account: Supabase auth (email + password), profile, streaks, gating
// =========================================================================

async function supabaseAuthRequest(path, body) {
  const res = await fetch(SUPABASE_URL + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error_description || data.msg || data.error || "Request failed (" + res.status + ")");
  }
  return data;
}

function sessionFromAuthResponse(data) {
  if (!data || !data.access_token) return null;
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000,
    user: { id: data.user && data.user.id, email: data.user && data.user.email }
  };
}

async function ensureFreshSession() {
  if (!state.session) return;
  if (state.session.expires_at - Date.now() > 60000) return;
  try {
    const data = await supabaseAuthRequest("/auth/v1/token?grant_type=refresh_token", {
      refresh_token: state.session.refresh_token
    });
    state.session = sessionFromAuthResponse(data);
    await persistSession();
  } catch (e) {
    state.session = null;
    state.profile = null;
    await persistSession();
  }
}

async function authedFetch(url, options) {
  await ensureFreshSession();
  if (!state.session) throw new Error("Not logged in");
  const opts = options || {};
  opts.headers = Object.assign(
    { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + state.session.access_token },
    opts.headers || {}
  );
  return fetch(url, opts);
}

async function refreshProfile() {
  if (!state.session) return;
  try {
    const res = await authedFetch(
      SUPABASE_URL + "/rest/v1/profiles?id=eq." + state.session.user.id + "&select=streak_count,last_active"
    );
    const rows = await res.json();
    state.profile = (rows && rows[0]) || { streak_count: 0, last_active: null };
  } catch (e) {
    console.warn("Could not load profile/streak", e);
  }
}

// =========================================================================
// Transactional email — every "match" email now carries the full breakdown
// (not just the score), the company name, and a real "Open application"
// link back to the exact page the JD was grabbed from.
// =========================================================================
function scoreBand(score) {
  if (score >= 80) return "Strong match";
  if (score >= 60) return "Good match";
  if (score >= 40) return "Possible match";
  return "Weak match";
}

async function sendTransactionalEmail(type, payload) {
  if (!state.session?.user?.email) return;

  let subject = "";
  let html = "";

  if (type === "welcome") {
    subject = "Welcome to JobScan — You\'re In";
    html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
        *{margin:0;padding:0;box-sizing:border-box;}
        body{background:#0d0d0c;color:#f5f5f3;font-family:Inter,Arial,sans-serif;min-height:100vh;padding:0;}
        .shell{max-width:580px;margin:0 auto;background:#0d0d0c;padding:48px 36px 56px;}
        .logo-row{display:flex;align-items:center;gap:10px;margin-bottom:48px;}
        .logo-dot{width:10px;height:10px;border-radius:50%;background:#f5f5f3;}
        .logo-text{font-size:15px;font-weight:800;letter-spacing:1.5px;color:#f5f5f3;}
        .hero-score{font-size:96px;font-weight:900;letter-spacing:-0.04em;line-height:1;color:#f5f5f3;margin-bottom:12px;}
        .hero-label{font-size:13px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#7c7b76;margin-bottom:32px;}
        .headline{font-size:32px;font-weight:800;line-height:1.15;letter-spacing:-0.02em;color:#f5f5f3;margin-bottom:16px;}
        .sub{font-size:15px;color:#b3b2ac;line-height:1.6;margin-bottom:36px;}
        .divider{border:none;border-top:1px solid #2c2c29;margin:36px 0;}
        .steps-title{font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#7c7b76;margin-bottom:20px;}
        .step{display:flex;align-items:flex-start;gap:16px;margin-bottom:20px;}
        .step-num{width:28px;height:28px;border-radius:50%;border:1px solid #3c3c38;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#f5f5f3;flex-shrink:0;margin-top:1px;}
        .step-body{}
        .step-title{font-size:13px;font-weight:700;color:#f5f5f3;margin-bottom:3px;}
        .step-desc{font-size:12px;color:#7c7b76;line-height:1.45;}
        .cta-row{margin-top:36px;}
        .cta-btn{display:inline-block;padding:14px 28px;background:#f5f5f3;color:#0d0d0c;font-size:13px;font-weight:700;text-decoration:none;border-radius:10px;letter-spacing:0.01em;}
        .footer{margin-top:48px;font-size:11px;color:#3c3c38;line-height:1.5;}
      </style>
    </head>
    <body>
    <div class="shell">
      <div class="logo-row">
        <div class="logo-dot"></div>
        <span class="logo-text">JOBSCAN</span>
      </div>
      <div class="hero-score">100</div>
      <div class="hero-label">Your starting score</div>
      <div class="headline">Your account is live.<br>Let\'s get you hired.</div>
      <p class="sub">You\'ve just unlocked smart resume matching, instant autofill, and a Q&amp;A bank that remembers every answer you\'ve ever typed — on any job site, forever.</p>
      <hr class="divider">
      <div class="steps-title">Get started in 3 steps</div>
      <div class="step">
        <div class="step-num">1</div>
        <div class="step-body">
          <div class="step-title">Upload your resume</div>
          <div class="step-desc">Open the Resumes tab and drop in your .txt or .docx. Takes 5 seconds.</div>
        </div>
      </div>
      <div class="step">
        <div class="step-num">2</div>
        <div class="step-body">
          <div class="step-title">Grab a job description</div>
          <div class="step-desc">Navigate to any job posting and hit "Grab from page" to pull it in instantly.</div>
        </div>
      </div>
      <div class="step">
        <div class="step-num">3</div>
        <div class="step-body">
          <div class="step-title">Run your first match</div>
          <div class="step-desc">See exactly how your resume scores against the JD — with actionable tips to improve it.</div>
        </div>
      </div>
      <div class="cta-row">
        <a href="https://jobscan.ai" class="cta-btn">Open JobScan &rarr;</a>
      </div>
      <div class="footer">You\'re receiving this because you just created a JobScan account. No spam, ever.</div>
    </div>
    </body></html>`;
  }

  if (type === "login") {
    subject = "Welcome back — JobScan";
    html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <style>
        *{margin:0;padding:0;box-sizing:border-box;}
        body{background:#0d0d0c;color:#f5f5f3;font-family:Inter,Arial,sans-serif;}
        .shell{max-width:580px;margin:0 auto;padding:48px 36px 56px;}
        .logo-row{display:flex;align-items:center;gap:10px;margin-bottom:52px;}
        .logo-dot{width:10px;height:10px;border-radius:50%;background:#f5f5f3;}
        .logo-text{font-size:15px;font-weight:800;letter-spacing:1.5px;}
        .welcome-line{font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#7c7b76;margin-bottom:12px;}
        .headline{font-size:38px;font-weight:900;letter-spacing:-0.03em;line-height:1.1;color:#f5f5f3;margin-bottom:20px;}
        .sub{font-size:14px;color:#b3b2ac;line-height:1.65;margin-bottom:36px;}
        .stat-row{display:flex;gap:1px;margin-bottom:36px;}
        .stat-box{flex:1;background:#151513;border:1px solid #2c2c29;border-radius:10px;padding:16px 18px;}
        .stat-box+.stat-box{border-radius:10px;margin-left:8px;}
        .stat-val{font-size:24px;font-weight:800;letter-spacing:-0.02em;color:#f5f5f3;margin-bottom:4px;}
        .stat-label{font-size:11px;color:#7c7b76;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;}
        .divider{border:none;border-top:1px solid #2c2c29;margin:32px 0;}
        .cta-btn{display:inline-block;padding:13px 26px;background:#f5f5f3;color:#0d0d0c;font-size:13px;font-weight:700;text-decoration:none;border-radius:9px;}
        .footer{margin-top:44px;font-size:11px;color:#3c3c38;}
      </style>
    </head>
    <body>
    <div class="shell">
      <div class="logo-row">
        <div class="logo-dot"></div>
        <span class="logo-text">JOBSCAN</span>
      </div>
      <div class="welcome-line">Welcome back</div>
      <div class="headline">Good to see you<br>again.</div>
      <p class="sub">You\'re signed in and ready to match resumes, autofill applications, and track your progress. Your saved resumes, answers, and profile are exactly where you left them.</p>
      <div class="stat-row">
        <div class="stat-box">
          <div class="stat-val">20</div>
          <div class="stat-label">Free matches today</div>
        </div>
        <div class="stat-box">
          <div class="stat-val">∞</div>
          <div class="stat-label">Autofill remaining</div>
        </div>
      </div>
      <hr class="divider">
      <a href="https://jobscan.ai" class="cta-btn">Start matching &rarr;</a>
      <div class="footer">Signed in just now. If this wasn\'t you, change your password immediately.</div>
    </div>
    </body></html>`;
  }

  if (type === "match") {
    const b = payload.breakdown || {};
    const matched = payload.matched || [];
    const missing = payload.missing || [];
    const nice = payload.nice || [];
    const tips = payload.tips || [];
    const bonus = payload.bonus || [];
    const jdUrl = payload.jdUrl || "";

    const GENERIC_HOSTS = ["linkedin.com","indeed.com","glassdoor.com","naukri.com","monster.com","simplyhired.com","ziprecruiter.com","dice.com","unstop.com","internshala.com","wellfound.com","angel.co","greenhouse.io","lever.co","workday.com","taleo.net","myworkdayjobs.com","icims.com"];
    const matchCompanyIsGeneric = !payload.company || payload.company === "Unknown company" || GENERIC_HOSTS.some(h => (payload.company || "").toLowerCase().includes(h));
    const matchEmailTitle = matchCompanyIsGeneric ? payload.role : payload.company;
    subject = `${matchEmailTitle} \u2014 ${payload.score}% match \u2014 JobScan`;

    const row = (label, val) => `<tr><td style="padding:6px 0;color:#666;width:160px;">${escapeHtml(label)}</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(String(val))}</td></tr>`;
    const barRow = (label, val) => {
      const band = val >= 80 ? "Strong" : val >= 60 ? "Good" : val >= 40 ? "Fair" : "Weak";
      const bandBg = val >= 80 ? "#0d0d0c" : val >= 60 ? "#2c2c29" : val >= 40 ? "#3c3c38" : "#f5f5f3";
      const bandTxt = val >= 80 ? "#f5f5f3" : val >= 60 ? "#f5f5f3" : val >= 40 ? "#f5f5f3" : "#0d0d0c";
      const border = val < 80 ? "1px solid #d3d2cd" : "none";
      return `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0ee;font-size:13px;color:#444;vertical-align:middle;">${escapeHtml(label)}</td>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0ee;text-align:right;vertical-align:middle;">
          <span style="display:inline-block;padding:4px 10px;border-radius:99px;background:${bandBg};color:${bandTxt};font-size:12px;font-weight:700;border:${border};">${val}% &nbsp;${band}</span>
        </td>
      </tr>`;
    };

    html = `
    <body style="background:#ffffff;color:#111111;font-family:Inter,Arial,sans-serif;max-width:600px;margin:auto;padding:40px;">
      <h1 style="font-size:30px;margin-bottom:0;letter-spacing:-0.02em;">JobScan</h1>
      <p style="color:#666;margin-top:4px;">Full resume match report</p>
      <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0;">

      <div style="border:1px solid #111;border-radius:14px;padding:24px;text-align:center;">
        <div style="font-size:48px;font-weight:700;letter-spacing:-0.02em;">${payload.score}%</div>
        <div style="margin-top:6px;font-weight:600;">${escapeHtml(payload.recommendation || scoreBand(payload.score))}</div>
      </div>

      <table style="width:100%;margin-top:20px;border-collapse:collapse;font-size:13px;">
        ${matchCompanyIsGeneric ? "" : row("Company", payload.company)}
        ${row("Role", payload.role)}
        ${row("Resume used", payload.resume_name)}
      </table>

      ${jdUrl ? `<a href="${escapeHtml(jdUrl)}" style="display:inline-block;margin-top:18px;padding:12px 22px;background:#111;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:13px;">Open application \u2192</a>` : ""}

      <hr style="border:none;border-top:1px solid #e5e5e5;margin:26px 0;">

      <h3 style="margin-bottom:14px;">Score breakdown</h3>
      <table style="width:100%;border-collapse:collapse;">
      ${barRow("Skills match", b.skills != null ? b.skills : 0)}
      ${barRow("Experience fit", b.experience != null ? b.experience : 0)}
      ${barRow("Requirements coverage", b.requirements != null ? b.requirements : 0)}
      ${barRow("Education / extras", b.education != null ? b.education : 0)}
      </table>

      ${bonus.length ? `
        <h3 style="margin-top:22px;margin-bottom:10px;">What gave this resume a boost</h3>
        <ul style="font-size:13px;color:#222;padding-left:18px;">
          ${bonus.map((x) => `<li style="margin-bottom:5px;">+${x.points} \u2014 ${escapeHtml(x.reason)}</li>`).join("")}
        </ul>` : ""}

      ${matched.length ? `
        <h3 style="margin-top:22px;margin-bottom:10px;">Matched requirements</h3>
        <ul style="font-size:13px;color:#222;padding-left:18px;">
          ${matched.map((m) => `<li style="margin-bottom:5px;"><b>${escapeHtml(m.requirement)}</b> \u2014 ${escapeHtml(m.evidence)}</li>`).join("")}
        </ul>` : ""}

      ${missing.length ? `
        <h3 style="margin-top:22px;margin-bottom:10px;">Missing or weak</h3>
        <ul style="font-size:13px;color:#222;padding-left:18px;">
          ${missing.map((m) => `<li style="margin-bottom:5px;"><b>${escapeHtml(m.requirement)}</b> \u2014 ${escapeHtml(m.note)}</li>`).join("")}
        </ul>` : ""}

      ${nice.length ? `
        <h3 style="margin-top:22px;margin-bottom:10px;">Nice-to-have matches</h3>
        <ul style="font-size:13px;color:#222;padding-left:18px;">
          ${nice.map((m) => `<li style="margin-bottom:5px;"><b>${escapeHtml(m.requirement)}</b> \u2014 ${escapeHtml(m.evidence)}</li>`).join("")}
        </ul>` : ""}

      ${tips.length ? `
        <h3 style="margin-top:22px;margin-bottom:10px;">Tailoring tips</h3>
        <ul style="font-size:13px;color:#222;padding-left:18px;">
          ${tips.map((t) => `<li style="margin-bottom:5px;">${escapeHtml(t)}</li>`).join("")}
        </ul>` : ""}

      <hr style="border:none;border-top:1px solid #e5e5e5;margin:26px 0;">
      <p style="color:#666;font-size:12px;">Keep improving your resume and continue matching against new jobs.</p>
    </body>`;
  }

  if (type === "applied") {
    const appliedDisplayName = payload.company || payload.role;
    subject = `Applied: ${appliedDisplayName} — JobScan`;
    html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <style>
        *{margin:0;padding:0;box-sizing:border-box;}
        body{background:#fff;color:#111;font-family:Inter,Arial,sans-serif;}
        .shell{max-width:560px;margin:0 auto;padding:40px 32px 48px;}
        .logo-row{display:flex;align-items:center;gap:8px;margin-bottom:40px;}
        .logo-dot{width:8px;height:8px;border-radius:50%;background:#111;}
        .logo-text{font-size:13px;font-weight:800;letter-spacing:1.2px;color:#111;}
        .check-circle{width:52px;height:52px;border-radius:50%;background:#0d0d0c;display:flex;align-items:center;justify-content:center;margin-bottom:24px;}
        .headline{font-size:26px;font-weight:800;letter-spacing:-0.02em;color:#111;margin-bottom:10px;}
        .sub{font-size:14px;color:#666;line-height:1.6;margin-bottom:28px;}
        .detail-box{background:#f8f8f7;border-radius:10px;padding:18px 20px;margin-bottom:28px;}
        .detail-row{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #ebebea;font-size:13px;}
        .detail-row:last-child{border-bottom:none;}
        .detail-label{color:#888;}
        .detail-val{font-weight:600;color:#111;text-align:right;max-width:60%;}
        .footer{font-size:11px;color:#bbb;margin-top:32px;}
      </style>
    </head>
    <body>
    <div class="shell">
      <div class="logo-row">
        <div class="logo-dot"></div>
        <span class="logo-text">JOBSCAN</span>
      </div>
      <div class="check-circle">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <div class="headline">Application logged.</div>
      <p class="sub">Great work. Consistent applications are how offers happen — keep the momentum going.</p>
      <div class="detail-box">
        ${payload.company ? `<div class="detail-row"><span class="detail-label">Company</span><span class="detail-val">${escapeHtml(payload.company)}</span></div>` : ""}
        <div class="detail-row"><span class="detail-label">Role</span><span class="detail-val">${escapeHtml(payload.role)}</span></div>
        ${payload.resumeName ? `<div class="detail-row"><span class="detail-label">Resume used</span><span class="detail-val">${escapeHtml(payload.resumeName)}</span></div>` : ""}
        <div class="detail-row"><span class="detail-label">Applied at</span><span class="detail-val">${new Date().toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"})}</span></div>
      </div>
      <div class="footer">Tracked by JobScan. You\'re building momentum.</div>
    </div>
    </body></html>`;
  }

  if (type === "daily-summary") {
    subject = "Daily Progress Report";
    html = `
    <body style="background:#fff;color:#111;font-family:Inter,Arial,sans-serif;max-width:600px;margin:auto;padding:40px;">
      <h1>Today's Progress</h1>
      <p>Matches Analyzed: ${payload.matches}</p>
      <p>Average Score: ${payload.averageScore}%</p>
      <p>Best Match: ${payload.bestMatch}</p>
      ${payload.averageScore < 60 ? `
        <hr>
        <p>Most candidates require multiple applications before landing the right opportunity.</p>
        <p>Come back tomorrow and improve your score.</p>` : ""}
    </body>`;
  }

  if (!subject) return;

  authedFetch(SEND_EMAIL_FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to: state.session.user.email, subject, html })
  }).catch((e) => console.error("EMAIL FAILED:", e));
}

function renderAccountPanel() {
  const loggedOut = document.getElementById("account-logged-out");
  const loggedIn = document.getElementById("account-logged-in");
  if (state.session) {
    loggedOut.classList.add("hidden");
    loggedIn.classList.remove("hidden");
    document.getElementById("account-email-display").textContent = state.session.user.email;
    document.getElementById("account-display-name").value = state.displayName || "";
    document.getElementById("account-avatar-color").value = state.avatarColor || "";
    const streak = (state.profile && state.profile.streak_count) || 0;
    document.getElementById("account-streak-score").textContent = streak + "\u{1F525}";
    document.getElementById("account-streak-sub").textContent = streak > 0
      ? "Day " + streak + " — keep it going!"
      : "Run a match today to start your streak.";

    resetUsageIfNewDay();
    const used = state.plan === "pro" ? 0 : state.usage.count;
    const limit = DAILY_FREE_MATCH_LIMIT;
    const usageScoreEl = document.getElementById("account-usage-score");
    const usageSubEl = document.getElementById("account-usage-sub");
    const usageBarEl = document.getElementById("account-usage-bar");
    if (state.plan === "pro") {
      usageScoreEl.textContent = "\u221E";
      usageSubEl.textContent = "Unlimited on Pro";
      usageBarEl.style.width = "100%";
    } else {
      usageScoreEl.textContent = used + "/" + limit;
      usageSubEl.textContent = used + " of " + limit + " used today";
      usageBarEl.style.width = Math.min(100, (used / limit) * 100) + "%";
    }
  } else {
    loggedOut.classList.remove("hidden");
    loggedIn.classList.add("hidden");
  }
  renderProfileMenu();
}

function renderMatchGate() {
  document.getElementById("match-login-gate").classList.toggle("hidden", !!state.session);
  document.getElementById("match-content").classList.toggle("hidden", !state.session);
}

document.getElementById("match-goto-account-btn").addEventListener("click", () => goToTab("account"));

function setAuthBusy(busy) {
  const loginBtn = document.getElementById("account-login-btn");
  const signupBtn = document.getElementById("account-signup-btn");
  const googleBtn = document.getElementById("google-login-btn");
  [loginBtn, signupBtn, googleBtn].forEach((b) => { if (b) b.disabled = busy; });
}

async function doEmailLogin() {
  const statusEl = document.getElementById("account-status");
  const email = document.getElementById("account-email-input").value.trim();
  const password = document.getElementById("account-password-input").value;

  if (!email || !password) {
    statusEl.textContent = "Enter your email and password.";
    return;
  }

  statusEl.textContent = "Logging in...";
  setAuthBusy(true);

  try {
    const data = await supabaseAuthRequest("/auth/v1/token?grant_type=password", { email, password });
    state.session = sessionFromAuthResponse(data);
    await persistSession();
    await refreshProfile();
    renderAccountPanel();
    renderMatchGate();
    statusEl.textContent = "Logged in.";
    document.getElementById("account-password-input").value = "";
    sendTransactionalEmail("login", { email: state.session?.user?.email });
  } catch (e) {
    console.error("LOGIN ERROR:", e);
    if (/invalid login credentials/i.test(e.message)) {
      statusEl.textContent = "No account found with that email/password. If you haven't signed up yet, click \"Create account\" first.";
    } else if (/email not confirmed/i.test(e.message)) {
      statusEl.textContent = "Check your inbox and confirm your email before logging in.";
    } else {
      statusEl.textContent = "Could not log in: " + e.message;
    }
  } finally {
    setAuthBusy(false);
  }
}

async function doEmailSignup() {
  const statusEl = document.getElementById("account-status");
  const email = document.getElementById("account-email-input").value.trim();
  const password = document.getElementById("account-password-input").value;

  if (!email || !password) { statusEl.textContent = "Enter an email and password."; return; }
  if (password.length < 6) { statusEl.textContent = "Password should be at least 6 characters."; return; }

  statusEl.textContent = "Creating account...";
  setAuthBusy(true);

  try {
    const data = await supabaseAuthRequest("/auth/v1/signup", { email, password });
    if (data.access_token) {
      state.session = sessionFromAuthResponse(data);
      await persistSession();
      await refreshProfile();
      renderAccountPanel();
      renderMatchGate();
      statusEl.textContent = "Account created and logged in.";
      sendTransactionalEmail("welcome", { email });
    } else {
      statusEl.textContent = "Account created. Check your email to confirm it, then log in above.";
    }
    document.getElementById("account-password-input").value = "";
  } catch (e) {
    console.error("SIGNUP ERROR:", e);
    if (/already registered|already exists|user already/i.test(e.message)) {
      statusEl.textContent = "An account already exists with that email \u2014 try logging in instead.";
    } else {
      statusEl.textContent = "Could not create account: " + e.message;
    }
  } finally {
    setAuthBusy(false);
  }
}

document.getElementById("account-login-btn").addEventListener("click", doEmailLogin);
document.getElementById("account-signup-btn").addEventListener("click", doEmailSignup);

["account-email-input", "account-password-input"].forEach((id) => {
  document.getElementById(id).addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      doEmailLogin();
    }
  });
});

document.getElementById("account-logout-btn").addEventListener("click", async () => {
  state.session = null;
  state.profile = null;
  chrome.storage.local.remove("rjm_session");
  await persistSession();
  renderAccountPanel();
  renderMatchGate();
});

document.getElementById("google-login-btn").addEventListener("click", async () => {
  const statusEl = document.getElementById("account-status");
  setAuthBusy(true);
  statusEl.textContent = "Opening Google sign-in...";
  try {
    const redirectUrl = chrome.identity.getRedirectURL();
    const authUrl = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectUrl)}`;

    chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, async (callbackUrl) => {
      if (chrome.runtime.lastError) {
        const msg = chrome.runtime.lastError.message || "Google sign-in was cancelled or blocked.";
        if (/authorization page could not be loaded/i.test(msg)) {
          statusEl.textContent =
            "Google sign-in isn't set up yet on the server side. In Supabase: Authentication \u2192 Providers \u2192 Google, then add " + redirectUrl + " under Redirect URLs.";
        } else {
          statusEl.textContent = "Google sign-in failed: " + msg;
        }
        setAuthBusy(false);
        return;
      }
      if (!callbackUrl || callbackUrl.indexOf("#") === -1) {
        statusEl.textContent = "Google sign-in didn't return a valid response.";
        setAuthBusy(false);
        return;
      }
      try {
        const hash = callbackUrl.split("#")[1];
        const params = new URLSearchParams(hash);
        const accessToken = params.get("access_token");
        if (!accessToken) {
          statusEl.textContent = "Google sign-in failed: " + (params.get("error_description") || params.get("error") || "No access token returned.");
          return;
        }
        const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` }
        });
        if (!userRes.ok) {
          statusEl.textContent = "Google sign-in failed: could not verify the account (" + userRes.status + ").";
          return;
        }
        const userData = await userRes.json();
        state.session = {
          access_token: accessToken,
          refresh_token: params.get("refresh_token"),
          expires_at: parseInt(params.get("expires_at"), 10) * 1000,
          user: { id: userData.id, email: userData.email }
        };
        await persistSession();
        await refreshProfile();
        renderAccountPanel();
        renderMatchGate();
        statusEl.textContent = "Logged in with Google.";
        sendTransactionalEmail("login", { email: userData.email });
      } catch (innerErr) {
        statusEl.textContent = "Google sign-in failed: " + innerErr.message;
      } finally {
        setAuthBusy(false);
      }
    });
  } catch (err) {
    statusEl.textContent = "Google sign-in failed: " + err.message;
    setAuthBusy(false);
  }
});

// ---------- API key (OpenRouter) — still used for the match-scoring AI call ----------
function renderKeyStatus() {
  const el = document.getElementById("key-status");
  el.textContent = state.apiKey
    ? "Key saved (ending in " + state.apiKey.slice(-4) + ")."
    : "No key saved yet. Get one free at openrouter.ai/keys.";
}

document.getElementById("save-key-btn").addEventListener("click", async () => {
  const input = document.getElementById("api-key-input");
  const v = input.value.trim();
  if (!v) return;
  state.apiKey = v;
  await storageSet({ rjm_apikey: v });
  input.value = "";
  renderKeyStatus();
});

// ---------- Model list ----------
function renderModelList() {
  const wrap = document.getElementById("model-list");
  wrap.innerHTML = "";
  state.models.forEach((m, i) => {
    const row = document.createElement("div");
    row.className = "model-row";
    row.innerHTML = `
      <span class="model-idx">${i + 1}</span>
      <span class="model-name">${escapeHtml(m)}</span>
      <button class="icon-btn" data-act="up" data-i="${i}" aria-label="Move up">&uarr;</button>
      <button class="icon-btn" data-act="down" data-i="${i}" aria-label="Move down">&darr;</button>
      <button class="icon-btn" data-act="remove" data-i="${i}" aria-label="Remove">&times;</button>
    `;
    wrap.appendChild(row);
  });

  const addRow = document.createElement("div");
  addRow.className = "add-model-row";
  addRow.innerHTML = `
    <input type="text" id="add-model-input" placeholder="provider/model-name:free" />
    <button class="btn-ghost-small" id="add-model-btn">Add</button>
  `;
  wrap.appendChild(addRow);

  const speedStatus = document.createElement("p");
  speedStatus.id = "model-speed-status";
  speedStatus.className = "hint";
  wrap.appendChild(speedStatus);

  wrap.querySelectorAll(".icon-btn").forEach((b) => {
    b.addEventListener("click", () => {
      const i = parseInt(b.dataset.i, 10);
      const act = b.dataset.act;
      if (act === "remove") {
        state.models.splice(i, 1);
      } else {
        const j = act === "up" ? i - 1 : i + 1;
        if (j < 0 || j >= state.models.length) return;
        [state.models[i], state.models[j]] = [state.models[j], state.models[i]];
      }
      persistModels();
      renderModelList();
    });
  });

  document.getElementById("add-model-btn").addEventListener("click", async () => {
    const inp = document.getElementById("add-model-input");
    const statusEl = document.getElementById("model-speed-status");
    const v = inp.value.trim();
    if (!v) return;
    inp.value = "";

    // Add it right away so it's usable even before/without a speed check.
    if (!state.models.includes(v)) state.models.push(v);
    persistModels();
    renderModelList();

    if (!state.apiKey) {
      const s = document.getElementById("model-speed-status");
      if (s) s.textContent = v + " added. Add an API key to auto speed-check it.";
      return;
    }

    const s1 = document.getElementById("model-speed-status");
    if (s1) s1.textContent = "Checking how fast " + v + " responds...";

    const fast = await quickSpeedCheck(v);
    if (fast) {
      // Strictly prioritize a verified-fast custom model — put it first so
      // it is always inside the race and gets tried right away.
      state.models = [v, ...state.models.filter((m) => m !== v)];
    }
    await persistModels();
    renderModelList();
    const s2 = document.getElementById("model-speed-status");
    if (s2) {
      s2.textContent = fast
        ? v + " is fast — moved to the top of the list."
        : v + " responded slowly — kept lower in the list as a backup only.";
    }
  });
}

// Lightweight ping (max_tokens: 5) used only to verify a manually-added
// model is fast enough to be raced for a result. Has nothing to do with
// resume scoring — purely decides list order/priority.
async function quickSpeedCheck(model) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);
  const t0 = performance.now();
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + state.apiKey,
        "HTTP-Referer": "https://github.com/resume-jd-matcher",
        "X-Title": "Resume JD Matcher"
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: "user", content: "Reply with just: OK" }],
        max_tokens: 5
      })
    });
    clearTimeout(timeoutId);
    const elapsed = performance.now() - t0;
    return res.ok && elapsed < MODEL_TIMEOUT_MS;
  } catch (e) {
    clearTimeout(timeoutId);
    return false;
  }
}

document.getElementById("refresh-models-btn").addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  const original = btn.textContent;
  btn.textContent = "Loading...";
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models");
    const data = await res.json();
    const free = (data.data || [])
      .filter((m) => m.id && m.id.endsWith(":free"))
      .map((m) => m.id)
      .slice(0, 15);
    if (free.length) {
      state.models = free;
      await persistModels();
      renderModelList();
    }
  } catch (err) {
    console.error("refresh models failed", err);
  }
  btn.textContent = original;
});

// =========================================================================
// Resumes — upload, store, and extract reusable "facts" (name/email/phone/
// links). Facts for the ACTIVE autofill resume are also mirrored into
// rjm_active_facts so the content script can read them directly without
// any popup round-trip.
// =========================================================================

// Pull simple structured fields out of raw resume text with cheap regexes —
// instant, free, no AI call.
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
  facts.coverLetter = facts.coverLetter || "";
  return facts;
}

// Re-derives facts for the currently active autofill resume and mirrors
// them (plus any manual edits the user has saved over them) into storage.
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
  const merged = Object.assign({}, base, overrides);
  await storageSet({ rjm_active_facts: merged });
}

async function setActiveAutofillResume(idx) {
  state.autofillResumeIdx = idx;
  await persistAutofillResumeIdx();
  await syncActiveFacts();
  renderAutofillResumePicker();
  renderActiveFactsEditor();
}

function renderResumeSlots() {
  const wrap = document.getElementById("resume-slots");
  wrap.innerHTML = "";
  state.resumes.forEach((r, i) => {
    const slot = document.createElement("div");
    slot.className = "slot" + (r ? " filled" : "");

    if (r) {
      slot.innerHTML = `
        <span class="slot-icon">&#128196;</span>
        <div class="slot-text">
          <p class="slot-name">${escapeHtml(r.name)}</p>
          <p class="slot-meta">Slot ${i + 1} &middot; ${r.text.length.toLocaleString()} characters</p>
        </div>
        <button class="slot-btn" data-act="replace" data-i="${i}">Replace</button>
        <button class="slot-btn" data-act="remove" data-i="${i}">Remove</button>
        <input type="file" accept=".txt,.docx" style="display:none" data-fileinput="${i}" />
      `;
    } else {
slot.innerHTML = `
  <div class="upload-icon"></div>

  <div class="slot-text">
    <div class="upload-title">Upload Resume</div>
    <div class="upload-subtitle">.txt or .docx</div>
  </div>

  <input type="file" accept=".txt,.docx" style="display:none" data-fileinput="${i}" />
`;
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
        const act = b.dataset.act;
        if (act === "replace") fileInput.click();
        else if (act === "remove") removeResume(i);
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
    alert("Could not read that file (" + e.message + "). Try a .txt file instead.");
    return;
  }
  state.resumes[idx] = { name: file.name, text: text };
  await persistResumes();
  renderResumeSlots();
  renderResumePicker();

  // First resume ever uploaded, or replacing the currently active autofill
  // resume, becomes (or stays) the active profile for autofill.
  if (state.autofillResumeIdx == null) {
    await setActiveAutofillResume(idx);
  } else if (state.autofillResumeIdx === idx) {
    await syncActiveFacts();
    renderActiveFactsEditor();
  }
}

async function removeResume(idx) {
  state.resumes[idx] = null;
  state.selectedResumeIdx.delete(idx);
  await persistResumes();
  renderResumeSlots();
  renderResumePicker();
  if (state.autofillResumeIdx === idx) {
    const nextFilled = state.resumes.findIndex((r) => r);
    await setActiveAutofillResume(nextFilled !== -1 ? nextFilled : null);
  }
}

function renderResumePicker() {
  const wrap = document.getElementById("resume-picker");
  const filled = state.resumes.map((r, i) => ({ r, i })).filter((x) => x.r);
  wrap.innerHTML = "";
  if (!filled.length) {
    wrap.innerHTML = `<p class="hint">No resumes saved yet. Open the Resumes tab to upload one.</p>`;
    return;
  }
  filled.forEach(({ r, i }) => {
    const chip = document.createElement("button");
    chip.className = "chip" + (state.selectedResumeIdx.has(i) ? " selected" : "");
    chip.textContent = r.name;
    chip.addEventListener("click", () => {
      if (state.selectedResumeIdx.has(i)) state.selectedResumeIdx.delete(i);
      else state.selectedResumeIdx.add(i);
      renderResumePicker();
    });
    wrap.appendChild(chip);
  });
}

// =========================================================================
// Grab from page
// =========================================================================
function parseJobMeta(pageTitle, url) {
  let title = (pageTitle || "").trim();
  const seps = [" at ", " - ", " | ", " :: "];
  for (const sep of seps) {
    if (title.includes(sep)) {
      const parts = title.split(sep);
      return { role: parts[0].trim().slice(0, 120), company: (parts[1] || "").trim().slice(0, 120) };
    }
  }
  let host = "";
  try { host = new URL(url).hostname.replace(/^www\./, ""); } catch (e) {}
  return { role: title.slice(0, 120) || "Role", company: host || "Unknown company" };
}

document.getElementById("grab-btn").addEventListener("click", async () => {
  const statusEl = document.getElementById("grab-status");
  statusEl.textContent = "Reading the page...";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error("No active tab found.");

    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["extract_jd.js"]
    });

    if (!result || !result.text || result.text.length < 50) {
      statusEl.textContent = "Couldn't find much text on this page — try selecting the JD text first, then grab again.";
      return;
    }

    document.getElementById("jd-input").value = result.text;
    state.lastJdMeta = { pageTitle: result.pageTitle, url: result.url };
    statusEl.textContent = result.source === "selection"
      ? "Pulled in your selected text."
      : "Pulled in the page's main content — check it looks right, trim if needed.";
  } catch (e) {
    statusEl.textContent = "Couldn't read this page (" + e.message + "). Some pages (chrome://, PDFs, the extension store) block this — paste the JD manually instead.";
  }
});

// =========================================================================
// Matching — the AI returns FOUR separate sub-scores (skills, experience,
// requirements coverage, education) plus resume-specific bonus points. The
// final 0-100 percentage is computed here in plain JS with fixed weights,
// so the math is transparent and two different resumes against the very
// same JD genuinely land on different numbers based on what's actually in
// each one — not a single opaque AI guess.
// =========================================================================
function buildPrompt(jd, resumeName, resumeText) {
  return `You are an expert technical recruiter and ATS shortlisting system.

Compare the RESUME against the JOB DESCRIPTION and respond with ONLY valid JSON (no markdown, no explanation) matching EXACTLY this shape:

{
  "skills_score": <integer 0-100>,
  "experience_score": <integer 0-100>,
  "requirements_score": <integer 0-100>,
  "education_score": <integer 0-100>,

  "must_have_count": <integer>,
  "must_have_matched": <integer>,
  "experience_gap_years": <integer>,
  "title_match_score": <integer 0-100>,
  "project_similarity_score": <integer 0-100>,

  "bonus_points": [
    {
      "reason": "<short reason, max 6 words>",
      "points": <integer 1-5>
    }
  ],

  "verdict": "<one short sentence verdict, max 15 words>",

  "matched_requirements": [
    {
      "requirement": "<short JD requirement, max 6 words>",
      "evidence": "<short evidence from resume, max 10 words>"
    }
  ],

  "missing_or_weak": [
    {
      "requirement": "<short JD requirement, max 6 words>",
      "note": "<why it is missing or weak, max 8 words>"
    }
  ],

  "nice_to_have_matches": [
    {
      "requirement": "<short nice-to-have, max 6 words>",
      "evidence": "<short evidence, max 8 words>"
    }
  ],

  "experience_fit": "<one sentence on experience fit, max 15 words>",

  "tailoring_tips": [
    "<short actionable tip, max 12 words>",
    "<short actionable tip, max 12 words>"
  ]
}

OUTPUT LENGTH LIMITS (apply strictly, do not exceed):
- matched_requirements: max 4 items, most important first.
- missing_or_weak: max 4 items, most important first.
- nice_to_have_matches: max 3 items.
- bonus_points: max 3 items.
- tailoring_tips: exactly 2 items.
- Keep every string field as short as the word limits above allow. No filler words, no repeating the requirement inside the evidence/note.

SCORING RULES:

skills_score:
- Measures skills coverage and depth.
- Penalize weak or superficial mentions.

experience_score:
- Based on years of experience, seniority and domain fit.
- Strong penalty if candidate has significantly fewer years.

requirements_score:
- Percentage of requirements satisfied.
- Missing mandatory requirements should reduce this heavily.

education_score:
- If education is not explicitly required, give 70-90.
- Lower only if a required degree/certification is missing.

must_have_count:
- Number of mandatory requirements found in the JD.
- Look for:
  Must Have,
  Required,
  Mandatory,
  Minimum Qualifications.

must_have_matched:
- Number of mandatory requirements satisfied.

experience_gap_years:
- Candidate years minus required years.
- Negative means lacking experience.
- Positive means exceeds requirement.

title_match_score:
- Similarity between candidate title and JD title.
- Example:
  Senior QA → Senior QA = 95+
  QA Engineer → Senior QA = 70
  QA Intern → Senior QA = 20.

project_similarity_score:
- How similar projects and responsibilities are to the JD.
- Example:
  Payment Gateway project for Payment role = high score.

bonus_points:
- Only include genuinely standout strengths.
- Otherwise return [].

IMPORTANT:
- Be strict.
- Do NOT inflate scores.
- Think like a recruiter deciding whether to shortlist this candidate.
- A candidate missing experience or mandatory requirements should NOT receive high scores.
- Respond with ONLY the JSON object. No preamble, no markdown fences, no trailing commentary.

JOB DESCRIPTION:
"""
${jd}
"""

RESUME (${resumeName}):
"""
${resumeText}
"""`;
}
// Turns the AI's four sub-scores + bonus points into one transparent
// final percentage and a recommendation label, both computed here (not
// asked of the AI) so they're always consistent with the weights above.
function computeWeightedScore(parsed) {
  const skills = clampScore(parsed.skills_score);
  const experience = clampScore(parsed.experience_score);
  const requirements = clampScore(parsed.requirements_score);
  const education = clampScore(parsed.education_score);

  const mustHaveCount =
    Number(parsed.must_have_count || 0);

  const mustHaveMatched =
    Number(parsed.must_have_matched || 0);

  const experienceGap =
    Number(parsed.experience_gap_years || 0);

  const titleMatch =
    clampScore(parsed.title_match_score || 0);

  const projectSimilarity =
    clampScore(parsed.project_similarity_score || 0);

  const base =
      skills * 0.22 +
      experience * 0.25 +
      requirements * 0.20 +
      education * 0.05 +
      titleMatch * 0.10 +
      projectSimilarity * 0.18;

  let score = base;

  // Missing requirements penalties
  const missing =
    Array.isArray(parsed.missing_or_weak)
      ? parsed.missing_or_weak.length
      : 0;

  if (missing >= 1) score *= 0.85;
  if (missing >= 2) score *= 0.70;
  if (missing >= 3) score *= 0.50;

  // Must-have requirements gate
  if (mustHaveCount > 0) {
    const ratio =
      mustHaveMatched / mustHaveCount;

    if (ratio < 0.30) score *= 0.40;
    else if (ratio < 0.50) score *= 0.60;
    else if (ratio < 0.70) score *= 0.80;
  }

  // Experience score gate
  if (experience < 20) score *= 0.35;
  else if (experience < 40) score *= 0.55;
  else if (experience < 60) score *= 0.75;
  else if (experience < 75) score *= 0.90;

  // Requirements gate
  if (requirements < 30) score *= 0.50;
  else if (requirements < 50) score *= 0.70;
  else if (requirements < 70) score *= 0.85;

  // Experience gap adjustment
  if (experienceGap <= -5) {
    score *= 0.50;
  }
  else if (experienceGap <= -3) {
    score *= 0.70;
  }
  else if (experienceGap <= -1) {
    score *= 0.85;
  }
  else if (experienceGap >= 3) {
    score += 3;
  }

  // Bonus points
  const bonusList = Array.isArray(parsed.bonus_points)
    ? parsed.bonus_points
    : [];

  const bonusTotal = Math.min(
    8,
    bonusList.reduce(
      (s, b) => s + (Number(b.points) || 0),
      0
    )
  );

  score += bonusTotal;

  score = Math.round(score);

  if (score > 97) score = 97;
  if (score < 3) score = 3;

  let recommendation;

  if (
    mustHaveCount > 0 &&
    mustHaveMatched / mustHaveCount < 0.5
  ) {
    recommendation = "Low chance of shortlist";
  }
  else if (score >= 85) {
    recommendation = "Apply immediately";
  }
  else if (score >= 70) {
    recommendation = "Strong match";
  }
  else if (score >= 55) {
    recommendation = "Apply after tailoring";
  }
  else {
    recommendation = "Weak fit";
  }

  return {
    overall: score,

    breakdown: {
      skills,
      experience,
      requirements,
      education,
      titleMatch,
      projectSimilarity,
      mustHaveCount,
      mustHaveMatched,
      experienceGap
    },

    title_match_score: titleMatch,
    project_similarity_score: projectSimilarity,
    must_have_count: mustHaveCount,
    must_have_matched: mustHaveMatched,
    experience_gap_years: experienceGap,

    bonus: bonusList,
    bonusTotal,
    recommendation
  };
}

function clampScore(v) {
  const n = Number(v);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}
// Strict per-model budget. Every model is raced AT THE SAME TIME (not one
// after another), so the slowest model never decides how long the user
// waits — whichever model answers successfully first wins, and anything
// still running past this budget is aborted. This is what keeps a single
// resume result landing in a few seconds instead of stacking up 12s waits
// model after model.
const MODEL_TIMEOUT_MS = 5000;

// One attempt against one model. Resolves with the parsed JSON result, or
// rejects with an Error. Rate-limit / quota / auth errors (401/402/403/429)
// are tagged with .rateLimited so the caller can tell "this model is out of
// quota" apart from "this model is broken".
async function tryOneModel(model, prompt) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);
  const t0 = performance.now();
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + state.apiKey,
        "HTTP-Referer": "https://github.com/resume-jd-matcher",
        "X-Title": "Resume JD Matcher"
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 1200
      })
    });
    clearTimeout(timeoutId);
    console.log("[RJM]", model, "responded in", Math.round(performance.now() - t0), "ms");

    if (!res.ok) {
      if (res.status === 401 || res.status === 402 || res.status === 403 || res.status === 429) {
        const err = new Error(model + " rate-limited (" + res.status + ")");
        err.rateLimited = true;
        throw err;
      }
      throw new Error(model + " returned " + res.status);
    }

    const data = await res.json();
    const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!content) throw new Error(model + " returned no content");

    const cleaned = content.replace(/```json/gi, "").replace(/```/g, "").trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
      else throw parseErr;
    }
    return { parsed, model };
  } catch (e) {
    clearTimeout(timeoutId);
    if (e.rateLimited) throw e;
    const reason = e.name === "AbortError" ? "timed out after " + (MODEL_TIMEOUT_MS / 1000) + "s" : e.message;
    console.warn("[RJM]", model, "failed:", reason);
    throw new Error(model + ": " + reason);
  }
}

// Races every configured model AT ONCE and returns the first one that
// actually succeeds — this is the change that makes results fast: no more
// trying model #1, waiting, then model #2, waiting, etc. If a model is
// slow or rate-limited it simply loses the race instead of blocking
// everything else.
async function callOpenRouter(prompt, onStatus) {
  const models = state.models.slice();
  if (!models.length) throw new Error("No models configured. Add at least one in the Model & key tab.");

  onStatus("Racing " + models.length + " model" + (models.length === 1 ? "" : "s") + " for the fastest result...");

  return new Promise((resolve, reject) => {
    let pending = models.length;
    const errors = [];
    let settled = false;

    models.forEach((model) => {
      tryOneModel(model, prompt)
        .then((value) => {
          if (settled) return;
          settled = true;
          resolve(value);
        })
        .catch((e) => {
          errors.push(e);
          pending--;
          if (settled) return;
          if (pending === 0) {
            settled = true;
            const allRateLimited = errors.length > 0 && errors.every((er) => er && er.rateLimited);
            if (allRateLimited) {
              reject(new Error("OPENROUTER_LIMIT_REACHED"));
            } else {
              const lastError = errors[errors.length - 1];
              reject(new Error(lastError ? lastError.message : "All models failed"));
            }
          }
        });
    });
  });
}
function scoreColor(score) {
  // Pure grayscale weighting — no traffic-light colors, just intensity,
  // to keep the whole UI black & white.
  if (score >= 75) return "var(--text)";
  if (score >= 50) return "var(--text-secondary)";
  return "var(--text-tertiary)";
}

function renderResultCard(resumeName, scored, model, resumeIdx) {
  const sc = scored.overall;
  const colHex = scoreColor(sc);
  const matched = scored.matched_requirements || [];
  const missing = scored.missing_or_weak || [];
  const nice = scored.nice_to_have_matches || [];
  const tips = scored.tailoring_tips || [];
  const bonus = scored.bonus || [];
  const b = scored.breakdown || {};

  const strengths = matched.slice(0, 3);
  const blockers = missing.slice(0, 3);

  // ...rest of the function stays exactly the same


  const factorRow = (label, val) => `
    <div class="factor-row">
      <span class="factor-label">${escapeHtml(label)}</span>
      <div class="bar-track factor-bar"><div class="bar-fill" style="width:0%;" data-target="${val}"></div></div>
      <span class="factor-val">${val}%</span>
    </div>`;

  const card = document.createElement("div");
  card.className = "result-card";
const shortVerdict =
  sc >= 80 ? "Strong Match" :
  sc >= 60 ? "Good Match" :
  sc >= 40 ? "Possible Match" :
  "Low Match";

const displayName = `Resume ${resumeIdx + 1}`;

  // Plain-English one-liner built purely from data the model already
  // returned — no new scoring math, just a friendlier way to say it.
  const matchedCount = matched.length;
  const totalReqCount = matchedCount + missing.length;
  const friendlySummary = totalReqCount
    ? `Covers ${matchedCount} of ${totalReqCount} job requirement${totalReqCount === 1 ? "" : "s"}.`
    : "";

card.innerHTML = `
<div class="resume-result-card">

  <div class="resume-result-header">

    <div>
      <div class="resume-slot-name">${displayName}</div>
      <div class="resume-file-name">${escapeHtml(resumeName)}</div>
    </div>

<div class="score-section">

  <div class="score-badge" style="color:${colHex}">
<span class="scoreValue">0</span>
  </div>

  <div class="match-pill">
    ${shortVerdict}
  </div>

  ${friendlySummary ? `
    <p class="score-summary">
      ${escapeHtml(friendlySummary)}
    </p>
  ` : ""}

</div>
  </div>



<div class="result-actions-row">

    <button
      class="autoapply-btn"
      data-resume-idx="${resumeIdx}"
    >
      Autofill Job
    </button>

    <button
      class="match-details-btn"
      type="button"
    >
      View Details
    </button>

</div>

<div class="result-details-panel">

        <p class="section-label">
          Match Breakdown
        </p>

        <div class="factor-list">
          ${factorRow("Skills", b.skills || 0)}
          ${factorRow("Experience", b.experience || 0)}
          ${factorRow("Requirements", b.requirements || 0)}
          ${factorRow("Education", b.education || 0)}
        </div>

        ${matched.length ? `
        <p class="section-label">What Matches Well</p>
        ${matched.map(m => `
          <div class="req-item match">
            <b>${escapeHtml(m.requirement)}</b>
          </div>
        `).join("")}
        ` : ""}

        ${missing.length ? `
        <p class="section-label">What's Missing</p>
        ${missing.map(m => `
          <div class="req-item missing">
            <b>${escapeHtml(m.requirement)}</b>
          </div>
        `).join("")}
        ` : ""}

        ${tips.length ? `
        <p class="section-label">
          How To Improve This Score
        </p>

        <ul class="tips-list">
          ${tips.map(t => `<li>${escapeHtml(t)}</li>`).join("")}
        </ul>
        ` : ""}

      </div> <!-- details-content -->

</div> <!-- result-details-panel -->

</div> <!-- resume-result-card -->
`;


const detailsBtn =
  card.querySelector(".match-details-btn");

const detailsPanel =
  card.querySelector(".result-details-panel");

detailsBtn.addEventListener("click", () => {
  detailsPanel.classList.toggle("open");

  detailsBtn.textContent =
    detailsPanel.classList.contains("open")
      ? "Hide Details"
      : "View Details";
});


  card.querySelector(".autoapply-btn").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const statusEl = card.querySelector(".autoapply-status");
    await setActiveAutofillResume(resumeIdx);
    btn.disabled = true;
    statusEl.textContent = "Active resume set. Switching to the Autofill tab to scan this page's form...";
    });
card.querySelector(".autoapply-btn").addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  const statusEl = card.querySelector(".autoapply-status");

  await setActiveAutofillResume(resumeIdx);

  btn.disabled = true;

  if (statusEl) {
    statusEl.textContent =
      "Switching to Autofill and preparing scan...";
  }

  // 1. Switch tab immediately
goToTab("autofill");
document.body.classList.add("tab-autofill-active");

  // 2. Wait until DOM is actually ready (better than timeout)
  requestAnimationFrame(() => {
    setTimeout(async () => {
      const scanBtn = document.getElementById("scan-form-btn");

      if (!scanBtn) return;

      // 3. Auto trigger scan
      scanBtn.click();
    }, 50);
  });
});

  // Animate the bars + the score count-up on next paint, minimal & quick.
  requestAnimationFrame(() => {
    card.querySelectorAll("[data-target]").forEach((el) => {
      const target = parseFloat(el.dataset.target);
      if (el.classList.contains("count-up")) {
        animateCountUp(el, target);
      } else {
        el.style.width = target + "%";
      }
    });
  });

  return card;
}

function animateCountUp(el, target) {
  const duration = 500;
  const start = performance.now();
  function tick(now) {
    const progress = Math.min(1, (now - start) / duration);
    el.textContent = Math.round(target * progress) + "%";
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}


function animateScoreInCard(card, target) {
  const el = card.querySelector(".scoreValue");
  if (!el) return;

  let start = 0;
  const duration = 900;
  const startTime = performance.now();

  function tick(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const value = Math.floor(progress * target);

    el.textContent = value;

    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      el.textContent = target;
      el.classList.add("done");
    }
  }

  requestAnimationFrame(tick);
}
// Save the match to Supabase and trigger the instant, full-detail email —
// runs after every single match, regardless of score, as long as the user
// is logged in. Never blocks or breaks the on-screen result if it fails.
async function saveMatchAndNotify(resume, scored, model) {
  if (!state.session) return;
  const meta = parseJobMeta(
    state.lastJdMeta && state.lastJdMeta.pageTitle,
    state.lastJdMeta && state.lastJdMeta.url
  );
  const row = {
    user_id: state.session.user.id,
    company: meta.company,
    role: meta.role,
    resume_name: resume.name,
    score: scored.overall,
    recommendation: scored.recommendation || "",
    matched_count: (scored.matched_requirements || []).length,
    missing_count: (scored.missing_or_weak || []).length,
    model: model
  };
  try {
    await authedFetch(SUPABASE_URL + "/rest/v1/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(row)
    });
  } catch (e) {
    console.warn("Could not save match", e);
  }
  sendTransactionalEmail("match", {
    company: row.company,
    role: row.role,
    resume_name: row.resume_name,
    score: row.score,
    recommendation: row.recommendation,
    breakdown: scored.breakdown,
    bonus: scored.bonus,
    matched: scored.matched_requirements,
    missing: scored.missing_or_weak,
    nice: scored.nice_to_have_matches,
    tips: scored.tailoring_tips,
    jdUrl: state.lastJdMeta && state.lastJdMeta.url
  });
  await refreshProfile();
  renderAccountPanel();
}

document.getElementById("run-btn").addEventListener("click", async () => {
  const jd = document.getElementById("jd-input").value.trim();
  const statusEl = document.getElementById("run-status");
  const resultsEl = document.getElementById("results-area");
  const btn = document.getElementById("run-btn");

  if (!state.session) {
    statusEl.textContent = "Log in first (Account tab) to run matches.";
    goToTab("account");
    return;
  }
  if (!jd) { statusEl.textContent = "Paste or grab a job description first."; return; }
  if (!state.apiKey) {
    statusEl.textContent = "Add your OpenRouter API key in the Model & key tab first.";
    goToTab("settings");
    return;
  }
  const selected = Array.from(state.selectedResumeIdx).filter((i) => state.resumes[i]);
  if (!selected.length) { statusEl.textContent = "Select at least one saved resume to compare."; return; }

  const remaining = matchesRemainingToday();
  if (remaining <= 0) {
    statusEl.textContent = `You've used today's ${DAILY_FREE_MATCH_LIMIT} free matches. Upgrade for unlimited, or come back after midnight.`;
    goToTab("account");
    return;
  }
  if (selected.length > remaining) {
    statusEl.textContent = `Only ${remaining} match${remaining === 1 ? "" : "es"} left today on the free plan — picking the first ${remaining}.`;
    selected.length = remaining;
  }

  btn.disabled = true;
  resultsEl.innerHTML = "";

  let doneCount = 0;
  const total = selected.length;
  statusEl.innerHTML = `<span class="spin"></span>Analyzing ${total} resume${total === 1 ? "" : "s"}...`;

  // Hard safety net: even though models are raced in parallel (so a single
  // resume should land in ~5s), this guarantees no single resume can ever
  // hang the whole batch past a few seconds longer than that budget — which
  // is what keeps "5 resumes pasted" finishing well inside 30s total, since
  // every resume below runs in parallel, not one after another.
  const HARD_PER_RESUME_TIMEOUT_MS = MODEL_TIMEOUT_MS + 3000;
  function withHardTimeout(promise, ms) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("Timed out after " + Math.round(ms / 1000) + "s")), ms);
      promise.then(
        (v) => { clearTimeout(t); resolve(v); },
        (e) => { clearTimeout(t); reject(e); }
      );
    });
  }

  // Fire all resumes at once instead of waiting for each one in turn.
  const jobs = selected.map((idx) => {
    const resume = state.resumes[idx];
    return withHardTimeout(callOpenRouter(buildPrompt(jd, resume.name, resume.text), () => {}), HARD_PER_RESUME_TIMEOUT_MS)
      .then(({ parsed, model }) => {
        const scored = Object.assign({}, parsed, computeWeightedScore(parsed));
        recordMatchUsage();
        renderUsageBanner();
        saveMatchAndNotify(resume, scored, model);

        // Render the instant this one resume's score is ready — don't wait for the others.
const card = renderResultCard(resume.name, scored, model, idx);
resultsEl.appendChild(card);

// IMPORTANT: animate only THIS card (not all cards)
animateScoreInCard(card, scored.overall);
        doneCount++;
        statusEl.innerHTML = doneCount < total
          ? `<span class="spin"></span>${doneCount}/${total} done...`
          : "Done.";
      })
      .catch((e) => {
        doneCount++;
        const errCard = document.createElement("div");
        if (e.message === "OPENROUTER_LIMIT_REACHED") {
          errCard.className = "limit-card";
          errCard.innerHTML = `
            <h3>Daily Free Limit Reached</h3>
            <p>
              All available free AI models have reached
              their current usage limits.
            </p>
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              class="openrouter-btn"
            >
              Create New API Key
            </a>
          `;
        } else {
          errCard.className = "error-card";
          errCard.textContent = "Could not get a result for " + resume.name + ": " + e.message;
        }
        resultsEl.appendChild(errCard);
        if (doneCount === total) statusEl.textContent = "Done (with errors).";
      });
  });

  await Promise.all(jobs);
  btn.disabled = false;
});

// =========================================================================
// Autofill — three layers, zero AI calls:
//   1. Canonical rules (in field_fill.js) match a field's label to a known
//      key (firstName, gender, salary, ...).
//   2. If the active resume's extracted facts have that key, use it.
//   3. Otherwise check the learned Q&A bank (exact, then fuzzy label match).
// Anything still unresolved gets a one-line manual input right in the
// popup; saving it fills the field AND remembers it for every future
// application, on any site, forever (until you edit/delete it below).
// =========================================================================

function renderAutofillResumePicker() {
  const wrap = document.getElementById("autofill-resume-picker");
  wrap.innerHTML = "";

  const idx = state.autofillResumeIdx;
  const filled = state.resumes.map((r, i) => ({ r, i })).filter((x) => x.r);
  const activeResume = idx != null ? state.resumes[idx] : null;

  const card = document.createElement("div");
  card.className = "edit-profile-card";

  const resumeOptions = filled.map(({r, i}) =>
    `<option value="${i}" ${i === idx ? "selected" : ""}>${escapeHtml(r.name)}</option>`
  ).join("");

  card.innerHTML = `
    <div class="edit-profile-header">
      <span class="edit-profile-title">Edit Profile</span>
    </div>
    <button class="edit-profile-toggle btn-primary" id="edit-profile-toggle-btn">Edit Profile</button>
    <div id="edit-profile-body" class="edit-profile-body hidden">
      <div class="edit-profile-fields" id="autofill-active-facts-inline"></div>
      <div class="edit-profile-resume-row">
        <span class="edit-profile-label">Resume</span>
        ${filled.length ? `
          <select class="edit-profile-resume-select" id="autofill-resume-select">
            ${resumeOptions}
          </select>
        ` : `<span class="hint" style="margin:0;">No resumes uploaded</span>`}
      </div>
      ${activeResume ? `<div class="edit-profile-resume-name">&#128196; ${escapeHtml(activeResume.name)}</div>` : ""}
      <hr style="border:none;border-top:1px solid var(--border);margin:10px 0;">
      <p class="section-label" style="margin-bottom:6px;">Q&amp;A Bank</p>
      <div class="row-gap" style="margin-bottom:6px;">
        <input type="text" id="inline-qa-search" placeholder="Search field label..." style="flex:1;" />
      </div>
      <div id="qa-bank-inline-list" class="qa-list"></div>
      <div class="row-gap" style="margin-top:8px;">
        <input type="text" id="inline-qa-question" placeholder="Field label" style="flex:1;" />
        <input type="text" id="inline-qa-answer" placeholder="Answer" style="flex:1;" />
        <button id="inline-add-qa-btn" class="btn-ghost-small">Add</button>
      </div>
    </div>
  `;
  wrap.appendChild(card);

  const toggleBtn = card.querySelector("#edit-profile-toggle-btn");
  const body = card.querySelector("#edit-profile-body");
  toggleBtn.addEventListener("click", () => {
    const open = !body.classList.contains("hidden");
    body.classList.toggle("hidden", open);
    toggleBtn.textContent = open ? "Edit Profile" : "Close";
    if (!open) {
      renderInlineFactsEditor();
      renderInlineQaBank();
    }
  });

  const sel = card.querySelector("#autofill-resume-select");
  if (sel) {
    sel.addEventListener("change", () => setActiveAutofillResume(parseInt(sel.value, 10)));
  }

  function renderInlineQaBank(filter = "") {
    const list = card.querySelector("#qa-bank-inline-list");
    if (!list) return;
    const filtered = state.qaBank
      .slice()
      .sort((a,b) => b.updatedAt - a.updatedAt)
      .filter(q => !filter || (q.rawLabel||q.normLabel).toLowerCase().includes(filter.toLowerCase()));
    if (!filtered.length) {
      list.innerHTML = `<p class="hint">${filter ? "No match found." : "No saved answers yet."}</p>`;
      return;
    }
    list.innerHTML = "";
    filtered.forEach(q => {
      const row = document.createElement("div");
      row.className = "qa-row";
      row.innerHTML = `
        <span class="qa-q" title="${escapeHtml(q.rawLabel)}">${escapeHtml((q.rawLabel||q.normLabel).slice(0,22))}</span>
        <input type="text" class="qa-a" value="${escapeHtml(q.answer)}" data-id="${q.id}" />
        <button class="icon-btn qa-save" data-id="${q.id}" title="Save to Profile">&#10003;</button>
        <button class="icon-btn qa-delete" data-id="${q.id}" title="Delete">&times;</button>
      `;
      list.appendChild(row);
      row.querySelector(".qa-save").addEventListener("click", async (e) => {
        const val = row.querySelector(".qa-a").value.trim();
        const entry = state.qaBank.find(x => x.id === q.id);
        if (entry && val) {
          entry.answer = val;
          entry.updatedAt = Date.now();
          await persistQaBank();
          const profileKey = entry.normLabel.replace(/\s+/g, "");
          if (state.autofillResumeIdx != null) {
            await saveFactOverride(state.autofillResumeIdx, profileKey, val);
          }
          flashSaved(e.currentTarget);
          renderInlineFactsEditor();
        }
      });
      row.querySelector(".qa-delete").addEventListener("click", async () => {
        await deleteQaEntry(q.id);
        renderInlineQaBank(card.querySelector("#inline-qa-search")?.value || "");
      });
    });
  }

  const inlineAddBtn = card.querySelector("#inline-add-qa-btn");
  if (inlineAddBtn) {
    inlineAddBtn.addEventListener("click", async () => {
      const q = card.querySelector("#inline-qa-question").value.trim();
      const a = card.querySelector("#inline-qa-answer").value.trim();
      if (!q || !a) return;
      await upsertQaEntry(q, a);
      card.querySelector("#inline-qa-question").value = "";
      card.querySelector("#inline-qa-answer").value = "";
      renderInlineQaBank();
    });
  }

  const searchInput = card.querySelector("#inline-qa-search");
  if (searchInput) {
    searchInput.addEventListener("input", () => renderInlineQaBank(searchInput.value));
  }
}

async function renderInlineFactsEditor() {
  const wrap = document.getElementById("autofill-active-facts-inline");
  if (!wrap) return;
  const idx = state.autofillResumeIdx;
  if (idx == null || !state.resumes[idx]) { wrap.innerHTML = ""; return; }
  const stored = await storageGet(["rjm_active_facts"]);
  const facts = stored.rjm_active_facts || {};
  const keys = Object.keys(FACT_LABELS).filter((k) => facts[k] != null && facts[k] !== "");
  wrap.innerHTML = "";
  keys.forEach((k) => {
    const row = document.createElement("div");
    row.className = "edit-fact-row";
    row.innerHTML = `
      <span class="edit-fact-label">${escapeHtml(FACT_LABELS[k] || k)}</span>
      <input type="text" class="edit-fact-input" value="${escapeHtml(facts[k])}" data-key="${escapeHtml(k)}" />
      <button class="icon-btn edit-fact-save" data-key="${escapeHtml(k)}" title="Save">&#10003;</button>
    `;
    wrap.appendChild(row);
    row.querySelector(".edit-fact-save").addEventListener("click", async (e) => {
      const key = e.currentTarget.dataset.key;
      const val = row.querySelector(".edit-fact-input").value.trim();
      await saveFactOverride(idx, key, val);
      flashSaved(e.currentTarget);
    });
  });
}

// ---------- Active resume's extracted facts: editable, deletable ----------
const FACT_LABELS = {
  fullName: "Full name", firstName: "First name", lastName: "Last name",
  email: "Email", phone: "Phone", linkedin: "LinkedIn", github: "GitHub",
  portfolio: "Portfolio", city: "City", country: "Country", address: "Address",
  coverLetter: "Cover letter", currentCompany: "Current company", currentTitle: "Current title",
  experienceYears: "Years of experience", salary: "Salary"
};

async function renderActiveFactsEditor() {
  const wrap = document.getElementById("active-facts-editor");
  if (!wrap) return;
  const idx = state.autofillResumeIdx;
  if (idx == null || !state.resumes[idx]) {
    wrap.innerHTML = "";
    return;
  }
  const stored = await storageGet(["rjm_active_facts"]);
  const facts = stored.rjm_active_facts || {};
  const keys = Object.keys(FACT_LABELS).filter((k) => facts[k] != null && facts[k] !== "");

  wrap.innerHTML = `

<div id="active-facts-rows" class="qa-list"></div>
    <div class="row-gap" style="margin-top:8px;">
      <input type="text" id="new-fact-key" placeholder="Field (e.g. portfolio)" style="flex:1;" />
      <input type="text" id="new-fact-val" placeholder="Value" style="flex:1;" />
      <button id="add-fact-btn" class="btn-ghost-small">Add</button>
    </div>
  `;
  const rows = wrap.querySelector("#active-facts-rows");
  keys.forEach((k) => {
    const row = document.createElement("div");
    row.className = "qa-row";
    row.innerHTML = `
      <span class="qa-q">${escapeHtml(FACT_LABELS[k] || k)}</span>
      <input type="text" class="qa-a" value="${escapeHtml(facts[k])}" data-key="${escapeHtml(k)}" />
      <button class="icon-btn qa-save" data-key="${escapeHtml(k)}" title="Save">&#10003;</button>
      <button class="icon-btn qa-delete" data-key="${escapeHtml(k)}" title="Delete">&times;</button>
    `;
    rows.appendChild(row);
  });

  rows.querySelectorAll(".qa-save").forEach((b) => {
    b.addEventListener("click", async () => {
      const key = b.dataset.key;
      const val = rows.querySelector(`.qa-a[data-key="${key}"]`).value.trim();
      await saveFactOverride(idx, key, val);
      flashSaved(b);
    });
  });
  rows.querySelectorAll(".qa-delete").forEach((b) => {
    b.addEventListener("click", async () => {
      const key = b.dataset.key;
      await saveFactOverride(idx, key, null);
      renderActiveFactsEditor();
    });
  });

  const addBtn = wrap.querySelector("#add-fact-btn");
  if (addBtn) {
    addBtn.addEventListener("click", async () => {
      const k = wrap.querySelector("#new-fact-key").value.trim();
      const v = wrap.querySelector("#new-fact-val").value.trim();
      if (!k || !v) return;
      await saveFactOverride(idx, k, v);
      renderActiveFactsEditor();
    });
  }
}

async function saveFactOverride(idx, key, value) {
  const overrideKey = "rjm_active_facts_overrides_" + idx;
  const stored = await storageGet([overrideKey]);
  const overrides = stored[overrideKey] || {};
  if (value == null) delete overrides[key];
  else overrides[key] = value;
  await storageSet({ [overrideKey]: overrides });
  await syncActiveFacts();
}

function flashSaved(btn) {
  const original = btn.innerHTML;
  btn.innerHTML = "&#10003;";
  btn.classList.add("flash-ok");
  setTimeout(() => btn.classList.remove("flash-ok"), 600);
}

// ---------- Learned Q&A bank ----------
function findQaEntry(normLabel) {
  return state.qaBank.find((q) => q.normLabel === normLabel);
}

async function upsertQaEntry(rawLabel, answer) {
  const normLabel = normalizeLabel(rawLabel);
  if (!normLabel || !answer) return;
  const existing = findQaEntry(normLabel);
  if (existing) {
    existing.answer = answer;
    existing.rawLabel = rawLabel;
    existing.updatedAt = Date.now();
  } else {
    state.qaBank.push({
      id: "qa_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
      normLabel,
      rawLabel,
      answer,
      updatedAt: Date.now()
    });
  }
  await persistQaBank();
  renderQaBank();
}

async function deleteQaEntry(id) {
  state.qaBank = state.qaBank.filter((q) => q.id !== id);
  await persistQaBank();
  renderQaBank();
}

function renderQaBank() {
  const wrap = document.getElementById("qa-bank-list");
  if (!wrap) return;
  if (!state.qaBank.length) {
    wrap.innerHTML = `<p class="hint">Nothing learned yet. Anything you fill in manually below gets saved here and reused automatically next time, on any site.</p>`;
    return;
  }
  wrap.innerHTML = "";
  state.qaBank
    .slice()
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .forEach((q) => {
      const row = document.createElement("div");
      row.className = "qa-row";
      row.innerHTML = `
        <span class="qa-q" title="${escapeHtml(q.rawLabel)}">${escapeHtml((q.rawLabel || q.normLabel).slice(0, 28))}</span>
        <input type="text" class="qa-a" value="${escapeHtml(q.answer)}" data-id="${q.id}" />
        <button class="icon-btn qa-save" data-id="${q.id}" title="Save">&#10003;</button>
        <button class="icon-btn qa-delete" data-id="${q.id}" title="Delete">&times;</button>
      `;
      wrap.appendChild(row);
    });

  wrap.querySelectorAll(".qa-save").forEach((b) => {
    b.addEventListener("click", async () => {
      const id = b.dataset.id;
      const val = wrap.querySelector(`.qa-a[data-id="${id}"]`).value.trim();
      const entry = state.qaBank.find((q) => q.id === id);
      if (entry && val) {
        entry.answer = val;
        entry.updatedAt = Date.now();
        await persistQaBank();
        flashSaved(b);
      }
    });
  });
  wrap.querySelectorAll(".qa-delete").forEach((b) => {
    b.addEventListener("click", () => deleteQaEntry(b.dataset.id));
  });
}

document.getElementById("add-qa-btn") && document.getElementById("add-qa-btn").addEventListener("click", async () => {
  const q = document.getElementById("new-qa-question").value.trim();
  const a = document.getElementById("new-qa-answer").value.trim();
  if (!q || !a) return;
  await upsertQaEntry(q, a);
  document.getElementById("new-qa-question").value = "";
  document.getElementById("new-qa-answer").value = "";
});

// ---------- Scan + resolve + fill ----------
document.getElementById("scan-form-btn").addEventListener("click", async () => {
  const statusEl = document.getElementById("scan-status");
  const resultWrap = document.getElementById("autofill-scan-result");
  resultWrap.innerHTML = "";

  if (state.autofillResumeIdx == null || !state.resumes[state.autofillResumeIdx]) {
    statusEl.textContent = "Upload or pick a resume above first.";
    return;
  }

  statusEl.innerHTML = '<span class="spin"></span>Scanning form fields on this page...';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error("No active tab found.");

    const [{ result: fields }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["field_fill.js"]
    });

    if (!fields || !fields.length) {
      statusEl.textContent = "No fillable form fields found on this page. Open the application form first.";
      return;
    }

state.lastScanFields = fields.map(f => ({
  ...f,
  id: crypto.randomUUID()
}));
    const resolvedCount = fields.filter((f) => f.suggestedValue != null && f.suggestedValue !== "").length;
    statusEl.textContent = `Found ${fields.length} field${fields.length === 1 ? "" : "s"} \u2014 ${resolvedCount} ready to fill instantly, ${fields.length - resolvedCount} need a one-time answer.`;

    renderScanResult(fields);
  } catch (e) {
    statusEl.textContent = "Couldn't read this page's form (" + e.message + "). Some pages block this \u2014 open the application form first and try again.";
  }
});

function sourceTag(source) {
  if (source === "facts") return '<span class="tag-matched">from resume</span>';
  if (source === "qa") return '<span class="tag-matched">learned</span>';
  if (source === "qa-fuzzy") return '<span class="tag-fuzzy">learned (similar)</span>';
  return '<span class="tag-unmatched">new</span>';
}


function uiLabel(label) {
  if (!label) return "";

  label = label.trim().replace(/\s+/g, " ");

  // Split into words
  const words = label.split(" ");

  // Remove consecutive duplicates
  const cleaned = [];
  for (const word of words) {
    if (
      cleaned.length === 0 ||
      cleaned[cleaned.length - 1].toLowerCase() !== word.toLowerCase()
    ) {
      cleaned.push(word);
    }
  }

  label = cleaned.join(" ");

  // Handle common fields
  const lower = label.toLowerCase();

  if (lower.includes("first name")) return "First Name*";
  if (lower.includes("last name")) return "Last Name*";
  if (lower.includes("email")) return "Email*";
  if (lower.includes("phone")) return "Phone*";
  if (lower.includes("country")) return "Country*";
  if (lower.includes("location")) return "Location (City)*";
  if (lower.includes("linkedin")) return "LinkedIn Profile";
  if (lower.includes("school")) return "School";
  if (lower.includes("degree")) return "Degree";
  if (lower.includes("discipline")) return "Discipline";
  if (lower.includes("gender")) return "Gender";
  if (lower.includes("veteran")) return "Veteran Status";
  if (lower.includes("disability")) return "Disability Status";

  return label.replace(/\b\w/g, c => c.toUpperCase());
}



function renderScanResult(fields) {
  const wrap = document.getElementById("autofill-scan-result");
  const resolved = fields.filter((f) => f.suggestedValue != null && f.suggestedValue !== "");
  const unresolved = fields.filter((f) => f.suggestedValue == null || f.suggestedValue === "");

  wrap.innerHTML = `
    ${resolved.length ? `<div id="resolved-rows"></div>
    <button id="apply-fast-fill-btn" class="autoapply-btn">
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>
AutoFill ${resolved.length} field${resolved.length === 1 ? "" : "s"} instantly
    </button>` : `<p class="hint">Nothing could be auto-resolved yet — answer the questions below once.</p>`}
    ${unresolved.length ? `
      <p class="section-label" style="margin-top:12px;">New questions on this form (${unresolved.length})</p>
      <p class="hint">Type each answer once \u2014 it fills this field now and is remembered for every future application.</p>
      <div id="unresolved-rows"></div>
      <button id="save-fill-all-btn" class="autoapply-btn" style="margin-top:8px;">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
        Save answers &amp; fill
      </button>
    ` : ""}
    <p id="apply-status" class="hint"></p>
    <div id="applied-prompt-wrap"></div>
  `;

  const resolvedRows = wrap.querySelector("#resolved-rows");
  resolved.forEach((f) => {
    const row = document.createElement("div");
    row.className = "field-row matched";
    row.innerHTML = `
      <span class="field-label-text" title="${escapeHtml(f.labelText)}">${escapeHtml(uiLabel((f.labelText || "(unlabeled field)"))).slice(0, 34)}</span>
      <span class="field-preview" title="${escapeHtml(String(f.suggestedValue))}">${escapeHtml(String(f.suggestedValue).slice(0, 22))}</span>
      ${sourceTag(f.source)}
    `;
    resolvedRows.appendChild(row);
  });

  const unresolvedRows = wrap.querySelector("#unresolved-rows");
  unresolved.forEach((f) => {
    const row = document.createElement("div");
    row.className = "field-row";
    row.innerHTML = `
   <span class="field-label-text" title="${escapeHtml(f.labelText)}">${escapeHtml(uiLabel((f.labelText || "(unlabeled field)"))).slice(0, 30)}</span>
      <input type="text" class="manual-answer" data-idx="${f.idx}" data-label="${escapeHtml(f.labelText)}" placeholder="Your answer" />
      <button class="icon-btn save-one-btn" data-idx="${f.idx}" title="Save & fill this one">&#10003;</button>
    `;
    unresolvedRows.appendChild(row);
  });

  const fastFillBtn = document.getElementById("apply-fast-fill-btn");
  if (fastFillBtn) fastFillBtn.addEventListener("click", () => applyResolvedFill(resolved));

  if (unresolvedRows) {
    unresolvedRows.querySelectorAll(".save-one-btn").forEach((b) => {
      b.addEventListener("click", async () => {
        const idx = parseInt(b.dataset.idx, 10);
        const input = unresolvedRows.querySelector(`.manual-answer[data-idx="${idx}"]`);
        const val = input.value.trim();
        if (!val) return;
        const field = unresolved.find((f) => f.idx === idx);
        await saveAndFillOne(field, val);
        input.closest(".field-row").classList.add("matched");
        flashSaved(b);
        offerAppliedPrompt();
      });
    });
    const saveAllBtn = document.getElementById("save-fill-all-btn");
    if (saveAllBtn) {
      saveAllBtn.addEventListener("click", async () => {
        const statusEl = document.getElementById("apply-status");
        let count = 0;
        for (const f of unresolved) {
          const input = unresolvedRows.querySelector(`.manual-answer[data-idx="${f.idx}"]`);
          const val = input ? input.value.trim() : "";
          if (!val) continue;
          await saveAndFillOne(f, val);
          count++;
        }
        statusEl.textContent = count ? `Saved & filled ${count} answer${count === 1 ? "" : "s"}. They'll auto-fill next time.` : "Type an answer in at least one box first.";
        if (count) offerAppliedPrompt();
      });
    }
  }
}

async function applyResolvedFill(resolvedFields) {
  const statusEl = document.getElementById("apply-status");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const [{ result: filledCount }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (fieldsList) => window.__rjmAutofill.fillResolved(fieldsList),
      args: [resolvedFields]
    });
    statusEl.textContent = `Filled ${filledCount} field${filledCount === 1 ? "" : "s"}.`;
    offerAppliedPrompt();
  } catch (e) {
    statusEl.textContent = "Could not fill the page: " + e.message;
  }
}

async function saveAndFillOne(field, value) {
  await upsertQaEntry(field.labelText, value);
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (idx, val) => window.__rjmAutofill.fillByIdx(idx, val),
      args: [field.idx, value]
    });
  } catch (e) {
    console.warn("fill failed", e);
  }
}

// ---------- "Did you apply?" ----------
const GENERIC_JOB_SITES = ["linkedin.com","indeed.com","glassdoor.com","naukri.com","monster.com","simplyhired.com","ziprecruiter.com","dice.com","unstop.com","internshala.com","wellfound.com","angel.co","greenhouse.io","lever.co","workday.com","taleo.net","myworkdayjobs.com","icims.com","careers.","jobs.","hiring."];

function isGenericCompany(company) {
  if (!company || company === "Unknown company") return true;
  return GENERIC_JOB_SITES.some(h => company.toLowerCase().includes(h));
}

function offerAppliedPrompt() {
  const wrap = document.getElementById("applied-prompt-wrap");
  if (!wrap || wrap.querySelector(".applied-prompt")) return;
  const meta = parseJobMeta(state.lastJdMeta && state.lastJdMeta.pageTitle, state.lastJdMeta && state.lastJdMeta.url);

  // Determine display label: show company name if identified correctly, else show role
  const displayLabel = isGenericCompany(meta.company) ? meta.role : meta.company;
  const questionText = `Did you apply to the ${isGenericCompany(meta.company) ? "" : ""}${escapeHtml(displayLabel)} role?`;

  const box = document.createElement("div");
  box.className = "applied-prompt applied-prompt-fullpage";
  box.innerHTML = `
    <div class="applied-prompt-inner">
      <div class="applied-prompt-icon">&#128196;</div>
      <p class="applied-prompt-question">${questionText}</p>
      <p class="applied-prompt-sub">${isGenericCompany(meta.company) ? escapeHtml(meta.role) : escapeHtml(meta.company + " · " + meta.role)}</p>
      <div class="applied-prompt-btns">
        <button class="applied-yes-btn" data-ans="yes">Yes, I applied</button>
        <button class="applied-no-btn" data-ans="no">Not yet</button>
      </div>
      <p class="hint applied-ack" style="margin-top:14px;text-align:center;"></p>
    </div>
  `;
  wrap.appendChild(box);
  box.querySelectorAll("button[data-ans]").forEach((b) => {
    b.addEventListener("click", async () => {
      const ans = b.dataset.ans;
      state.appliedLog.push({
        company: meta.company,
        role: meta.role,
        resumeName: state.resumes[state.autofillResumeIdx] && state.resumes[state.autofillResumeIdx].name,
        answer: ans,
        at: Date.now()
      });
      await persistAppliedLog();
      if (ans === "yes") {
        sendTransactionalEmail("applied", {
          company: isGenericCompany(meta.company) ? null : meta.company,
          role: meta.role,
          resumeName: state.resumes[state.autofillResumeIdx] && state.resumes[state.autofillResumeIdx].name
        });
      }
      box.querySelector(".applied-ack").textContent = ans === "yes" ? "\u2713 Logged — nice work! Keep going." : "No worries — finish up and come back anytime.";
      box.classList.add("applied-done");
    });
  });
}
document.getElementById("clear-jd-btn").addEventListener("click", () => {
  document.getElementById("jd-input").value = "";
  document.getElementById("grab-status").textContent = "";
});
loadAll();
