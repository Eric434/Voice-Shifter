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
let customHosts = [];

// ── Effects UI ──────────────────────────────────────────────────────────────

function updateBadge(active) {
  const badge = $('status-badge');
  badge.textContent = active ? 'ON' : 'OFF';
  badge.className = 'badge ' + (active ? 'on' : 'off');
}

function applyToUI(s) {
  $('active-toggle').checked  = !!s.active;
  $('fx-robot').checked       = !!s.robot.enabled;
  $('fx-echo').checked        = !!s.echo.enabled;
  $('fx-reverb').checked      = !!s.reverb.enabled;
  $('fx-lowpass').checked     = !!s.lowpass.enabled;
  $('fx-highpass').checked    = !!s.highpass.enabled;
  $('fx-distortion').checked  = !!s.distortion.enabled;
  $('fx-love').checked        = !!s.love.enabled;
  updateBadge(s.active);
}

function saveSettings() {
  chrome.storage.local.set({ voicemask_settings: current });
}

chrome.storage.local.get(['voicemask_settings', 'voicemask_custom_hosts'], result => {
  current = result.voicemask_settings || { ...DEFAULTS };
  customHosts = result.voicemask_custom_hosts || [];
  applyToUI(current);
  renderSites();
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

// ── Custom Sites ─────────────────────────────────────────────────────────────

function normalizeHost(raw) {
  raw = raw.trim().toLowerCase();
  try {
    if (!raw.startsWith('http')) raw = 'https://' + raw;
    return new URL(raw).hostname;
  } catch {
    return raw.replace(/^https?:\/\//, '').split('/')[0];
  }
}

function renderSites() {
  const list = $('sites-list');
  list.innerHTML = '';
  if (customHosts.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'sites-empty';
    empty.textContent = 'No custom sites yet.';
    list.appendChild(empty);
    return;
  }
  customHosts.forEach(host => {
    const tag = document.createElement('div');
    tag.className = 'site-tag';
    tag.innerHTML = `<span class="host">${host}</span><span class="remove" data-host="${host}" title="Remove">✕</span>`;
    list.appendChild(tag);
  });
  list.querySelectorAll('.remove').forEach(btn => {
    btn.addEventListener('click', () => removeSite(btn.dataset.host));
  });
}

async function addSite() {
  const input = $('site-input');
  const host = normalizeHost(input.value);
  if (!host || customHosts.includes(host)) { input.value = ''; return; }

  // Request optional host permission for this origin
  const origin = `https://${host}/*`;
  const permWarning = $('perm-warning');
  permWarning.style.display = 'block';

  let granted = false;
  try {
    granted = await chrome.permissions.request({ origins: [origin] });
  } catch (e) {
    console.warn('Permission request failed:', e);
  }

  permWarning.style.display = 'none';

  if (!granted) {
    input.style.borderColor = '#ef4444';
    setTimeout(() => { input.style.borderColor = ''; }, 1500);
    return;
  }

  customHosts = [...customHosts, host];
  chrome.storage.local.set({ voicemask_custom_hosts: customHosts });
  input.value = '';
  renderSites();
}

function removeSite(host) {
  customHosts = customHosts.filter(h => h !== host);
  chrome.storage.local.set({ voicemask_custom_hosts: customHosts });
  // Optionally revoke permission
  chrome.permissions.remove({ origins: [`https://${host}/*`] }).catch(() => {});
  renderSites();
}

$('btn-add-site').addEventListener('click', addSite);
$('site-input').addEventListener('keydown', e => { if (e.key === 'Enter') addSite(); });

// ── Inject into current tab ──────────────────────────────────────────────────

$('btn-inject').addEventListener('click', () => {
  const btn = $('btn-inject');
  btn.textContent = 'INJECTING...';
  chrome.runtime.sendMessage({ type: 'inject-active-tab' }, (response) => {
    if (response && response.ok) {
      btn.textContent = '✓ INJECTED — START YOUR CALL';
      btn.classList.add('success');
    } else {
      btn.textContent = 'FAILED — TRY RELOADING THE TAB';
    }
    setTimeout(() => {
      btn.textContent = '⟳ INJECT INTO CURRENT TAB';
      btn.classList.remove('success');
    }, 3000);
  });
});
