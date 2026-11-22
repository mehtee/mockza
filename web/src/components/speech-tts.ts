import type { ISpeechPracticeGateway } from '@/gateways/speech-practice.gateway';

const TTS_ACCENT_STORAGE_KEY = 'mockza.ttsAccent';

function readStoredTtsAccent(): 'us' | 'uk' {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(TTS_ACCENT_STORAGE_KEY) === 'uk' ? 'uk' : 'us';
    }
  } catch {
    // Ignore storage access restrictions
  }
  return 'us';
}

let activeGateway: ISpeechPracticeGateway | null = null;
let activeAudioEl: HTMLAudioElement | null = null;
let activeOwnerId: string | null = null;
let defaultTtsAccent: 'us' | 'uk' = readStoredTtsAccent();

export function setGlobalDefaultTtsAccent(accent: 'us' | 'uk'): void {
  defaultTtsAccent = accent === 'uk' ? 'uk' : 'us';
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(TTS_ACCENT_STORAGE_KEY, defaultTtsAccent);
    }
  } catch {
    // Ignore storage access restrictions
  }
}

export function getGlobalDefaultTtsAccent(): 'us' | 'uk' {
  return defaultTtsAccent;
}

export function getGlobalDefaultTtsVoice(): 'af_bella' | 'bf_emma' {
  return defaultTtsAccent === 'uk' ? 'bf_emma' : 'af_bella';
}

/**
 * Binds the OpenRouter Kokoro-82m API SpeechPractice gateway during app bootstrap.
 * Browser Web Speech API (`window.speechSynthesis`) is NEVER used anywhere.
 */
export function bindGlobalSpeechGateway(gateway: ISpeechPracticeGateway): void {
  activeGateway = gateway;
}

export function isSpeechPlaybackSupported(): boolean {
  return typeof Audio !== 'undefined' && activeGateway !== null;
}

export function stopEnglishSpeech(): void {
  if (activeAudioEl) {
    try {
      activeAudioEl.pause();
      activeAudioEl.currentTime = 0;
    } catch {
      // Ignore cleanup errors
    }
    activeAudioEl = null;
  }
  activeOwnerId = null;
}

export function stopEnglishSpeechIfOwner(ownerId: string): void {
  if (activeOwnerId && activeOwnerId === ownerId) {
    stopEnglishSpeech();
  }
}

export function speakEnglishPhrase(
  text: string,
  options: {
    readonly ownerId?: string;
    readonly rate?: 0.8 | 1.0 | 1.15;
    readonly voice?: string;
    readonly sourceContext?:
      | 'vocab'
      | 'reading'
      | 'listening_feedback'
      | 'speaking_feedback'
      | 'writing_feedback'
      | 'coach'
      | 'pronunciation';
    readonly gateway?: ISpeechPracticeGateway | null;
    readonly onStart?: () => void;
    readonly onEnd?: () => void;
    readonly onError?: () => void;
  } = {},
): boolean {
  const clean = text.trim();
  const gw = options.gateway ?? activeGateway;
  if (!clean || !gw || typeof Audio === 'undefined') {
    options.onError?.();
    return false;
  }

  stopEnglishSpeech();
  const owner = options.ownerId ?? `tts-${Date.now()}`;
  activeOwnerId = owner;
  options.onStart?.();

  void gw
    .synthesizeTts({
      text: clean,
      voice: options.voice ?? getGlobalDefaultTtsVoice(),
      speed: options.rate ?? 1.0,
      sourceContext: options.sourceContext ?? 'coach',
    })
    .then((res) => {
      if (!res.ok) {
        if (activeOwnerId === owner) activeOwnerId = null;
        options.onError?.();
        return;
      }
      // If another caller superseded this owner before async TTS returned, abort quietly
      if (activeOwnerId !== owner) {
        return;
      }
      const audio = new Audio(res.value.audioUrl);
      activeAudioEl = audio;
      audio.onended = () => {
        if (activeAudioEl === audio) {
          activeAudioEl = null;
          activeOwnerId = null;
        }
        options.onEnd?.();
      };
      audio.onerror = () => {
        if (activeAudioEl === audio) {
          activeAudioEl = null;
          activeOwnerId = null;
        }
        options.onError?.();
      };
      void audio.play().catch(() => {
        if (activeAudioEl === audio) {
          activeAudioEl = null;
          activeOwnerId = null;
        }
        options.onError?.();
      });
    })
    .catch(() => {
      if (activeOwnerId === owner) activeOwnerId = null;
      options.onError?.();
    });

  return true;
}
