/* Job Fit Check service worker — overview + on-page match/autofill */
importScripts("match_engine.js");

const tabsWithApplication = new Set();
const tabsWithJob = new Set();

chrome.runtime.onInstalled.addListener(() => {
  console.log("Job Fit Check installed");
});

function setBadge(tabId, kind) {
  try {
    if (kind === "application") {
      chrome.action.setBadgeText({ tabId, text: "APP" });
      chrome.action.setBadgeBackgroundColor({ tabId, color: "#0f766e" });
      chrome.action.setTitle({ tabId, title: "Job Fit Check — application form" });
    } else if (kind === "job") {
      chrome.action.setBadgeText({ tabId, text: "JOB" });
      chrome.action.setBadgeBackgroundColor({ tabId, color: "#0f766e" });
      chrome.action.setTitle({ tabId, title: "Job Fit Check — job page" });
    } else {
      chrome.action.setBadgeText({ tabId, text: "" });
      chrome.action.setTitle({ tabId, title: "Job Fit Check" });
    }
  } catch (e) { /* tab may be gone */ }
}

function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}
function storageSet(obj) {
  return new Promise((resolve) => chrome.storage.local.set(obj, resolve));
}

function extractFactsFromText(resumeText) {
  const facts = {};
  const text = resumeText || "";
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) facts.email = emailMatch[0];
  const phoneMatch = text.match(/(\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
  if (phoneMatch) facts.phone = phoneMatch[0].trim();
  const linkedinMatch = text.match(/(https?:\/\/)?(www\.)?linkedin\.com\/in\/[a-zA-Z0-9\-_/]+/i);
  if (linkedinMatch) facts.linkedin = linkedinMatch[0];
  const githubMatch = text.match(/(https?:\/\/)?(www\.)?github\.com\/[a-zA-Z0-9\-_/]+/i);
  if (githubMatch) facts.github = githubMatch[0];
  const firstLines = text.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 5);
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

async function ensureActiveFacts() {
  const data = await storageGet([
    "rjm_resumes", "rjm_autofill_resume_idx", "rjm_active_facts",
    "rjm_active_facts_overrides_0", "rjm_active_facts_overrides_1",
    "rjm_active_facts_overrides_2", "rjm_active_facts_overrides_3",
    "rjm_active_facts_overrides_4"
  ]);
  const resumes = data.rjm_resumes || [];
  let idx = typeof data.rjm_autofill_resume_idx === "number" ? data.rjm_autofill_resume_idx : -1;
  if (idx < 0 || !resumes[idx]) idx = resumes.findIndex(Boolean);
  if (idx < 0 || !resumes[idx]) {
    await storageSet({ rjm_active_facts: null });
    return null;
  }
  const base = extractFactsFromText(resumes[idx].text);
  const overrides = data["rjm_active_facts_overrides_" + idx] || {};
  const merged = Object.assign({}, base, overrides);
  await storageSet({ rjm_active_facts: merged, rjm_autofill_resume_idx: idx });
  return merged;
}

async function getOverview() {
  const data = await storageGet([
    "rjm_usage", "rjm_plan", "rjm_applied_log", "rjm_match_history",
    "rjm_resumes", "rjm_qa_bank", "rjm_last_match_scores", "rjm_session",
    "rjm_display_name", "rjm_apikey"
  ]);
  let usage = data.rjm_usage || { date: null, count: 0 };
  if (usage.date !== jfcToday()) usage = { date: jfcToday(), count: 0 };
  const plan = data.rjm_plan || "free";
  const applied = (data.rjm_applied_log || []).filter((x) => x && x.answer === "yes");
  const history = data.rjm_match_history || [];
  const resumes = (data.rjm_resumes || []).filter(Boolean);
  const scores = (data.rjm_last_match_scores || []).filter((n) => typeof n === "number");
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const best = scores.length ? Math.max.apply(null, scores) : 0;
  const left = plan === "pro" ? -1 : Math.max(0, JFC_DAILY_LIMIT - (usage.count || 0));
  return {
    todayUsed: usage.count || 0,
    todayLeft: left,
    plan,
    appliedCount: applied.length,
    totalMatches: history.length,
    resumeCount: resumes.length,
    qaCount: (data.rjm_qa_bank || []).length,
    avgScore: avg,
    bestScore: best,
    hasKey: !!data.rjm_apikey,
    loggedIn: !!(data.rjm_session && data.rjm_session.user),
    displayName: data.rjm_display_name || "",
    recentMatches: history.slice(0, 8)
  };
}

async function getDashboard() {
  const overview = await getOverview();
  const data = await storageGet([
    "rjm_resumes", "rjm_autofill_resume_idx", "rjm_apikey", "rjm_match_history"
  ]);
  const resumes = data.rjm_resumes || [];
  let activeIdx = typeof data.rjm_autofill_resume_idx === "number" ? data.rjm_autofill_resume_idx : -1;
  if (activeIdx < 0 || !resumes[activeIdx]) activeIdx = resumes.findIndex(Boolean);

  const resumeList = resumes.map((r, i) => {
    if (!r) return null;
    return {
      idx: i,
      name: r.name || ("Resume " + (i + 1)),
      chars: (r.text || "").length,
      active: i === activeIdx
    };
  }).filter(Boolean);

  return Object.assign({}, overview, {
    ok: true,
    hasKey: !!data.rjm_apikey,
    resumes: resumeList,
    activeResumeIdx: activeIdx,
    activeResumeName: activeIdx >= 0 && resumes[activeIdx] ? resumes[activeIdx].name : null,
    recentMatches: (data.rjm_match_history || []).slice(0, 10)
  });
}

async function setActiveResume(idx) {
  const data = await storageGet(["rjm_resumes"]);
  const resumes = data.rjm_resumes || [];
  if (!resumes[idx]) return { ok: false, error: "Resume slot is empty." };
  await storageSet({ rjm_autofill_resume_idx: idx });
  await ensureActiveFacts();
  return { ok: true, idx, name: resumes[idx].name };
}

async function grabJdPreview(tabId) {
  const jd = await grabJdFromTab(tabId);
  if (!jd || !jd.text) return { ok: false, error: "Could not read page text." };
  const words = jd.text.trim().split(/\s+/).filter(Boolean).length;
  return {
    ok: true,
    chars: jd.text.length,
    words,
    source: jd.source || "auto",
    preview: jd.text.slice(0, 180)
  };
}

async function scanFormOnTab(tabId) {
  await ensureActiveFacts();
  try {
    let fields = null;
    try {
      const inject = await chrome.scripting.executeScript({
        target: { tabId },
        files: ["field_fill.js"]
      });
      fields = inject && inject[0] && inject[0].result;
    } catch (e) {}

    if (!Array.isArray(fields)) {
      const rescan = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => (window.__rjmAutofill ? window.__rjmAutofill.scan() : [])
      });
      fields = rescan && rescan[0] && rescan[0].result;
    }
    if (fields && typeof fields.then === "function") fields = await fields;
    if (!Array.isArray(fields) || !fields.length) {
      return { ok: false, error: "No fillable form fields found." };
    }
    const resolved = fields.filter((f) => f && f.suggestedValue != null && String(f.suggestedValue) !== "");
    return {
      ok: true,
      total: fields.length,
      resolved: resolved.length,
      preview: fields.slice(0, 12).map((f) => ({
        label: f.labelText || f.normLabel || "Field",
        value: f.suggestedValue != null ? String(f.suggestedValue) : "",
        source: f.source || null
      }))
    };
  } catch (e) {
    return { ok: false, error: e.message || "Scan failed." };
  }
}

