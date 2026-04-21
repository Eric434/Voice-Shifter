import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, Square, Upload, Play, Pause, Download, Zap, RotateCcw, ChevronDown, ChevronUp, BookmarkPlus, Trash2, Check } from 'lucide-react';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useAudioProcessor } from '@/hooks/useAudioProcessor';
import { usePresets } from '@/hooks/usePresets';
import { drawWaveform } from '@/lib/audioUtils';
import { cn } from '@/lib/utils';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

interface EffectCardProps {
  title: string;
  enabled: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function EffectCard({ title, enabled, onToggle, children }: EffectCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        'rounded-lg border transition-all duration-200',
        enabled
          ? 'border-primary/60 bg-primary/5 shadow-[0_0_12px_rgba(0,255,255,0.08)]'
          : 'border-border bg-card'
      )}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          data-testid={`toggle-${title.toLowerCase().replace(/\s+/g, '-')}`}
          onClick={onToggle}
          className={cn(
            'w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all',
            enabled
              ? 'bg-primary border-primary'
              : 'bg-transparent border-muted-foreground/40'
          )}
          aria-label={`${enabled ? 'Disable' : 'Enable'} ${title}`}
        >
          {enabled && (
            <svg viewBox="0 0 10 10" className="w-3 h-3 text-background fill-current">
              <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            </svg>
          )}
        </button>
        <span className={cn('font-mono text-sm font-semibold flex-1', enabled ? 'text-primary' : 'text-muted-foreground')}>
          {title}
        </span>
        <button
          onClick={() => setExpanded(v => !v)}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-border/50">
          {children}
        </div>
      )}
    </div>
  );
}

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
  testId?: string;
}

function SliderRow({ label, value, min, max, step = 1, unit = '', onChange, testId }: SliderRowProps) {
  return (
    <div className="mt-3">
      <div className="flex justify-between text-xs font-mono mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-primary">{typeof value === 'number' && !Number.isInteger(value) ? value.toFixed(2) : value}{unit}</span>
      </div>
      <input
        data-testid={testId}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none bg-muted cursor-pointer accent-primary"
      />
    </div>
  );
}

interface WaveformCanvasProps {
  buffer: AudioBuffer | null;
  label: string;
  color?: string;
}

function WaveformCanvas({ buffer, label, color = '#00e5ff' }: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && buffer) {
      drawWaveform(canvasRef.current, buffer, color);
    }
  }, [buffer, color]);

  return (
    <div className="rounded-lg bg-muted/30 border border-border p-3">
      <p className="text-xs font-mono text-muted-foreground mb-2">{label}</p>
      {buffer ? (
        <canvas
          ref={canvasRef}
          width={600}
          height={60}
          className="w-full h-[60px] rounded"
        />
      ) : (
        <div className="w-full h-[60px] flex items-center justify-center">
          <div className="w-full h-px bg-muted-foreground/20" />
        </div>
      )}
    </div>
  );
}

