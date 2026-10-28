/* Runs on every page (lightweight, passive). Looks for signs that the
   current page is a job application form — multiple visible form fields
   plus apply/submit-style wording nearby — and tells the background
   script so it can flag the toolbar icon and the popup can show a banner
   like "Application form detected on this page". Does nothing on pages
   that don't look like an application; never touches the DOM. */
(function () {
function looksLikeApplication() {
  const fields = Array.from(
    document.querySelectorAll("input, textarea, select")
  ).filter((el) => {
    const type = (el.getAttribute("type") || "text").toLowerCase();

    if (
      ["hidden", "submit", "button", "reset", "image"].includes(type)
    ) {
      return false;
    }

    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });

  if (fields.length < 3) return false;

  const pageText = (document.body.innerText || "").toLowerCase();
  const titleHints = (document.title || "").toLowerCase();
  const urlHints = window.location.href.toLowerCase();

  const signals = [
    "first name",
"last name",
"legal name",
"email",
"phone",
"resume/cv",
"cover letter",
"desired salary",
"salary",
"veteran status",
"disability status",
"gender",
"race",
"ethnicity",
"voluntary self-identification",
"equal employment opportunity",
"eeo",
"authorized to work",
"immigration case",
"sponsor",
"h-1b",
"highest level of education",
"current city",
"state of residence",
"create a job alert",
    "apply now",
    "submit application",
    "job application",
    "application form",
    "upload your resume",
    "upload resume",
    "attach resume",
    "resume",
    "cv",
    "curriculum vitae",
    "cover letter",
    "portfolio",
    "linkedin profile",
    "github",
    "personal website",
    "apply for this",
    "candidate information",
    "personal information",
    "work experience",
    "employment history",
    "education",
    "phone number",
    "email address",
    "years of experience",
    "work authorization",
    "visa sponsorship",
    "eligible to work",
    "salary expectation",
    "expected salary",
    "notice period",
    "current company",
    "current employer",
    "current title",
    "desired compensation",
    "upload file",
    "drag and drop resume",
    "attach cv",
    "submit your application",
    "easy apply",
    "apply with linkedin"
  ];

  const signalCount = signals.filter((s) => pageText.includes(s)).length;

  const fileInputs = document.querySelectorAll(
    'input[type="file"]'
  ).length;

  const submitButtons = Array.from(
    document.querySelectorAll("button,input[type='submit']")
  ).filter((el) => {
    const txt =
      (
        el.innerText ||
        el.value ||
        el.getAttribute("aria-label") ||
        ""
      ).toLowerCase();

    return /apply|submit|continue|next|send/i.test(txt);
  }).length;

  const labelSignals = Array.from(
    document.querySelectorAll("label")
  ).filter((label) => {
    const txt = label.innerText.toLowerCase();

    return (
      txt.includes("resume") ||
      txt.includes("cv") ||
      txt.includes("cover letter") ||
      txt.includes("linkedin") ||
      txt.includes("portfolio") ||
      txt.includes("phone") ||
      txt.includes("email")
    );
  }).length;

  const urlSignal =
    /apply|application|jobs?|careers?|greenhouse|lever|workday|ashby|smartrecruiters|icims/.test(urlHints);

  const titleSignal =
    /apply|application|job|career|position|opening/.test(titleHints);

const greenhouseSignals = [
  "resume/cv",
  "cover letter",
  "linkedin profile",
  "voluntary self-identification",
  "disability status",
  "veteran status",
  "equal employment opportunity",
  "authorized to work",
  "desired salary",
  "first name",
  "last name",
  "legal name",
  "race",
  "ethnicity",
  "gender"
];

const greenhouseScore =
  greenhouseSignals.filter(s => pageText.includes(s)).length;

const applicationQuestions = [
  "first name",
  "last name",
  "email",
  "phone",
  "resume",
  "cover letter",
  "salary",
  "education",
  "linkedin",
  "authorized to work",
  "veteran status",
  "disability status"
];

const questionScore =
  applicationQuestions.filter(q =>
    pageText.includes(q)
  ).length;

let score = 0;

score += signalCount;
score += questionScore;

if (fields.length >= 3) score += 3;
if (fields.length >= 8) score += 5;

if (fileInputs > 0) score += 10;

if (submitButtons > 0) score += 3;

if (labelSignals >= 2) score += 5;

if (urlSignal) score += 2;

if (titleSignal) score += 2;

if (greenhouseScore >= 2) score += 10;

return score >= 10;
}

function runDetection() {
  try {
    if (looksLikeApplication()) {
      chrome.runtime.sendMessage({
        type: "rjm_application_detected",
        url: window.location.href,
        title: document.title
      });
    }
  } catch (e) {
    // ignore
  }
}

// Run immediately
runDetection();

// Run again after page loads more content
setTimeout(runDetection, 1000);
setTimeout(runDetection, 3000);
setTimeout(runDetection, 5000);
setTimeout(runDetection, 8000);

// Detect dynamically loaded forms
const observer = new MutationObserver(() => {
  runDetection();
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true
});
})();
