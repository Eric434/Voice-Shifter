(function () {
  function getDefaults() {
    return {
      active: false,
      robot:      { enabled: false, frequency: 50 },
      echo:       { enabled: false, delay: 0.3, feedback: 0.4 },
      reverb:     { enabled: false, decay: 2 },
      lowpass:    { enabled: false, frequency: 2000 },
      highpass:   { enabled: false, frequency: 200 },
      distortion: { enabled: false, amount: 200 },
      love:       { enabled: false, rate: 5, depth: 0.5, warmth: 3000 },
    };
  }

  function sendToPage(settings) {
    window.postMessage({ type: 'VOICEMASK_UPDATE', settings }, '*');
  }

  chrome.storage.local.get('voicemask_settings', (result) => {
    sendToPage(result.voicemask_settings || getDefaults());
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.voicemask_settings) {
      sendToPage(changes.voicemask_settings.newValue || getDefaults());
    }
  });
})();
