const DEFAULTS = {
  active: false,
  robot:      { enabled: false, frequency: 50 },
  echo:       { enabled: false, delay: 0.3, feedback: 0.4 },
  reverb:     { enabled: false, decay: 2 },
  lowpass:    { enabled: false, frequency: 2000 },
  highpass:   { enabled: false, frequency: 200 },
  distortion: { enabled: false, amount: 200 },
  love:       { enabled: false, rate: 5, depth: 0.5, warmth: 3000 },
};

const $ = id => document.getElementById(id);

let current = { ...DEFAULTS };

function updateBadge(active) {
  const badge = $('status-badge');
  badge.textContent = active ? 'ON' : 'OFF';
  badge.className = 'badge ' + (active ? 'on' : 'off');
}

function applyToUI(s) {
  $('active-toggle').checked  = s.active;
  $('fx-robot').checked       = s.robot.enabled;
  $('fx-echo').checked        = s.echo.enabled;
  $('fx-reverb').checked      = s.reverb.enabled;
  $('fx-lowpass').checked     = s.lowpass.enabled;
  $('fx-highpass').checked    = s.highpass.enabled;
  $('fx-distortion').checked  = s.distortion.enabled;
  $('fx-love').checked        = s.love.enabled;
  updateBadge(s.active);
}

function saveSettings() {
  chrome.storage.local.set({ voicemask_settings: current });
}

chrome.storage.local.get('voicemask_settings', result => {
  current = result.voicemask_settings || { ...DEFAULTS };
  applyToUI(current);
});

$('active-toggle').addEventListener('change', e => {
  current.active = e.target.checked;
  updateBadge(current.active);
  saveSettings();
});

const effectMap = {
  'fx-robot':      'robot',
  'fx-echo':       'echo',
  'fx-reverb':     'reverb',
  'fx-lowpass':    'lowpass',
  'fx-highpass':   'highpass',
  'fx-distortion': 'distortion',
  'fx-love':       'love',
};

Object.entries(effectMap).forEach(([id, key]) => {
  $(id).addEventListener('change', e => {
    current[key] = { ...current[key], enabled: e.target.checked };
    saveSettings();
  });
});
