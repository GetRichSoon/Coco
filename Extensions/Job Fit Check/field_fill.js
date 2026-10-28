/* Injected on demand when the user clicks "Scan this page's form" / "Autofill".
   Three-layer matching, all local, zero AI calls:
     1. CANONICAL RULES — label/name/placeholder/id matched against a big
        synonym dictionary -> a canonical key (firstName, gender, ...).
     2. RESUME FACTS — if the canonical key has a value extracted from the
        active resume (name/email/phone/links), use it.
     3. LEARNED Q&A BANK — answers the user has typed in manually before are
        stored as {normLabel, answer} and reused by exact-normalized-label
        match first, then a fuzzy token-overlap match (so "Gender" and
        "What is your gender?" resolve to the same saved answer).
   Anything still unresolved is reported back to the popup as "unmatched" so
   the user can type it once — after which it's saved for every future
   application, on any site.
   Exposed as window.__rjmAutofill so it can be reused across scans without
   re-injecting. */

(function () {
  // Re-scan if already loaded (don't re-define rules)
  if (window.__rjmAutofill) {
    return window.__rjmAutofill.scan();
  }

  // ---------------------------------------------------------------------
  // Label normalization — shared "fingerprint" used for qaBank lookups
  // ---------------------------------------------------------------------
  function normalizeLabel(text) {
    return (text || "")
      .toLowerCase()
      .replace(/[*:?]/g, " ")
      .replace(/\(.*?\)/g, " ")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function tokenSet(s) {
    return new Set(normalizeLabel(s).split(" ").filter((t) => t.length > 1));
  }

  function jaccard(aSet, bSet) {
    if (!aSet.size || !bSet.size) return 0;
    let inter = 0;
    for (const t of aSet) if (bSet.has(t)) inter++;
    return inter / (aSet.size + bSet.size - inter);
  }

  // ---------------------------------------------------------------------
  // Canonical field dictionary — first matching rule wins per field.
  // Order matters: more specific patterns first, broad catch-alls last.
  // ---------------------------------------------------------------------
  const RULES = [
    { key: "email", patterns: ["e mail", "email address", "email"] },
    { key: "phone", patterns: ["mobile number", "phone number", "contact number", "telephone", "mobile", "phone"] },
    { key: "middleName", patterns: ["middle name", "middle initial"] },
    { key: "firstName", patterns: ["legal first name", "first name", "given name", "fname"] },
    { key: "lastName", patterns: ["legal last name", "last name", "surname", "family name", "lname"] },
    { key: "fullName", patterns: ["full legal name", "full name", "your name", "candidate name", "applicant name"] },
    { key: "preferredName", patterns: ["preferred name", "nickname", "pronouns"] },
    { key: "linkedin", patterns: ["linkedin"] },
    { key: "portfolio", patterns: ["portfolio", "personal website", "website", "personal site"] },
    { key: "github", patterns: ["github"] },
    { key: "city", patterns: ["city", "town"] },
    { key: "state", patterns: ["state", "province"] },
    { key: "zip", patterns: ["zip code", "zip", "postal code", "pincode", "pin code"] },
    { key: "country", patterns: ["country"] },
    { key: "address", patterns: ["street address", "current address", "address", "location"] },
    { key: "coverLetter", patterns: ["cover letter", "why do you want", "why are you interested", "tell us about yourself", "message to hiring", "additional information"] },
    { key: "currentCompany", patterns: ["current employer", "current company", "employer name"] },
    { key: "currentTitle", patterns: ["current title", "job title", "current role", "current position"] },
    { key: "experienceYears", patterns: ["years of experience", "total experience", "years experience"] },
    { key: "noticePeriod", patterns: ["notice period"] },
    { key: "expectedSalary", patterns: ["expected salary", "salary expectation", "desired salary", "compensation expectation"] },
    { key: "currentSalary", patterns: ["current salary", "current compensation", "current ctc"] },
    { key: "salary", patterns: ["salary", "ctc"] },
    { key: "workAuthorization", patterns: ["legally authorized to work", "work authorization", "authorized to work"] },
    { key: "visaSponsorship", patterns: ["require sponsorship", "visa sponsorship", "sponsorship"] },
    { key: "willingToRelocate", patterns: ["willing to relocate", "relocate"] },
    { key: "gender", patterns: ["gender identity", "gender", "sex"] },
    { key: "veteranStatus", patterns: ["veteran status", "veteran"] },
    { key: "disabilityStatus", patterns: ["disability status", "disability"] },
    { key: "ethnicity", patterns: ["race ethnicity", "race/ethnicity", "ethnicity", "race"] },
    { key: "degree", patterns: ["highest degree", "degree"] },
    { key: "university", patterns: ["university", "college", "school name", "alma mater"] },
    { key: "major", patterns: ["major", "field of study"] },
    { key: "graduationYear", patterns: ["graduation year", "year of graduation"] },
    { key: "howDidYouHear", patterns: ["how did you hear", "referral source", "how did you find"] },
    { key: "fullName", patterns: ["name"] } // broad catch-all, kept last
  ];

  function matchRule(text) {
    for (const rule of RULES) {
      for (const p of rule.patterns) {
        if (text.includes(p)) return rule.key;
      }
    }
    return null;
  }

  // ---------------------------------------------------------------------
  // DOM scanning
  // ---------------------------------------------------------------------
  function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function labelTextFor(el) {
    let text = "";
    if (el.labels && el.labels.length) {
      text += Array.from(el.labels).map((l) => l.innerText || l.textContent || "").join(" ");
    }
    if (el.id) {
      try {
        const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (lbl) text += " " + (lbl.innerText || lbl.textContent || "");
      } catch (e) {
        const lbl = document.querySelector('label[for="' + el.id.replace(/"/g, "") + '"]');
        if (lbl) text += " " + (lbl.innerText || lbl.textContent || "");
      }
    }
    text += " " + (el.getAttribute("aria-label") || "");
    text += " " + (el.getAttribute("placeholder") || "");
    text += " " + (el.name || "");
    text += " " + (el.id || "");
    const parent = el.closest("label, .form-group, .field, fieldset, div");
    if (parent) {
      const clone = parent.cloneNode(true);
      clone.querySelectorAll("input, select, textarea, button, script").forEach((n) => n.remove());
      text += " " + (clone.innerText || clone.textContent || "");
    }
    return text.toLowerCase().replace(/\s+/g, " ").trim();
  }

  function collectFields() {
    const nodes = Array.from(document.querySelectorAll("input, textarea, select"))
      .filter((el) => {
        if (!isVisible(el)) return false;
        const type = (el.getAttribute("type") || "text").toLowerCase();
        if (["hidden", "submit", "button", "reset", "image", "file"].includes(type)) return false;
        if (el.disabled || el.readOnly) return false;
        return true;
      });

    return nodes.map((el, i) => {
      const labelText = labelTextFor(el);
      const matchedKey = matchRule(labelText);
      el.setAttribute("data-rjm-idx", String(i));
      return {
        idx: i,
        tag: el.tagName.toLowerCase(),
        type: (el.getAttribute("type") || "text").toLowerCase(),
        labelText,
        normLabel: normalizeLabel(labelText),
        matchedKey
      };
    });
  }

  // ---------------------------------------------------------------------
  // Resolve a value for each field using facts (from resume) + qaBank,
  // without touching the DOM yet. Returns the same field objects enriched
  // with { suggestedValue, source } where source is "facts" | "qa" |
  // "qa-fuzzy" | null.
  // ---------------------------------------------------------------------
  function resolveValues(fields, facts, qaBank) {
    const bank = Array.isArray(qaBank) ? qaBank : [];
    return fields.map((f) => {
      let suggestedValue = null;
      let source = null;

      if (f.matchedKey && facts && facts[f.matchedKey] != null && facts[f.matchedKey] !== "") {
        suggestedValue = facts[f.matchedKey];
        source = "facts";
      }

      if (suggestedValue == null && f.normLabel) {
        const exact = bank.find((q) => q.normLabel === f.normLabel);
        if (exact) {
          suggestedValue = exact.answer;
          source = "qa";
        }
      }

      if (suggestedValue == null && f.normLabel && bank.length) {
        const fSet = tokenSet(f.normLabel);
        let best = null;
        let bestScore = 0;
        for (const q of bank) {
          const score = jaccard(fSet, tokenSet(q.normLabel));
          if (score > bestScore) { bestScore = score; best = q; }
        }
        if (best && bestScore >= 0.6) {
          suggestedValue = best.answer;
          source = "qa-fuzzy";
        }
      }

      return Object.assign({}, f, { suggestedValue, source });
    });
  }

  // ---------------------------------------------------------------------
  // Writing values into the DOM
  // ---------------------------------------------------------------------
  function setNativeValue(el, value) {
    const tag = el.tagName.toLowerCase();
    if (tag === "select") {
      const opt = Array.from(el.options).find(
        (o) => o.textContent.trim().toLowerCase() === String(value).toLowerCase() ||
               o.value.toLowerCase() === String(value).toLowerCase()
      );
      if (opt) {
        el.value = opt.value;
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }
      return false;
    }
    if (tag === "input" && (el.type === "checkbox" || el.type === "radio")) {
      const truthy = /^(y|yes|true|1)$/i.test(String(value).trim());
      el.checked = truthy;
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    const proto = tag === "textarea" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function fillByIdx(idx, value) {
    const el = document.querySelector(`[data-rjm-idx="${idx}"]`);
    if (!el) return false;
    return setNativeValue(el, value);
  }

  async function scanAndResolve() {
    const fields = collectFields();
    let facts = null;
    let qaBank = [];
    try {
      const stored = await chrome.storage.local.get(["rjm_qa_bank", "rjm_active_facts"]);
      qaBank = stored.rjm_qa_bank || [];
      facts = stored.rjm_active_facts || null;
    } catch (e) {
      // storage unavailable for some reason — fall back to canonical-only
    }
    return resolveValues(fields, facts, qaBank);
  }

  window.__rjmAutofill = {
    scan: scanAndResolve,
    normalizeLabel: normalizeLabel,
    fillByIdx: fillByIdx,
    // fields: array enriched by resolveValues(); fills everything with a
    // non-empty suggestedValue. Returns count filled.
    fillResolved: function (fields) {
      let filledCount = 0;
      fields.forEach((f) => {
        if (f.suggestedValue != null && f.suggestedValue !== "") {
          if (fillByIdx(f.idx, f.suggestedValue)) filledCount++;
        }
      });
      return filledCount;
    },
    // back-compat shim used by older calls
    fillByKeyMap: function (keyMap, fieldsList) {
      let filledCount = 0;
      fieldsList.forEach((f) => {
        if (f.matchedKey && keyMap[f.matchedKey] != null && keyMap[f.matchedKey] !== "") {
          if (fillByIdx(f.idx, keyMap[f.matchedKey])) filledCount++;
        }
      });
      return filledCount;
    }
  };

  return window.__rjmAutofill.scan();
})();
