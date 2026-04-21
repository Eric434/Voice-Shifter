import { useState, useRef, useCallback } from 'react';
import { encodeWAV } from '@/lib/audioUtils';

export type EffectName = 'pitchShift' | 'robot' | 'echo' | 'reverb' | 'lowpass' | 'highpass' | 'distortion';

export interface EffectSettings {
  pitchShift: { enabled: boolean; semitones: number };
  robot: { enabled: boolean; frequency: number };
  echo: { enabled: boolean; delay: number; feedback: number };
  reverb: { enabled: boolean; decay: number };
  lowpass: { enabled: boolean; frequency: number };
  highpass: { enabled: boolean; frequency: number };
  distortion: { enabled: boolean; amount: number };
}

export const defaultEffects: EffectSettings = {
  pitchShift: { enabled: false, semitones: 0 },
  robot: { enabled: false, frequency: 30 },
  echo: { enabled: false, delay: 0.3, feedback: 0.4 },
  reverb: { enabled: false, decay: 2.0 },
  lowpass: { enabled: false, frequency: 2000 },
  highpass: { enabled: false, frequency: 500 },
  distortion: { enabled: false, amount: 200 },
};

function makeDistortionCurve(amount: number): Float32Array {
  const n = 256;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

function createImpulseResponse(audioCtx: AudioContext | OfflineAudioContext, decay: number): AudioBuffer {
  const sampleRate = audioCtx.sampleRate;
  const length = sampleRate * decay;
  const impulse = audioCtx.createBuffer(2, length, sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const channelData = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return impulse;
}

export function useAudioProcessor() {
  const [originalBuffer, setOriginalBuffer] = useState<AudioBuffer | null>(null);
  const [processedBuffer, setProcessedBuffer] = useState<AudioBuffer | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [effects, setEffects] = useState<EffectSettings>(defaultEffects);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const originalSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const processedSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const [isPlayingOriginal, setIsPlayingOriginal] = useState(false);
  const [isPlayingProcessed, setIsPlayingProcessed] = useState(false);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new AudioContext();
    }
    return audioContextRef.current;
  }, []);

  const loadAudioFromBlob = useCallback(async (blob: Blob) => {
    const ctx = getAudioContext();
    const arrayBuffer = await blob.arrayBuffer();
    const decoded = await ctx.decodeAudioData(arrayBuffer);
    setOriginalBuffer(decoded);
    setProcessedBuffer(null);
  }, [getAudioContext]);

  const loadAudioFromFile = useCallback(async (file: File) => {
    const ctx = getAudioContext();
    const arrayBuffer = await file.arrayBuffer();
    const decoded = await ctx.decodeAudioData(arrayBuffer);
    setOriginalBuffer(decoded);
    setProcessedBuffer(null);
  }, [getAudioContext]);

  const updateEffect = useCallback(<K extends EffectName>(
    name: K,
    updates: Partial<EffectSettings[K]>
  ) => {
    setEffects(prev => ({
      ...prev,
      [name]: { ...prev[name], ...updates }
    }));
  }, []);

  const processAudio = useCallback(async () => {
    if (!originalBuffer) return;
    setIsProcessing(true);

    try {
      const sampleRate = originalBuffer.sampleRate;
      const playbackRate = effects.pitchShift.enabled
        ? Math.pow(2, effects.pitchShift.semitones / 12)
        : 1;

      const duration = originalBuffer.duration / playbackRate;
      const offlineCtx = new OfflineAudioContext(
        1,
        Math.ceil(sampleRate * duration * 1.5),
        sampleRate
      );

      const source = offlineCtx.createBufferSource();
      source.buffer = originalBuffer;
      source.playbackRate.value = playbackRate;

      let currentNode: AudioNode = source;

      if (effects.robot.enabled) {
        const osc = offlineCtx.createOscillator();
        osc.frequency.value = effects.robot.frequency;
        osc.type = 'sine';
        const gainMod = offlineCtx.createGain();
        gainMod.gain.value = 0.5;
        osc.connect(gainMod);
        const distNode = offlineCtx.createWaveShaper();
        const curve = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
          const x = (i * 2) / 256 - 1;
          curve[i] = Math.abs(x) * (effects.robot.frequency / 50);
        }
        distNode.curve = curve;
        currentNode.connect(distNode);
        osc.start(0);
        currentNode = distNode;
      }

      if (effects.echo.enabled) {
        const delay = offlineCtx.createDelay(5.0);
        delay.delayTime.value = effects.echo.delay;
        const feedback = offlineCtx.createGain();
        feedback.gain.value = effects.echo.feedback;
        const merge = offlineCtx.createGain();
        currentNode.connect(merge);
        currentNode.connect(delay);
        delay.connect(feedback);
        feedback.connect(delay);
        delay.connect(merge);
        currentNode = merge;
      }

      if (effects.reverb.enabled) {
        const convolver = offlineCtx.createConvolver();
        convolver.buffer = createImpulseResponse(offlineCtx, effects.reverb.decay);
        const dryGain = offlineCtx.createGain();
        dryGain.gain.value = 0.7;
        const wetGain = offlineCtx.createGain();
        wetGain.gain.value = 0.5;
        const merge = offlineCtx.createGain();
        currentNode.connect(dryGain);
        currentNode.connect(convolver);
        dryGain.connect(merge);
        convolver.connect(wetGain);
        wetGain.connect(merge);
        currentNode = merge;
      }

      if (effects.lowpass.enabled) {
        const filter = offlineCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = effects.lowpass.frequency;
        filter.Q.value = 1;
        currentNode.connect(filter);
        currentNode = filter;
      }

      if (effects.highpass.enabled) {
        const filter = offlineCtx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = effects.highpass.frequency;
        filter.Q.value = 1;
        currentNode.connect(filter);
        currentNode = filter;
      }

      if (effects.distortion.enabled) {
        const waveShaper = offlineCtx.createWaveShaper();
        waveShaper.curve = makeDistortionCurve(effects.distortion.amount);
        waveShaper.oversample = '4x';
        currentNode.connect(waveShaper);
        currentNode = waveShaper;
      }

      currentNode.connect(offlineCtx.destination);
      source.start(0);

      const rendered = await offlineCtx.startRendering();
      setProcessedBuffer(rendered);
    } finally {
      setIsProcessing(false);
    }
  }, [originalBuffer, effects]);

  const playOriginal = useCallback(() => {
    if (!originalBuffer) return;
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    if (originalSourceRef.current) {
      originalSourceRef.current.stop();
      originalSourceRef.current.disconnect();
    }
    const source = ctx.createBufferSource();
    source.buffer = originalBuffer;
    source.connect(ctx.destination);
    source.onended = () => setIsPlayingOriginal(false);
    source.start();
    originalSourceRef.current = source;
    setIsPlayingOriginal(true);
  }, [originalBuffer, getAudioContext]);

  const stopOriginal = useCallback(() => {
    if (originalSourceRef.current) {
      try { originalSourceRef.current.stop(); } catch {}
      originalSourceRef.current.disconnect();
      originalSourceRef.current = null;
    }
    setIsPlayingOriginal(false);
  }, []);

  const playProcessed = useCallback(() => {
    if (!processedBuffer) return;
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    if (processedSourceRef.current) {
      processedSourceRef.current.stop();
      processedSourceRef.current.disconnect();
    }
    const source = ctx.createBufferSource();
    source.buffer = processedBuffer;
    source.connect(ctx.destination);
    source.onended = () => setIsPlayingProcessed(false);
    source.start();
    processedSourceRef.current = source;
    setIsPlayingProcessed(true);
  }, [processedBuffer, getAudioContext]);

  const stopProcessed = useCallback(() => {
    if (processedSourceRef.current) {
      try { processedSourceRef.current.stop(); } catch {}
      processedSourceRef.current.disconnect();
      processedSourceRef.current = null;
    }
    setIsPlayingProcessed(false);
  }, []);

  const downloadProcessed = useCallback(() => {
    if (!processedBuffer) return;
    const channelData = processedBuffer.getChannelData(0);
    const blob = encodeWAV(channelData, processedBuffer.sampleRate);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'voicemask-output.wav';
    a.click();
    URL.revokeObjectURL(url);
  }, [processedBuffer]);

  return {
    originalBuffer,
    processedBuffer,
    isProcessing,
    effects,
    updateEffect,
    loadAudioFromBlob,
    loadAudioFromFile,
    processAudio,
    playOriginal,
    stopOriginal,
    playProcessed,
    stopProcessed,
    downloadProcessed,
    isPlayingOriginal,
    isPlayingProcessed,
  };
}