async function grabJdFromTab(tabId) {
  try {
    const injected = await chrome.scripting.executeScript({
      target: { tabId },
      files: ["extract_jd.js"]
    });
    return (injected && injected[0] && injected[0].result) || null;
  } catch (e) {
    return null;
  }
}

async function bumpUsage(plan, by) {
  if (plan === "pro" || !by) return;
  const data = await storageGet(["rjm_usage"]);
  let usage = data.rjm_usage || { date: null, count: 0 };
  if (usage.date !== jfcToday()) usage = { date: jfcToday(), count: 0 };
  usage.count += by;
  await storageSet({ rjm_usage: usage });
}

async function saveMatchLocal(resume, scored, meta, url) {
  const data = await storageGet(["rjm_match_history", "rjm_last_match_scores"]);
  const history = [{
    company: meta.company,
    role: meta.role,
    resumeName: resume.name,
    score: scored.overall,
    recommendation: scored.recommendation || "",
    url: url || "",
    at: Date.now()
  }].concat(data.rjm_match_history || []).slice(0, 100);
  const scores = [scored.overall].concat(data.rjm_last_match_scores || []).slice(0, 10);
  await storageSet({ rjm_match_history: history, rjm_last_match_scores: scores });
}

async function runMatchOnTab(tabId, pageTitle, url) {
  const data = await storageGet([
    "rjm_apikey", "rjm_models", "rjm_resumes", "rjm_plan", "rjm_usage",
    "rjm_autofill_resume_idx"
  ]);
  if (!data.rjm_apikey) {
    return { ok: false, error: "Add your OpenRouter API key: open overview → Setup." };
  }
  const resumes = data.rjm_resumes || [];
  const filled = resumes.map((r, i) => ({ r, i })).filter((x) => x.r && x.r.text);
  if (!filled.length) {
    return { ok: false, error: "Upload a resume: open overview → Setup." };
  }

  const plan = data.rjm_plan || "free";
  let usage = data.rjm_usage || { date: null, count: 0 };
  if (usage.date !== jfcToday()) usage = { date: jfcToday(), count: 0 };
  if (plan !== "pro" && usage.count >= JFC_DAILY_LIMIT) {
    return { ok: false, error: "Daily free match limit reached. Try again tomorrow." };
  }

  const jdResult = await grabJdFromTab(tabId);
  if (!jdResult || !jdResult.text || jdResult.text.length < 40) {
    return { ok: false, error: "Could not read enough job text. Select the JD text, then Match again." };
  }

  const meta = jfcParseJobMeta(jdResult.pageTitle || pageTitle, jdResult.url || url);
  const models = data.rjm_models && data.rjm_models.length ? data.rjm_models : JFC_FALLBACK_MODELS;
  let idx = typeof data.rjm_autofill_resume_idx === "number" ? data.rjm_autofill_resume_idx : filled[0].i;
  if (!resumes[idx] || !resumes[idx].text) idx = filled[0].i;

  const remaining = plan === "pro" ? filled.length : Math.max(1, JFC_DAILY_LIMIT - usage.count);
  // Prefer active resume first, then others — sequential to avoid usage race + rate limits
  const ordered = filled.slice().sort((a, b) => (a.i === idx ? -1 : b.i === idx ? 1 : 0));
  const toScore = ordered.slice(0, Math.min(ordered.length, remaining));

  const results = [];
  let successCount = 0;

  for (const { r, i } of toScore) {
    try {
      const { parsed, model } = await jfcCallOpenRouter(
        data.rjm_apikey,
        models,
        jfcBuildPrompt(jdResult.text, r.name, r.text)
      );
      const scored = Object.assign({}, parsed, jfcComputeWeightedScore(parsed));
      await saveMatchLocal(r, scored, meta, jdResult.url || url);
      successCount += 1;
      results.push({
        resumeIdx: i,
        resumeName: r.name,
        score: scored.overall,
        recommendation: scored.recommendation,
        verdict: scored.verdict,
        tips: scored.tailoring_tips || [],
        matched: (scored.matched_requirements || []).slice(0, 3),
        missing: (scored.missing_or_weak || []).slice(0, 3),
        model
      });
    } catch (e) {
      results.push({
        resumeIdx: i,
        resumeName: r.name,
        error: e.message === "OPENROUTER_LIMIT_REACHED"
          ? "OpenRouter free limit reached — create a new key."
          : (e.message || "Match failed")
      });
    }
  }

  await bumpUsage(plan, successCount);
  results.sort((a, b) => (b.score || 0) - (a.score || 0));

  if (!results.length || results.every((r) => r.error)) {
    return {
      ok: false,
      error: (results[0] && results[0].error) || "Match failed for all resumes."
    };
  }

  return {
    ok: true,
    meta,
    jdChars: jdResult.text.length,
    results
  };
}

