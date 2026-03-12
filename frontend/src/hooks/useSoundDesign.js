import { useCallback, useRef } from 'react';

const AudioContextClass = typeof window !== 'undefined'
  ? (window.AudioContext || window.webkitAudioContext)
  : null;

function createEnvelope(ctx, {
  type = 'sine',
  frequency = 440,
  targetFrequency = null,
  when = ctx.currentTime,
  duration = 0.2,
  attack = 0.01,
  release = 0.16,
  peakGain = 0.05,
  destination = ctx.destination,
}) {
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, when);
  if (targetFrequency != null) {
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, targetFrequency), when + duration);
  }

  gainNode.gain.setValueAtTime(0.0001, when);
  gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0001, peakGain), when + attack);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, when + duration + release);

  oscillator.connect(gainNode);
  gainNode.connect(destination);
  oscillator.start(when);
  oscillator.stop(when + duration + release + 0.04);

  return { oscillator, gainNode };
}

export default function useSoundDesign() {
  const contextRef = useRef(null);

  const ensureContext = useCallback(async () => {
    if (!AudioContextClass) {
      return null;
    }

    if (!contextRef.current) {
      contextRef.current = new AudioContextClass();
    }

    if (contextRef.current.state === 'suspended') {
      await contextRef.current.resume();
    }

    return contextRef.current;
  }, []);

  const primeAudio = useCallback(async () => {
    try {
      await ensureContext();
    } catch {
      // Ignore autoplay-related priming issues silently.
    }
  }, [ensureContext]);

  const playDrop = useCallback(async () => {
    try {
      const ctx = await ensureContext();
      if (!ctx) {
        return;
      }

      const now = ctx.currentTime;
      createEnvelope(ctx, {
        type: 'triangle',
        frequency: 150,
        targetFrequency: 40,
        when: now,
        duration: 0.15,
        attack: 0.005,
        release: 0.12,
        peakGain: 0.085,
      });
    } catch {
      // Audio feedback is decorative; fail silently.
    }
  }, [ensureContext]);

  const playSuccess = useCallback(async () => {
    try {
      const ctx = await ensureContext();
      if (!ctx) {
        return;
      }

      const now = ctx.currentTime;
      const master = ctx.createGain();
      const delay = ctx.createDelay();
      const feedback = ctx.createGain();

      master.gain.value = 0.22;
      delay.delayTime.value = 0.18;
      feedback.gain.value = 0.28;

      master.connect(ctx.destination);
      master.connect(delay);
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(ctx.destination);

      [
        { freq: 600, when: now },
        { freq: 760, when: now + 0.08 },
        { freq: 920, when: now + 0.16 },
      ].forEach(({ freq, when }) => {
        createEnvelope(ctx, {
          type: 'sine',
          frequency: freq,
          targetFrequency: freq * 1.02,
          when,
          duration: 0.34,
          attack: 0.01,
          release: 0.42,
          peakGain: 0.05,
          destination: master,
        });
      });

      window.setTimeout(() => {
        master.disconnect();
        delay.disconnect();
        feedback.disconnect();
      }, 1400);
    } catch {
      // Audio feedback is decorative; fail silently.
    }
  }, [ensureContext]);

  const playAIWakeup = useCallback(async () => {
    try {
      const ctx = await ensureContext();
      if (!ctx) {
        return;
      }

      const now = ctx.currentTime;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      filter.Q.value = 0.7;
      filter.connect(ctx.destination);

      createEnvelope(ctx, {
        type: 'sawtooth',
        frequency: 72,
        targetFrequency: 118,
        when: now,
        duration: 0.95,
        attack: 0.22,
        release: 0.24,
        peakGain: 0.03,
        destination: filter,
      });

      window.setTimeout(() => {
        filter.disconnect();
      }, 1500);
    } catch {
      // Audio feedback is decorative; fail silently.
    }
  }, [ensureContext]);

  return {
    primeAudio,
    playDrop,
    playSuccess,
    playAIWakeup,
  };
}
