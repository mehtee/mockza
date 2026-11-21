/**
 * Lightweight browser Web Speech API helper for instant English model playback (`1.0x` / `0.8x`)
 * in Smart Coach screens without server roundtrips.
 */
export function isSpeechPlaybackSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.speechSynthesis !== 'undefined' &&
    typeof SpeechSynthesisUtterance !== 'undefined'
  );
}

export function stopEnglishSpeech(): void {
  if (typeof window === 'undefined' || typeof window.speechSynthesis === 'undefined') return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // Ignore host browsers with restricted speech synthesis state.
  }
}

export function speakEnglishPhrase(
  text: string,
  options: {
    readonly rate?: 0.8 | 1.0;
    readonly onStart?: () => void;
    readonly onEnd?: () => void;
    readonly onError?: () => void;
  } = {},
): boolean {
  const clean = text.trim();
  if (!clean || !isSpeechPlaybackSupported()) {
    options.onError?.();
    return false;
  }

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = 'en-US';
    utterance.rate = options.rate ?? 1.0;

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice =
      voices.find((v) => v.lang.toLowerCase().startsWith('en-us') && v.localService) ??
      voices.find((v) => v.lang.toLowerCase().startsWith('en-gb') && v.localService) ??
      voices.find((v) => v.lang.toLowerCase().startsWith('en'));
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onstart = () => options.onStart?.();
    utterance.onend = () => options.onEnd?.();
    utterance.onerror = () => options.onError?.();

    options.onStart?.();
    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    options.onError?.();
    return false;
  }
}
