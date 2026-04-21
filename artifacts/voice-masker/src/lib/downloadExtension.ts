import JSZip from 'jszip';
import type { Preset } from '@/hooks/usePresets';

const EXTENSION_FILES = [
  'manifest.json',
  'background.js',
  'content-script.js',
  'inject.js',
  'popup.html',
  'popup.js',
];

function buildCustomPresetsHtml(presets: Preset[]): string {
  if (presets.length === 0) return '';
  return presets
    .map(
      (p, i) => `<label class="effect-row">
  <input type="checkbox" id="custom-preset-${i}" class="custom-preset-cb">
  <span class="cb"></span>
  <span class="effect-name">${p.name.toUpperCase()}</span>
  <span class="effect-note">custom</span>
</label>`
    )
    .join('\n');
}

function buildCustomPresetsData(presets: Preset[]): string {
  const data = presets.map(p => ({
    name: p.name,
    effects: {
      robot: p.effects.robot,
      echo: p.effects.echo,
      reverb: p.effects.reverb,
      lowpass: p.effects.lowpass,
      highpass: p.effects.highpass,
      distortion: p.effects.distortion,
      love: p.effects.love,
    },
  }));
  return JSON.stringify(data);
}

export async function downloadExtension(exportedPresets: Preset[] = []): Promise<void> {
  const zip = new JSZip();
  const folder = zip.folder('voicemask-extension')!;

  const fileContents = await Promise.all(
    EXTENSION_FILES.map(async (file) => {
      const res = await fetch(`/extension/${file}`);
      if (!res.ok) throw new Error(`Failed to fetch ${file}: ${res.status}`);
      const text = await res.text();
      return { file, text };
    })
  );

  const customPresetsHtml = buildCustomPresetsHtml(exportedPresets);
  const customPresetsData = buildCustomPresetsData(exportedPresets);

  for (const { file, text } of fileContents) {
    let content = text;
    if (file === 'popup.html') {
      const section = exportedPresets.length > 0
        ? `<div class="divider"></div>\n<div class="section-label">Custom Presets</div>\n${customPresetsHtml}\n`
        : '';
      content = content.replace('<!-- CUSTOM_PRESETS_HTML -->', section);
    }
    if (file === 'popup.js') {
      content = content.replace('/* CUSTOM_PRESETS_DATA */', customPresetsData);
    }
    folder.file(file, content);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'voicemask-extension.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