async function runAutofillOnTab(tabId) {
  await ensureActiveFacts();
  const data = await storageGet(["rjm_active_facts", "rjm_resumes"]);
  const hasResume = (data.rjm_resumes || []).some(Boolean);
  const facts = data.rjm_active_facts || {};
  if (!hasResume && !Object.keys(facts).length) {
    return { ok: false, error: "Upload a resume in overview → Setup first." };
  }

  try {
    // Always inject/refresh engine, then scan
    let fields = null;
    try {
      const inject = await chrome.scripting.executeScript({
        target: { tabId },
        files: ["field_fill.js"]
      });
      fields = inject && inject[0] && inject[0].result;
    } catch (e) {
      /* fall through to rescan */
    }

    if (!Array.isArray(fields)) {
      const rescan = await chrome.scripting.executeScript({
        target: { tabId },
        world: "ISOLATED",
        func: () => {
          if (!window.__rjmAutofill) return [];
          return window.__rjmAutofill.scan();
        }
      });
      fields = rescan && rescan[0] && rescan[0].result;
    }

    // Await if Chrome returned a thenable oddly
    if (fields && typeof fields.then === "function") {
      fields = await fields;
    }

    if (!Array.isArray(fields) || !fields.length) {
      return { ok: false, error: "No fillable form fields found on this page." };
    }

    const resolved = fields.filter((f) => f && f.suggestedValue != null && String(f.suggestedValue) !== "");
    if (!resolved.length) {
      return {
        ok: true,
        filled: 0,
        total: fields.length,
        message: "Found " + fields.length + " fields, but none matched your resume yet."
      };
    }

    const fillRes = await chrome.scripting.executeScript({
      target: { tabId },
      func: (list) => {
        if (!window.__rjmAutofill) return 0;
        return window.__rjmAutofill.fillResolved(list);
      },
      args: [resolved]
    });
    const filled = (fillRes && fillRes[0] && fillRes[0].result) || 0;

    return {
      ok: true,
      filled,
      total: fields.length,
      unresolved: fields.length - resolved.length,
      message: "Filled " + filled + " of " + fields.length + " fields.",
      preview: fields.slice(0, 12).map((f) => ({
        label: f.labelText || f.normLabel || "Field",
        value: f.suggestedValue != null ? String(f.suggestedValue) : "",
        source: f.source || null
      }))
    };
  } catch (e) {
    return { ok: false, error: e.message || "Autofill failed on this page." };
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return;

  if (msg.type === "rjm_application_detected" && sender.tab && sender.tab.id != null) {
    tabsWithApplication.add(sender.tab.id);
    tabsWithJob.delete(sender.tab.id);
    setBadge(sender.tab.id, "application");
    return;
  }

  if (msg.type === "jfc_job_page_detected" && sender.tab && sender.tab.id != null) {
    if (!tabsWithApplication.has(sender.tab.id)) {
      tabsWithJob.add(sender.tab.id);
      setBadge(sender.tab.id, "job");
    }
    return;
  }

  if (msg.type === "rjm_check_application") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      const id = tab && tab.id;
      sendResponse({
        detected: !!(id && tabsWithApplication.has(id)),
        jobPage: !!(id && tabsWithJob.has(id)),
        kind: id && tabsWithApplication.has(id)
          ? "application"
          : (id && tabsWithJob.has(id) ? "job" : "none")
      });
    });
    return true;
  }

  if (msg.type === "jfc_get_overview") {
    getOverview().then(sendResponse).catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (msg.type === "jfc_get_dashboard") {
    getDashboard().then(sendResponse).catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }

  if (msg.type === "jfc_set_active_resume") {
    setActiveResume(msg.idx).then(sendResponse).catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }

  if (msg.type === "jfc_grab_jd_preview") {
    const tabId = sender.tab && sender.tab.id;
    if (tabId == null) {
      sendResponse({ ok: false, error: "No active tab." });
      return;
    }
    grabJdPreview(tabId).then(sendResponse).catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }

  if (msg.type === "jfc_scan_form") {
    const tabId = sender.tab && sender.tab.id;
    if (tabId == null) {
      sendResponse({ ok: false, error: "No active tab." });
      return;
    }
    scanFormOnTab(tabId).then(sendResponse).catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }

  if (msg.type === "jfc_run_match") {
    const tabId = sender.tab && sender.tab.id;
    if (tabId == null) {
      sendResponse({ ok: false, error: "No active tab." });
      return;
    }
    runMatchOnTab(tabId, msg.title, msg.url)
      .then(sendResponse)
      .catch((e) => sendResponse({ ok: false, error: e.message || "Match failed" }));
    return true;
  }

  if (msg.type === "jfc_run_autofill") {
    const tabId = sender.tab && sender.tab.id;
    if (tabId == null) {
      sendResponse({ ok: false, error: "No active tab." });
      return;
    }
    runAutofillOnTab(tabId)
      .then(sendResponse)
      .catch((e) => sendResponse({ ok: false, error: e.message || "Autofill failed" }));
    return true;
  }

  if (msg.type === "jfc_widget_action") {
    sendResponse({
      ok: true,
      message: "Open the Job Fit Check icon in the toolbar for overview."
    });
    return true;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabsWithApplication.delete(tabId);
  tabsWithJob.delete(tabId);
});

if (chrome.webNavigation && chrome.webNavigation.onCommitted) {
  chrome.webNavigation.onCommitted.addListener((details) => {
    if (details.frameId === 0) {
      tabsWithApplication.delete(details.tabId);
      tabsWithJob.delete(details.tabId);
      setBadge(details.tabId, null);
    }
  });
}