export default function Studio() {
  const recorder = useAudioRecorder();
  const processor = useAudioProcessor();
  const { presets, savePreset, deletePreset } = usePresets();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [hasAudio, setHasAudio] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);
  const [loadedPresetId, setLoadedPresetId] = useState<string | null>(null);

  const handleRecordStop = useCallback(async () => {
    recorder.stopRecording();
  }, [recorder]);

  useEffect(() => {
    if (recorder.recordedBlob) {
      processor.loadAudioFromBlob(recorder.recordedBlob).then(() => setHasAudio(true));
    }
  }, [recorder.recordedBlob]);

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith('audio/')) return;
    await processor.loadAudioFromFile(file);
    setHasAudio(true);
  }, [processor]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const reset = useCallback(() => {
    recorder.clearRecording();
    setHasAudio(false);
  }, [recorder]);

  const handleSavePreset = useCallback(() => {
    if (!presetName.trim()) return;
    savePreset(presetName, processor.effects);
    setPresetName('');
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
    setLoadedPresetId(null);
  }, [presetName, processor.effects, savePreset]);

  const handleLoadPreset = useCallback((id: string) => {
    const preset = presets.find(p => p.id === id);
    if (!preset) return;
    const { effects } = preset;
    (Object.keys(effects) as Array<keyof typeof effects>).forEach(key => {
      processor.updateEffect(key, effects[key] as never);
    });
    setLoadedPresetId(id);
  }, [presets, processor]);

  const { effects, updateEffect } = processor;

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-0 overflow-hidden">
      {/* Left Panel — Input & Waveforms */}
      <div className="lg:w-[420px] shrink-0 flex flex-col gap-4 p-5 border-r border-border overflow-y-auto">
        <h2 className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-widest">Audio Input</h2>

        {/* Record / Upload */}
        <div className="flex gap-2">
          {!recorder.isRecording ? (
            <button
              data-testid="button-start-recording"
              onClick={recorder.startRecording}
              disabled={hasAudio}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-mono text-sm font-semibold transition-all',
                hasAudio
                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                  : 'bg-destructive/20 border border-destructive/50 text-destructive hover:bg-destructive/30'
              )}
            >
              <Mic className="w-4 h-4" />
              RECORD
            </button>
          ) : (
            <button
              data-testid="button-stop-recording"
              onClick={handleRecordStop}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-mono text-sm font-semibold bg-destructive/30 border border-destructive text-destructive animate-pulse"
            >
              <Square className="w-4 h-4" />
              STOP · {formatTime(recorder.recordingTime)}
            </button>
          )}
          <button
            data-testid="button-upload-file"
            onClick={() => fileInputRef.current?.click()}
            disabled={recorder.isRecording}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-mono text-sm font-semibold transition-all border',
              recorder.isRecording
                ? 'bg-muted text-muted-foreground cursor-not-allowed border-border'
                : 'bg-secondary/30 border-border text-foreground hover:bg-secondary/50'
            )}
          >
            <Upload className="w-4 h-4" />
            UPLOAD
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={handleFileInput}
            data-testid="input-file-upload"
          />
        </div>

        {/* Drop Zone */}
        {!hasAudio && !recorder.isRecording && (
          <div
            data-testid="dropzone-audio"
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={cn(
              'rounded-lg border-2 border-dashed flex flex-col items-center justify-center py-8 text-center transition-all cursor-pointer',
              dragOver ? 'border-primary bg-primary/5' : 'border-border/50 text-muted-foreground hover:border-border'
            )}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className={cn('w-8 h-8 mb-2', dragOver ? 'text-primary' : 'text-muted-foreground/40')} />
            <p className="text-xs font-mono">Drop audio file here</p>
            <p className="text-xs text-muted-foreground/60 mt-1">WAV · MP3 · OGG · M4A</p>
          </div>
        )}

        {/* Reset */}
        {hasAudio && (
          <button
            data-testid="button-reset"
            onClick={reset}
            className="flex items-center justify-center gap-2 py-2 rounded-lg font-mono text-xs text-muted-foreground hover:text-foreground border border-border/50 hover:border-border transition-all"
          >
            <RotateCcw className="w-3 h-3" />
            Clear & Start Over
          </button>
        )}

        {/* Waveforms */}
        <WaveformCanvas buffer={processor.originalBuffer} label="ORIGINAL" color="#00e5ff" />
        <WaveformCanvas buffer={processor.processedBuffer} label="PROCESSED" color="#a78bfa" />

        {/* Playback Controls */}
        <div className="grid grid-cols-2 gap-2">
          <button
            data-testid="button-play-original"
            onClick={processor.isPlayingOriginal ? processor.stopOriginal : processor.playOriginal}
            disabled={!processor.originalBuffer}
            className={cn(
              'flex items-center justify-center gap-2 py-2.5 rounded-lg font-mono text-xs font-semibold transition-all border',
              processor.originalBuffer
                ? 'border-primary/40 text-primary hover:bg-primary/10'
                : 'border-border text-muted-foreground cursor-not-allowed'
            )}
          >
            {processor.isPlayingOriginal ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            ORIGINAL
          </button>
          <button
            data-testid="button-play-processed"
            onClick={processor.isPlayingProcessed ? processor.stopProcessed : processor.playProcessed}
            disabled={!processor.processedBuffer}
            className={cn(
              'flex items-center justify-center gap-2 py-2.5 rounded-lg font-mono text-xs font-semibold transition-all border',
              processor.processedBuffer
                ? 'border-accent/40 text-accent hover:bg-accent/10'
                : 'border-border text-muted-foreground cursor-not-allowed'
            )}
          >
            {processor.isPlayingProcessed ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            PROCESSED
          </button>
        </div>

        {/* Process + Download */}
        <div className="flex flex-col gap-2 mt-auto pt-2">
          <button
            data-testid="button-process-audio"
            onClick={processor.processAudio}
            disabled={!processor.originalBuffer || processor.isProcessing}
            className={cn(
              'flex items-center justify-center gap-2 py-3 rounded-lg font-mono text-sm font-bold transition-all',
              processor.originalBuffer && !processor.isProcessing
                ? 'bg-primary text-background hover:opacity-90 shadow-[0_0_20px_rgba(0,229,255,0.3)]'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            )}
          >
            <Zap className="w-4 h-4" />
            {processor.isProcessing ? 'PROCESSING...' : 'PROCESS AUDIO'}
          </button>
          <button
            data-testid="button-download"
            onClick={processor.downloadProcessed}
            disabled={!processor.processedBuffer}
            className={cn(
              'flex items-center justify-center gap-2 py-3 rounded-lg font-mono text-sm font-semibold transition-all border',
              processor.processedBuffer
                ? 'border-accent/40 bg-accent/10 text-accent hover:bg-accent/20'
                : 'border-border text-muted-foreground cursor-not-allowed'
            )}
          >
            <Download className="w-4 h-4" />
            DOWNLOAD WAV
          </button>
        </div>
      </div>

      {/* Right Panel — Effects */}
      <div className="flex-1 flex flex-col p-5 overflow-y-auto">
        {/* Presets Section */}
        <div className="mb-5">
          <h2 className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-widest mb-3">Presets</h2>

          {/* Save Preset Row */}
          <div className="flex gap-2 mb-3">
            <input
              data-testid="input-preset-name"
              type="text"
              placeholder="Name this preset..."
              value={presetName}
              onChange={e => setPresetName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSavePreset()}
              className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/60 transition-colors"
            />
            <button
              data-testid="button-save-preset"
              onClick={handleSavePreset}
              disabled={!presetName.trim()}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-xs font-semibold transition-all shrink-0',
                savedFlash
                  ? 'bg-green-500/20 border border-green-500/50 text-green-400'
                  : presetName.trim()
                    ? 'bg-primary/10 border border-primary/40 text-primary hover:bg-primary/20'
                    : 'bg-muted border border-border text-muted-foreground cursor-not-allowed'
              )}
            >
              {savedFlash ? <Check className="w-3.5 h-3.5" /> : <BookmarkPlus className="w-3.5 h-3.5" />}
              {savedFlash ? 'SAVED' : 'SAVE'}
            </button>
          </div>

          {/* Preset List */}
          {presets.length === 0 ? (
            <p className="text-xs font-mono text-muted-foreground/40 italic text-center py-3 border border-dashed border-border/40 rounded-lg">
              No presets yet — configure effects and save
            </p>
          ) : (
            <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
              {presets.map(preset => (
                <div
                  key={preset.id}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg border transition-all group',
                    loadedPresetId === preset.id
                      ? 'border-primary/50 bg-primary/10'
                      : 'border-border bg-card hover:border-border/80'
                  )}
                >
                  <span className={cn(
                    'flex-1 text-xs font-mono truncate',
                    loadedPresetId === preset.id ? 'text-primary' : 'text-foreground'
                  )}>
                    {preset.name}
                  </span>
                  <span className="text-xs font-mono text-muted-foreground/40 shrink-0">
                    {Object.values(preset.effects).filter(e => e.enabled).length} active
                  </span>
                  <button
                    data-testid={`button-load-preset-${preset.id}`}
                    onClick={() => handleLoadPreset(preset.id)}
                    className={cn(
                      'text-xs font-mono font-semibold px-2 py-0.5 rounded transition-all',
                      loadedPresetId === preset.id
                        ? 'text-primary'
                        : 'text-muted-foreground hover:text-primary'
                    )}
                  >
                    {loadedPresetId === preset.id ? 'LOADED' : 'LOAD'}
                  </button>
                  <button
                    data-testid={`button-delete-preset-${preset.id}`}
                    onClick={() => {
                      deletePreset(preset.id);
                      if (loadedPresetId === preset.id) setLoadedPresetId(null);
                    }}
                    className="text-muted-foreground/30 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                    aria-label="Delete preset"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <h2 className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-widest mb-4">Effects Chain</h2>

        <div className="flex flex-col gap-3">
          {/* Pitch Shift */}
          <EffectCard
            title="PITCH SHIFT"
            enabled={effects.pitchShift.enabled}
            onToggle={() => updateEffect('pitchShift', { enabled: !effects.pitchShift.enabled })}
          >
            <p className="text-xs text-muted-foreground mb-1">Adjusts pitch by changing playback rate. Also affects duration.</p>
            <SliderRow
              label="Semitones"
              value={effects.pitchShift.semitones}
              min={-12}
              max={12}
              step={1}
              onChange={v => updateEffect('pitchShift', { semitones: v })}
              testId="slider-pitch-semitones"
            />
          </EffectCard>

          {/* Robot */}
          <EffectCard
            title="ROBOT VOICE"
            enabled={effects.robot.enabled}
            onToggle={() => updateEffect('robot', { enabled: !effects.robot.enabled })}
          >
            <p className="text-xs text-muted-foreground mb-1">Applies a ring-modulation-style effect using a wave shaper.</p>
            <SliderRow
              label="Carrier Frequency"
              value={effects.robot.frequency}
              min={10}
              max={100}
              step={1}
              unit="Hz"
              onChange={v => updateEffect('robot', { frequency: v })}
              testId="slider-robot-frequency"
            />
          </EffectCard>

          {/* Echo */}
          <EffectCard
            title="ECHO"
            enabled={effects.echo.enabled}
            onToggle={() => updateEffect('echo', { enabled: !effects.echo.enabled })}
          >
            <SliderRow
              label="Delay Time"
              value={effects.echo.delay}
              min={0.05}
              max={1.0}
              step={0.01}
              unit="s"
              onChange={v => updateEffect('echo', { delay: v })}
              testId="slider-echo-delay"
            />
            <SliderRow
              label="Feedback"
              value={effects.echo.feedback}
              min={0}
              max={0.85}
              step={0.01}
              onChange={v => updateEffect('echo', { feedback: v })}
              testId="slider-echo-feedback"
            />
          </EffectCard>

          {/* Reverb */}
          <EffectCard
            title="REVERB"
            enabled={effects.reverb.enabled}
            onToggle={() => updateEffect('reverb', { enabled: !effects.reverb.enabled })}
          >
            <p className="text-xs text-muted-foreground mb-1">Convolution reverb using a synthetically generated impulse response.</p>
            <SliderRow
              label="Decay"
              value={effects.reverb.decay}
              min={0.2}
              max={5.0}
              step={0.1}
              unit="s"
              onChange={v => updateEffect('reverb', { decay: v })}
              testId="slider-reverb-decay"
            />
          </EffectCard>

          {/* Low Pass */}
          <EffectCard
            title="LOW PASS FILTER"
            enabled={effects.lowpass.enabled}
            onToggle={() => updateEffect('lowpass', { enabled: !effects.lowpass.enabled })}
          >
            <p className="text-xs text-muted-foreground mb-1">Removes frequencies above the cutoff — creates a muffled, warm sound.</p>
            <SliderRow
              label="Cutoff Frequency"
              value={effects.lowpass.frequency}
              min={200}
              max={8000}
              step={50}
              unit="Hz"
              onChange={v => updateEffect('lowpass', { frequency: v })}
              testId="slider-lowpass-frequency"
            />
          </EffectCard>

          {/* High Pass */}
          <EffectCard
            title="HIGH PASS FILTER"
            enabled={effects.highpass.enabled}
            onToggle={() => updateEffect('highpass', { enabled: !effects.highpass.enabled })}
          >
            <p className="text-xs text-muted-foreground mb-1">Removes frequencies below the cutoff — creates a thin, telephone-like sound.</p>
            <SliderRow
              label="Cutoff Frequency"
              value={effects.highpass.frequency}
              min={100}
              max={4000}
              step={50}
              unit="Hz"
              onChange={v => updateEffect('highpass', { frequency: v })}
              testId="slider-highpass-frequency"
            />
          </EffectCard>

          {/* Distortion */}
          <EffectCard
            title="DISTORTION"
            enabled={effects.distortion.enabled}
            onToggle={() => updateEffect('distortion', { enabled: !effects.distortion.enabled })}
          >
            <p className="text-xs text-muted-foreground mb-1">Wave shaper distortion using a sigmoid curve.</p>
            <SliderRow
              label="Amount"
              value={effects.distortion.amount}
              min={0}
              max={800}
              step={10}
              onChange={v => updateEffect('distortion', { amount: v })}
              testId="slider-distortion-amount"
            />
          </EffectCard>

          {/* Love */}
          <EffectCard
            title="LOVE VOICE"
            enabled={effects.love.enabled}
            onToggle={() => updateEffect('love', { enabled: !effects.love.enabled })}
          >
            <p className="text-xs text-muted-foreground mb-1">
              Warm tremolo with soft shimmer — a gentle, dreamy pulsing glow on the voice.
            </p>
            <SliderRow
              label="Tremolo Rate"
              value={effects.love.rate}
              min={1}
              max={12}
              step={0.5}
              unit="Hz"
              onChange={v => updateEffect('love', { rate: v })}
              testId="slider-love-rate"
            />
            <SliderRow
              label="Depth"
              value={effects.love.depth}
              min={0.05}
              max={0.9}
              step={0.05}
              onChange={v => updateEffect('love', { depth: v })}
              testId="slider-love-depth"
            />
            <SliderRow
              label="Warmth (cutoff)"
              value={effects.love.warmth}
              min={1000}
              max={8000}
              step={100}
              unit="Hz"
              onChange={v => updateEffect('love', { warmth: v })}
              testId="slider-love-warmth"
            />
          </EffectCard>
        </div>

        <p className="text-xs font-mono text-muted-foreground/50 mt-6 text-center">
          Click effect headers to expand controls · Toggle checkbox to enable
        </p>
      </div>
    </div>
  );
}
