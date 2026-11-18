import { describe, expect, it } from 'vitest';
import { FakeAudioPlayerAdapter, FakeAudioRecorderAdapter } from '@/adapters/fakes/fake-audio.adapter';
import {
  type AudioElementLike,
  type MediaRecorderLike,
  WebAudioPlayerAdapter,
  WebAudioRecorderAdapter,
} from '@/adapters/media/web-audio.adapter';
import type {
  AudioPlaybackState,
  IAudioPlayerGateway,
  IAudioRecorderGateway,
} from '@/gateways/audio.gateway';

interface AudioContractHarness {
  readonly recorder: IAudioRecorderGateway;
  readonly player: IAudioPlayerGateway;
  triggerTrackEnded?(): void;
}

function createFakeWebAudioRecorder(): WebAudioRecorderAdapter {
  const sampleValue = 0.4;
  return new WebAudioRecorderAdapter({
    isTypeSupported: (mime) => mime === 'audio/mp4;codecs=mp4a.40.2',
    mediaDevices: {
      enumerateDevices: async () => [
        {
          deviceId: 'default',
          groupId: 'g1',
          kind: 'audioinput',
          label: 'Built-in Mic',
          toJSON: () => ({}),
        } as MediaDeviceInfo,
      ],
      getUserMedia: async () =>
        ({
          getTracks: () => [{ stop: () => {} } as MediaStreamTrack],
        }) as unknown as MediaStream,
    },
    permissions: {
      query: async () => ({ state: 'granted' }) as PermissionStatus,
    },
    createAudioContext: () => ({
      state: 'running',
      close: async () => {},
      createMediaStreamSource: () => ({ connect: () => {} }),
      createAnalyser: () => ({
        fftSize: 256,
        frequencyBinCount: 128,
        getFloatTimeDomainData: (arr) => {
          arr.fill(sampleValue);
        },
      }),
    }),
    createMediaRecorder: (_stream, opts) => {
      const rec: MediaRecorderLike = {
        mimeType: opts.mimeType,
        state: 'inactive',
        ondataavailable: null,
        onstop: null,
        onerror: null,
        start() {
          (this as { state: string }).state = 'recording';
        },
        stop() {
          (this as { state: string }).state = 'inactive';
          this.ondataavailable?.({ data: new Blob([new Uint8Array([1, 2, 3, 4])], { type: opts.mimeType }) });
          this.onstop?.();
        },
      };
      return rec;
    },
  });
}

function createFakeWebAudioPlayer(): {
  player: WebAudioPlayerAdapter;
  triggerTrackEnded: () => void;
} {
  let triggerEnded = () => {};
  const player = new WebAudioPlayerAdapter({
    createAudioElement: (url) => {
      const listeners = new Map<string, Set<EventListener>>();
      const emit = (type: string) => {
        for (const fn of listeners.get(type) ?? []) {
          fn(new Event(type));
        }
      };
      triggerEnded = () => emit('ended');
      const el: AudioElementLike = {
        src: url,
        currentTime: 0,
        duration: 45,
        playbackRate: 1.0,
        play: async () => {
          emit('play');
          emit('ended');
        },
        pause: () => {
          emit('pause');
        },
        addEventListener: (type, listener) => {
          const set = listeners.get(type) ?? new Set();
          set.add(listener as EventListener);
          listeners.set(type, set);
        },
        removeEventListener: (type, listener) => {
          listeners.get(type)?.delete(listener as EventListener);
        },
      };
      return el;
    },
  });
  return { player, triggerTrackEnded: () => triggerEnded() };
}

