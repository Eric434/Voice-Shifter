const BUILTIN_HOSTS = [
  'web.whatsapp.com',
  'meet.google.com',
  'discord.com',
  'zoom.us',
];

let customHosts = [];

// Load custom hosts from storage on startup
chrome.storage.local.get('voicemask_custom_hosts', (result) => {
  customHosts = result.voicemask_custom_hosts || [];
});

// Keep custom hosts in sync
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.voicemask_custom_hosts) {
    customHosts = changes.voicemask_custom_hosts.newValue || [];
  }
});

function isTarget(url) {
  if (!url) return false;
  const allHosts = [...BUILTIN_HOSTS, ...customHosts];
  return allHosts.some(h => url.includes(h));
}

async function injectIntoTab(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['inject.js'],
      world: 'MAIN',
      injectImmediately: true,
    });
    // Also send current settings to the content script
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content-script.js'],
    });
  } catch (e) {
    console.warn('[VoiceMask] Injection failed:', e.message);
  }
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && isTarget(tab.url)) {
    await injectIntoTab(tabId);
  }
});

// Handle "inject into active tab now" message from popup
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'inject-active-tab') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs[0]) {
        await injectIntoTab(tabs[0].id);
        sendResponse({ ok: true });
      } else {
        sendResponse({ ok: false, error: 'No active tab' });
      }
    });
    return true; // keep channel open for async sendResponse
  }
});
