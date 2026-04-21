const TARGETS = [
  'web.whatsapp.com',
  'meet.google.com',
  'discord.com',
  'zoom.us',
];

function isTarget(url) {
  return url && TARGETS.some(t => url.includes(t));
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && isTarget(tab.url)) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['inject.js'],
        world: 'MAIN',
        injectImmediately: true,
      });
    } catch (e) {
      console.warn('[VoiceMask] Injection failed:', e.message);
    }
  }
});
