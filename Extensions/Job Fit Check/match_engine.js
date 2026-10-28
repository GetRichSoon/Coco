/* Shared match engine for service worker (importScripts) */
const JFC_FALLBACK_MODELS = [
  "google/gemini-2.5-flash-lite",
  "google/gemini-2.5-flash",
  "qwen/qwen3-30b-a3b:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "deepseek/deepseek-chat-v3.1:free",
  "mistralai/mistral-small-3.2-24b-instruct:free",
  "moonshotai/kimi-k2:free"
];
const JFC_MODEL_TIMEOUT_MS = 5000;
const JFC_DAILY_LIMIT = 20;

function jfcClampScore(n) {
  n = Number(n);
  if (!isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function jfcBuildPrompt(jd, resumeName, resumeText) {
  return `You are an expert technical recruiter and ATS shortlisting system.

Compare the RESUME against the JOB DESCRIPTION and respond with ONLY valid JSON (no markdown) matching EXACTLY this shape:

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
  "bonus_points": [{"reason":"<max 6 words>","points":<1-5>}],
  "verdict": "<max 15 words>",
  "matched_requirements": [{"requirement":"<max 6 words>","evidence":"<max 10 words>"}],
  "missing_or_weak": [{"requirement":"<max 6 words>","note":"<max 8 words>"}],
  "nice_to_have_matches": [{"requirement":"<max 6 words>","evidence":"<max 8 words>"}],
  "experience_fit": "<max 15 words>",
  "tailoring_tips": ["<max 12 words>","<max 12 words>"]
}

Limits: matched_requirements max 4, missing_or_weak max 4, nice_to_have_matches max 3, bonus_points max 3, tips exactly 2.

RESUME NAME: ${resumeName}
RESUME:
${(resumeText || "").slice(0, 12000)}

JOB DESCRIPTION:
${(jd || "").slice(0, 12000)}`;
}

function jfcComputeWeightedScore(parsed) {
  const skills = jfcClampScore(parsed.skills_score);
  const experience = jfcClampScore(parsed.experience_score);
  const requirements = jfcClampScore(parsed.requirements_score);
  const education = jfcClampScore(parsed.education_score);
  const mustHaveCount = Number(parsed.must_have_count || 0);
  const mustHaveMatched = Number(parsed.must_have_matched || 0);
  const experienceGap = Number(parsed.experience_gap_years || 0);
  const titleMatch = jfcClampScore(parsed.title_match_score || 0);
  const projectSimilarity = jfcClampScore(parsed.project_similarity_score || 0);

  let score =
    skills * 0.22 +
    experience * 0.25 +
    requirements * 0.20 +
    education * 0.05 +
    titleMatch * 0.10 +
    projectSimilarity * 0.18;

  const missing = Array.isArray(parsed.missing_or_weak) ? parsed.missing_or_weak.length : 0;
  if (missing >= 1) score *= 0.85;
  if (missing >= 2) score *= 0.70;
  if (missing >= 3) score *= 0.50;

  if (mustHaveCount > 0) {
    const ratio = mustHaveMatched / mustHaveCount;
    if (ratio < 0.30) score *= 0.40;
    else if (ratio < 0.50) score *= 0.60;
    else if (ratio < 0.70) score *= 0.80;
  }

  if (experience < 20) score *= 0.35;
  else if (experience < 40) score *= 0.55;
  else if (experience < 60) score *= 0.75;
  else if (experience < 75) score *= 0.90;

  if (requirements < 30) score *= 0.50;
  else if (requirements < 50) score *= 0.70;
  else if (requirements < 70) score *= 0.85;

  if (experienceGap <= -5) score *= 0.50;
  else if (experienceGap <= -3) score *= 0.70;
  else if (experienceGap <= -1) score *= 0.85;
  else if (experienceGap >= 3) score += 3;

  const bonusList = Array.isArray(parsed.bonus_points) ? parsed.bonus_points : [];
  score += Math.min(8, bonusList.reduce((s, b) => s + (Number(b.points) || 0), 0));
  score = Math.round(score);
  if (score > 97) score = 97;
  if (score < 3) score = 3;

  let recommendation = "Weak fit";
  if (mustHaveCount > 0 && mustHaveMatched / mustHaveCount < 0.5) recommendation = "Low chance of shortlist";
  else if (score >= 85) recommendation = "Apply immediately";
  else if (score >= 70) recommendation = "Strong match";
  else if (score >= 55) recommendation = "Apply after tailoring";

  return {
    overall: score,
    recommendation,
    breakdown: { skills, experience, requirements, education, titleMatch, projectSimilarity },
    bonus: bonusList,
    matched_requirements: parsed.matched_requirements || [],
    missing_or_weak: parsed.missing_or_weak || [],
    nice_to_have_matches: parsed.nice_to_have_matches || [],
    tailoring_tips: parsed.tailoring_tips || [],
    verdict: parsed.verdict || recommendation
  };
}

function jfcExtractJson(text) {
  const raw = (text || "").trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1] : raw;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON in model response");
  return JSON.parse(body.slice(start, end + 1));
}

async function jfcTryOneModel(apiKey, model, prompt) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), JFC_MODEL_TIMEOUT_MS);
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://jobfitcheck.extension",
        "X-Title": "Job Fit Check"
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [{ role: "user", content: prompt }]
      })
    });
    clearTimeout(t);
    if (res.status === 429) {
      const err = new Error("rate limited");
      err.rateLimited = true;
      throw err;
    }
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    const parsed = jfcExtractJson(content);
    return { parsed, model };
  } catch (e) {
    clearTimeout(t);
    throw e;
  }
}

async function jfcCallOpenRouter(apiKey, models, prompt) {
  const list = (models && models.length ? models : JFC_FALLBACK_MODELS).slice();
  return new Promise((resolve, reject) => {
    let pending = list.length;
    const errors = [];
    let settled = false;
    list.forEach((model) => {
      jfcTryOneModel(apiKey, model, prompt)
        .then((v) => {
          if (settled) return;
          settled = true;
          resolve(v);
        })
        .catch((e) => {
          errors.push(e);
          pending--;
          if (!settled && pending === 0) {
            settled = true;
            if (errors.length && errors.every((er) => er && er.rateLimited)) {
              reject(new Error("OPENROUTER_LIMIT_REACHED"));
            } else {
              reject(new Error((errors[errors.length - 1] && errors[errors.length - 1].message) || "All models failed"));
            }
          }
        });
    });
  });
}

function jfcParseJobMeta(pageTitle, url) {
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

function jfcToday() {
  return new Date().toISOString().slice(0, 10);
}
