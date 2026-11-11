import { useCallback, useEffect, useState } from 'react';
import { englishVoices, isSpeechSupported, onVoicesChanged, speakSequence, stopSpeaking, type VoiceInfo } from '../services/speech/tts';
import { useAppStore } from '../store/useAppStore';

let activeId: string | null = null;
const subscribers = new Set<(id: string | null) => void>();
function setActive(id: string | null) {
  activeId = id;
  subscribers.forEach((s) => s(id));
}

/** Reproducción de audio TTS con la voz y velocidad de la configuración. */
export function useSpeech() {
  const voiceURI = useAppStore((s) => s.data.settings.voiceURI);
  const secondVoiceURI = useAppStore((s) => s.data.settings.secondVoiceURI);
  const rate = useAppStore((s) => s.data.settings.speechRate);
  const [playing, setPlaying] = useState<string | null>(activeId);
  const [voices, setVoices] = useState<VoiceInfo[]>(() => englishVoices());

  useEffect(() => {
    subscribers.add(setPlaying);
    const off = onVoicesChanged(() => setVoices(englishVoices()));
    setVoices(englishVoices());
    return () => {
      subscribers.delete(setPlaying);
      off();
    };
  }, []);

  const play = useCallback(
    (id: string, content: string | { text: string; speaker?: string }[], opts: { rate?: number } = {}) => {
      if (activeId === id) {
        stopSpeaking();
        setActive(null);
        return;
      }
      const lines = typeof content === 'string' ? [{ text: content }] : content;
      setActive(id);
      speakSequence(lines, {
        rate: opts.rate ?? rate,
        voiceURI,
        secondVoiceURI,
        onEnd: () => {
          if (activeId === id) setActive(null);
        },
      });
    },
    [rate, voiceURI, secondVoiceURI],
  );

  const stop = useCallback(() => {
    stopSpeaking();
    setActive(null);
  }, []);

  return { play, stop, playing, supported: isSpeechSupported(), voices, hasEnglishVoice: voices.length > 0, rate };
}
