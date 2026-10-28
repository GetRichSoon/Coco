/* Service worker: tracks which tabs currently have a detected application
   form (so the popup can show "Application detected on this page") and
   reflects it with a small badge on the toolbar icon. No AI, no network
   calls — purely local bookkeeping. */

const tabsWithApplication = new Set();

chrome.runtime.onInstalled.addListener(() => {
  console.log("JOB FIT CHECK Installed Successfully");
});

function setBadge(tabId, on) {
  if (on) {
    chrome.action.setBadgeText({ tabId, text: "•" });
    chrome.action.setBadgeBackgroundColor({ tabId, color: "#111111" });
    chrome.action.setTitle({ tabId, title: "Resume ↔ JD Matcher — application form detected" });
  } else {
    chrome.action.setBadgeText({ tabId, text: "" });
    chrome.action.setTitle({ tabId, title: "Resume ↔ JD Matcher" });
  }
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg && msg.type === "rjm_application_detected" && sender.tab && sender.tab.id != null) {
    tabsWithApplication.add(sender.tab.id);
    setBadge(sender.tab.id, true);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabsWithApplication.delete(tabId);
});

// Clear the flag once the user navigates away from that page.
chrome.webNavigation && chrome.webNavigation.onCommitted
  ? chrome.webNavigation.onCommitted.addListener((details) => {
      if (details.frameId === 0) {
        tabsWithApplication.delete(details.tabId);
        setBadge(details.tabId, false);
      }
    })
  : chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
      if (changeInfo.status === "loading") {
        tabsWithApplication.delete(tabId);
        setBadge(tabId, false);
      }
    });

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "rjm_check_application") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      sendResponse({ detected: !!(tab && tabsWithApplication.has(tab.id)) });
    });
    return true; // keep the message channel open for the async sendResponse
  }
});
