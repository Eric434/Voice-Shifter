import { useState, useRef, useCallback } from 'react';
import type { EffectSettings } from './useAudioProcessor';

function makeDistortionCurve(amount: number): Float32Array {
  const n = 256;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

function createImpulseResponse(ctx: AudioContext, decay: number): AudioBuffer {
  const length = ctx.sampleRate * decay;
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return impulse;
}

export type LiveStatus = 'idle' | 'starting' | 'live' | 'error';

export function useLiveProcessor() {
  const [status, setStatus] = useState<LiveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [monitorEnabled, setMonitorEnabled] = useState(true);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const oscillatorsRef = useRef<OscillatorNode[]>([]);
  const monitorGainRef = useRef<GainNode | null>(null);
  const destRef = useRef<MediaStreamAudioDestinationNode | null>(null);

  const stopLive = useCallback(() => {
    oscillatorsRef.current.forEach(osc => { try { osc.stop(); } catch {} });
    oscillatorsRef.current = [];
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    monitorGainRef.current = null;
    destRef.current = null;
    setStatus('idle');
    setError(null);
  }, []);

  const startLive = useCallback(async (effects: EffectSettings) => {
    stopLive();
    setStatus('starting');
    setError(null);

    try {
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        video: false,
      });
      streamRef.current = micStream;

      const ctx = new AudioContext({ latencyHint: 'interactive' });
      audioCtxRef.current = ctx;
      if (ctx.state === 'suspended') await ctx.resume();

      const micSource = ctx.createMediaStreamSource(micStream);
      let currentNode: AudioNode = micSource;

      // Robot: amplitude modulation (ring-mod style)
      if (effects.robot.enabled) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = effects.robot.frequency;
        const depth = ctx.createGain();
        depth.gain.value = 0.5;
        osc.connect(depth);

        const amGain = ctx.createGain();
        amGain.gain.value = 0.5;
        depth.connect(amGain.gain);

        currentNode.connect(amGain);
        osc.start();
        oscillatorsRef.current.push(osc);
        currentNode = amGain;
      }

      // Echo
      if (effects.echo.enabled) {
        const delay = ctx.createDelay(5.0);
        delay.delayTime.value = effects.echo.delay;
        const feedbackGain = ctx.createGain();
        feedbackGain.gain.value = Math.min(effects.echo.feedback, 0.85);
        const mixGain = ctx.createGain();

        currentNode.connect(mixGain);
        currentNode.connect(delay);
        delay.connect(feedbackGain);
        feedbackGain.connect(delay);
        delay.connect(mixGain);
        currentNode = mixGain;
      }

      // Reverb
      if (effects.reverb.enabled) {
        const convolver = ctx.createConvolver();
        convolver.buffer = createImpulseResponse(ctx, effects.reverb.decay);
        const dry = ctx.createGain();
        dry.gain.value = 0.7;
        const wet = ctx.createGain();
        wet.gain.value = 0.5;
        const mix = ctx.createGain();
        currentNode.connect(dry);
        currentNode.connect(convolver);
        dry.connect(mix);
        convolver.connect(wet);
        wet.connect(mix);
        currentNode = mix;
      }

      // Low pass
      if (effects.lowpass.enabled) {
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = effects.lowpass.frequency;
        filter.Q.value = 1;
        currentNode.connect(filter);
        currentNode = filter;
      }

      // High pass
      if (effects.highpass.enabled) {
        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = effects.highpass.frequency;
        filter.Q.value = 1;
        currentNode.connect(filter);
        currentNode = filter;
      }

      // Distortion
      if (effects.distortion.enabled) {
        const ws = ctx.createWaveShaper();
        ws.curve = makeDistortionCurve(effects.distortion.amount);
        ws.oversample = '4x';
        currentNode.connect(ws);
        currentNode = ws;
      }

      // Love: warmth + tremolo + shimmer
      if (effects.love.enabled) {
        const warmth = ctx.createBiquadFilter();
        warmth.type = 'lowpass';
        warmth.frequency.value = effects.love.warmth;
        warmth.Q.value = 0.5;
        currentNode.connect(warmth);
        currentNode = warmth;

        const tremoloGain = ctx.createGain();
        tremoloGain.gain.value = 1 - effects.love.depth * 0.5;
        const tremoloOsc = ctx.createOscillator();
        tremoloOsc.type = 'sine';
        tremoloOsc.frequency.value = effects.love.rate;
        const tremoloDepth = ctx.createGain();
        tremoloDepth.gain.value = effects.love.depth * 0.5;
        tremoloOsc.connect(tremoloDepth);
        tremoloDepth.connect(tremoloGain.gain);
        tremoloOsc.start();
        oscillatorsRef.current.push(tremoloOsc);
        currentNode.connect(tremoloGain);
        currentNode = tremoloGain;
      }

      // Output: monitor gain (controls whether user hears themselves)
      const monitorGain = ctx.createGain();
      monitorGain.gain.value = monitorEnabled ? 1 : 0;
      currentNode.connect(monitorGain);
      monitorGain.connect(ctx.destination);
      monitorGainRef.current = monitorGain;

      // MediaStream destination — processed audio as a capturable stream
      const dest = ctx.createMediaStreamDestination();
      currentNode.connect(dest);
      destRef.current = dest;

      setStatus('live');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(
        msg.includes('Permission') || msg.includes('NotAllowed')
          ? 'Microphone permission denied.'
          : msg.includes('NotFound')
          ? 'No microphone found.'
          : `Could not start live mode: ${msg}`
      );
      setStatus('error');
      stopLive();
    }
  }, [monitorEnabled, stopLive]);

  const toggleMonitor = useCallback(() => {
    setMonitorEnabled(prev => {
      const next = !prev;
      if (monitorGainRef.current) {
        monitorGainRef.current.gain.setTargetAtTime(next ? 1 : 0, monitorGainRef.current.context.currentTime, 0.01);
      }
      return next;
    });
  }, []);

  const getProcessedStream = useCallback((): MediaStream | null => {
    return destRef.current?.stream ?? null;
  }, []);

  return {
    status,
    error,
    monitorEnabled,
    startLive,
    stopLive,
    toggleMonitor,
    getProcessedStream,
  };
}
