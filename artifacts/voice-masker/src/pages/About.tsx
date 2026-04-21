import { Activity, Mic, Wand2, Download, Zap } from 'lucide-react';

export default function About() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 max-w-2xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-8">
        <Activity className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-mono font-bold tracking-wider text-foreground">VOICEMASK</h1>
      </div>

      <p className="text-center text-muted-foreground mb-12 text-lg leading-relaxed">
        A browser-based voice effects studio. Record your voice or upload an audio file,
        apply real-time audio processing effects, and download the result — all inside your browser,
        with no data sent to any server.
      </p>

      <div className="grid grid-cols-1 gap-4 w-full mb-12">
        {[
          {
            icon: Mic,
            title: 'Record or Upload',
            desc: 'Capture audio directly from your microphone or drop in any audio file.'
          },
          {
            icon: Wand2,
            title: 'Apply Effects',
            desc: 'Pitch shift, robot voice, echo, reverb, filters, and distortion — powered by the Web Audio API.'
          },
          {
            icon: Zap,
            title: 'Process Instantly',
            desc: 'Effects are rendered using OfflineAudioContext for fast, accurate processing.'
          },
          {
            icon: Download,
            title: 'Download WAV',
            desc: 'Export your processed audio as a standard WAV file ready to use anywhere.'
          },
        ].map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="flex items-start gap-4 p-4 rounded-lg bg-card border border-border"
          >
            <div className="p-2 rounded-md bg-primary/10 text-primary shrink-0">
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-mono font-semibold text-foreground mb-1">{title}</h3>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="text-center text-sm text-muted-foreground">
        <p>Built with Web Audio API, React, and Vite.</p>
        <p className="mt-1">All audio processing happens locally in your browser.</p>
      </div>
    </div>
  );
}
