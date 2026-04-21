import JSZip from 'jszip';

const EXTENSION_FILES = [
  'manifest.json',
  'background.js',
  'content-script.js',
  'inject.js',
  'popup.html',
  'popup.js',
];

export async function downloadExtension(): Promise<void> {
  const zip = new JSZip();
  const folder = zip.folder('voicemask-extension')!;

  await Promise.all(
    EXTENSION_FILES.map(async (file) => {
      const res = await fetch(`/extension/${file}`);
      if (!res.ok) throw new Error(`Failed to fetch ${file}: ${res.status}`);
      const text = await res.text();
      folder.file(file, text);
    })
  );

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
