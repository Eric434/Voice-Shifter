(function () {
  'use strict';

  const _origGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

  let settings = null;

  // ── Audio helpers ────────────────────────────────────────────────────────────

  function makeDistortionCurve(amount) {
    const n = 256, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }

  function createImpulse(ctx, decay) {
    const len = Math.floor(ctx.sampleRate * decay);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++)
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  function buildChain(ctx, src, fx) {
    const oscs = [];
    let node = src;

    if (fx.robot && fx.robot.enabled) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = fx.robot.frequency || 50;
      const depth = ctx.createGain();
      depth.gain.value = 0.5;
      osc.connect(depth);
      const amGain = ctx.createGain();
      amGain.gain.value = 0.5;
      depth.connect(amGain.gain);
      node.connect(amGain);
      osc.start();
      oscs.push(osc);
      node = amGain;
    }

    if (fx.echo && fx.echo.enabled) {
      const delay = ctx.createDelay(5.0);
      delay.delayTime.value = fx.echo.delay || 0.3;
      const fb = ctx.createGain();
      fb.gain.value = Math.min(fx.echo.feedback || 0.4, 0.85);
      const mix = ctx.createGain();
      node.connect(mix);
      node.connect(delay);
      delay.connect(fb);
      fb.connect(delay);
      delay.connect(mix);
      node = mix;
    }

    if (fx.reverb && fx.reverb.enabled) {
      const conv = ctx.createConvolver();
      conv.buffer = createImpulse(ctx, fx.reverb.decay || 2);
      const dry = ctx.createGain(); dry.gain.value = 0.7;
      const wet = ctx.createGain(); wet.gain.value = 0.5;
      const mix = ctx.createGain();
      node.connect(dry); node.connect(conv);
      dry.connect(mix); conv.connect(wet); wet.connect(mix);
      node = mix;
    }

    if (fx.lowpass && fx.lowpass.enabled) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = fx.lowpass.frequency || 2000;
      node.connect(f); node = f;
    }

    if (fx.highpass && fx.highpass.enabled) {
      const f = ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = fx.highpass.frequency || 200;
      node.connect(f); node = f;
    }

    if (fx.distortion && fx.distortion.enabled) {
      const ws = ctx.createWaveShaper();
      ws.curve = makeDistortionCurve(fx.distortion.amount || 200);
      ws.oversample = '4x';
      node.connect(ws); node = ws;
    }

    if (fx.love && fx.love.enabled) {
      const warmth = ctx.createBiquadFilter();
      warmth.type = 'lowpass';
      warmth.frequency.value = fx.love.warmth || 3000;
      node.connect(warmth); node = warmth;

      const tg = ctx.createGain();
      tg.gain.value = 1 - (fx.love.depth || 0.5) * 0.5;
      const tosc = ctx.createOscillator();
      tosc.type = 'sine';
      tosc.frequency.value = fx.love.rate || 5;
      const td = ctx.createGain();
      td.gain.value = (fx.love.depth || 0.5) * 0.5;
      tosc.connect(td); td.connect(tg.gain); tosc.start();
      node.connect(tg); node = tg;
      oscs.push(tosc);
    }

    const dest = ctx.createMediaStreamDestination();
    node.connect(dest);
    return { dest, oscs };
  }

  // ── getUserMedia override ────────────────────────────────────────────────────

  navigator.mediaDevices.getUserMedia = async function (constraints) {
    const hasAudio = constraints && constraints.audio;
    const isActive = settings && settings.active;

    if (!hasAudio || !isActive) {
      return _origGetUserMedia(constraints);
    }

    const audioConstraints = {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    };

    if (typeof constraints.audio === 'object') {
      Object.assign(audioConstraints, constraints.audio, {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      });
    }

    const realStream = await _origGetUserMedia({ ...constraints, audio: audioConstraints });

    const ctx = new AudioContext({ latencyHint: 'interactive' });
    if (ctx.state === 'suspended') await ctx.resume();

    const src = ctx.createMediaStreamSource(realStream);
    const { dest } = buildChain(ctx, src, settings);

    console.log('[VoiceMask] Masking active — effects:', Object.keys(settings).filter(k => settings[k] && settings[k].enabled));

    return dest.stream;
  };

  // ── Receive settings from content-script ────────────────────────────────────

  window.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'VOICEMASK_UPDATE') {
      settings = e.data.settings;
    }
  });

  console.log('[VoiceMask] Intercept installed');
})();
