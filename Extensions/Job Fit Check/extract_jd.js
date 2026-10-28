(function () {
  function getSelectionText() {
    const sel = window.getSelection();
    const text = sel ? sel.toString().trim() : "";
    return text.length > 80 ? text : "";
  }

  function scoreElement(el) {
    const text = el.innerText || "";
    const len = text.trim().length;
    if (len < 200) return -1;
    let score = len;
    const tag = el.tagName.toLowerCase();
    const cls = (el.className || "").toString().toLowerCase();
    const id = (el.id || "").toLowerCase();
    const hay = tag + " " + cls + " " + id;
    const positive = ["job", "description", "posting", "details", "content", "main", "role", "vacancy"];
    const negative = ["nav", "header", "footer", "sidebar", "menu", "cookie", "banner", "comment", "related", "ad-"];
    positive.forEach((w) => { if (hay.includes(w)) score += 2000; });
    negative.forEach((w) => { if (hay.includes(w)) score -= 5000; });
    if (tag === "script" || tag === "style" || tag === "noscript") return -1;
    const linkDensity = el.querySelectorAll("a").length;
    score -= linkDensity * 20;
    return score;
  }

  function getMainContentText() {
    const candidates = Array.from(document.querySelectorAll("article, main, section, div"));
    let best = null;
    let bestScore = -1;
    for (const el of candidates) {
      const s = scoreElement(el);
      if (s > bestScore) {
        bestScore = s;
        best = el;
      }
    }
    if (best) {
      return best.innerText.trim();
    }
    return (document.body.innerText || "").trim();
  }

  function cleanText(text) {
    return text
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  const selected = getSelectionText();
  const result = selected || getMainContentText();
  const cleaned = cleanText(result);
  const truncated = cleaned.length > 18000 ? cleaned.slice(0, 18000) : cleaned;

  return {
    text: truncated,
    source: selected ? "selection" : "auto",
    pageTitle: document.title || "",
    url: window.location.href
  };
})();