function runAudioContractSuite(name: string, createHarness: () => AudioContractHarness) {
  describe(`IAudioRecorderGateway & IAudioPlayerGateway LSP contract: ${name}`, () => {
    it('strips ;codecs=... from activeContentType and checks mic preflight', async () => {
      const { recorder } = createHarness();
      expect(recorder.activeContentType).not.toContain(';');
      expect(recorder.activeContentType).toMatch(/^audio\/(mp4|webm|ogg|wav)$/);

      const preflight = await recorder.checkMicPermissionAndDevices();
      expect(preflight.ok).toBe(true);
      if (preflight.ok) {
        expect(preflight.value.devices.length).toBeGreaterThanOrEqual(1);
        expect(preflight.value.activeContentType).toBe(recorder.activeContentType);
      }
    });

    it('records audio clip with strippedContentType and handles cancel cleanly', async () => {
      const { recorder } = createHarness();
      const levels: number[] = [];

      const loopback = await recorder.runPreflightLoopbackTest(120, (rms) => levels.push(rms));
      expect(loopback.ok).toBe(true);

      const startRes = await recorder.startRecording({
        maxDurationSec: 30,
        onLevel: (rms) => levels.push(rms),
      });
      expect(startRes.ok).toBe(true);
      if (startRes.ok) {
        const stopRes = await startRes.value.stop();
        expect(stopRes.ok).toBe(true);
        if (stopRes.ok) {
          expect(stopRes.value.strippedContentType).toBe(recorder.activeContentType);
          expect(stopRes.value.byteLength).toBeGreaterThan(0);
        }
      }

      const startCancelRes = await recorder.startRecording({
        maxDurationSec: 30,
        onLevel: () => {},
      });
      expect(startCancelRes.ok).toBe(true);
      if (startCancelRes.ok) {
        startCancelRes.value.cancel();
        const stopAfterCancel = await startCancelRes.value.stop();
        expect(stopAfterCancel.ok).toBe(false);
      }
    });

    it('enforces exam_linear_locked playback rules and allows seek/speed/replay in study_interactive', async () => {
      const { player } = createHarness();

      player.setPlaybackMode('exam_linear_locked');
      const examTrackRes = await player.loadSource({
        mediaKey: 'track-exam-1',
        fallbackUrl: 'https://cdn.mockza.test/audio/q1.m4a',
      });
      expect(examTrackRes.ok).toBe(true);
      if (examTrackRes.ok) {
        const track = examTrackRes.value;
        const states: AudioPlaybackState[] = [];
        const unsub = track.subscribe((s) => states.push(s));

        const seekBlocked = track.seek(10);
        expect(seekBlocked.ok).toBe(false);
        if (!seekBlocked.ok) expect(seekBlocked.error.code).toBe('LOCKED_EXAM_PLAYBACK');

        const speedBlocked = track.setSpeed(1.5);
        expect(speedBlocked.ok).toBe(false);
        if (!speedBlocked.ok) expect(speedBlocked.error.code).toBe('LOCKED_EXAM_PLAYBACK');

        // Switching player mode AFTER loadSource must NOT unlock active exam track
        player.setPlaybackMode('study_interactive');
        expect(track.seek(5).ok).toBe(false);

        const firstPlay = await track.play();
        expect(firstPlay.ok).toBe(true);
        expect(states[states.length - 1]?.status).toBe('ended');

        const secondPlay = await track.play();
        expect(secondPlay.ok).toBe(false);
        if (!secondPlay.ok) expect(secondPlay.error.code).toBe('LOCKED_EXAM_PLAYBACK');

        expect(states.some((s) => s.mode === 'exam_linear_locked')).toBe(true);
        unsub();
        track.dispose();
      }

      player.setPlaybackMode('study_interactive');
      const studyTrackRes = await player.loadSource({
        mediaKey: 'track-study-1',
        fallbackUrl: 'https://cdn.mockza.test/audio/q2.m4a',
      });
      expect(studyTrackRes.ok).toBe(true);
      if (studyTrackRes.ok) {
        const track = studyTrackRes.value;
        expect(track.seek(12).ok).toBe(true);
        expect(track.setSpeed(1.25).ok).toBe(true);
        expect((await track.play()).ok).toBe(true);
        expect((await track.play()).ok).toBe(true);
        track.dispose();
      }
    });
  });
}

runAudioContractSuite('FakeAudioRecorderAdapter & FakeAudioPlayerAdapter', () => ({
  recorder: new FakeAudioRecorderAdapter(),
  player: new FakeAudioPlayerAdapter(),
}));

runAudioContractSuite('WebAudioRecorderAdapter & WebAudioPlayerAdapter', () => {
  const recorder = createFakeWebAudioRecorder();
  const { player, triggerTrackEnded } = createFakeWebAudioPlayer();
  return { recorder, player, triggerTrackEnded };
});
