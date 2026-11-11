import { useEffect, useRef, useState } from 'react';
import { Minus, Pause, Play, Plus, RotateCcw } from 'lucide-react';
import { useSpeech } from '../../hooks/useSpeech';
import { useAppStore } from '../../store/useAppStore';
import { cn } from '../../utils/cn';

export interface AudioLine {
  text: string;
  speaker?: string;
}

/** Reproductor TTS (o grabación real si existe audioUrl) con velocidad y selector de voz. */
export function AudioPlayer({ id, lines, audioUrl, audioCredit, showVoices = true }: { id: string; lines: AudioLine[]; audioUrl?: string; audioCredit?: string; showVoices?: boolean }) {
  const { play, stop, playing, supported, voices } = useSpeech();
  const settings = useAppStore((s) => s.data.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const [rate, setRate] = useState(settings.speechRate);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [fileFailed, setFileFailed] = useState(false);
  const active = playing === id;
  const useFile = Boolean(audioUrl) && !fileFailed;

  useEffect(() => () => stop(), [stop]);
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, [rate]);

  const speakers = Array.from(new Set(lines.map((l) => l.speaker).filter(Boolean)));
  const changeRate = (d: number) => setRate((r) => Math.min(1.3, Math.max(0.5, Math.round((r + d) * 10) / 10)));

  return (
    <div className="rounded-3xl bg-surface-3/70 p-3">
      <div className="flex items-center gap-3 rounded-2xl bg-surface px-3 py-2.5 shadow-sm">
        {useFile ? (
          <audio ref={audioRef} src={audioUrl} controls className="h-9 flex-1" onError={() => setFileFailed(true)} />
        ) : (
          <>
            <button
              type="button"
              disabled={!supported}
              onClick={() => play(id, lines, { rate })}
              aria-label={active ? 'Detener' : 'Reproducir'}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-on-ink disabled:opacity-40"
            >
              {active ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
            </button>
            <button type="button" disabled={!supported} onClick={() => { stop(); play(id, lines, { rate }); }} aria-label="Repetir desde el principio" className="rounded-full p-2 text-ink-soft hover:bg-surface-2 disabled:opacity-40">
              <RotateCcw size={17} />
            </button>
            <div className="min-w-0 flex-1">
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                <div className={cn('h-full rounded-full bg-coral', active ? 'w-full animate-pulse' : 'w-0')} />
              </div>
              <div className="mt-1 text-[11px] text-muted">{supported ? (active ? 'Reproduciendo…' : 'Síntesis de voz del navegador') : 'Tu navegador no admite síntesis de voz'}</div>
            </div>
          </>
        )}
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => changeRate(-0.1)} aria-label="Más lento" className="flex h-7 w-7 items-center justify-center rounded-full border border-line text-ink-soft hover:bg-surface-2">
            <Minus size={13} />
          </button>
          <span className="w-11 text-center font-mono text-xs text-ink">{Math.round(rate * 100)}%</span>
          <button type="button" onClick={() => changeRate(0.1)} aria-label="Más rápido" className="flex h-7 w-7 items-center justify-center rounded-full border border-line text-ink-soft hover:bg-surface-2">
            <Plus size={13} />
          </button>
        </div>
      </div>
      {useFile && audioCredit && <p className="mt-2 px-2 text-[11px] text-muted">Audio: {audioCredit}</p>}
      {showVoices && !useFile && supported && (
        <div className="mt-3">
          {voices.length === 0 ? (
            <p className="px-2 text-xs text-muted">No se detectaron voces en inglés en este sistema. Instala voces en inglés (configuración del sistema operativo) para escuchar los audios; mientras tanto, usa la transcripción.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {voices.slice(0, 6).map((v) => {
                const selected = (settings.voiceURI ?? voices[0]?.uri) === v.uri;
                const second = settings.secondVoiceURI === v.uri;
                return (
                  <button
                    key={v.uri}
                    type="button"
                    onClick={() => updateSettings({ voiceURI: v.uri })}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      if (speakers.length > 1) updateSettings({ secondVoiceURI: v.uri });
                    }}
                    className={cn('flex items-center gap-3 rounded-2xl border bg-surface px-3 py-2 text-left', selected ? 'border-brand' : second ? 'border-info' : 'border-transparent hover:border-line')}
                  >
                    <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold', selected ? 'bg-brand text-white' : 'bg-surface-2 text-muted')}>
                      {v.lang.slice(3, 5) || 'EN'}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-ink">{v.name.replace(/Microsoft |Google |\(.*\)/g, '').trim() || v.name}</span>
                      <span className="block text-[11px] text-muted">{v.accent}{second ? ' · 2.ª voz' : ''}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {speakers.length > 1 && voices.length > 1 && <p className="mt-2 px-2 text-[11px] text-muted">Diálogo con {speakers.length} hablantes: se alternan dos voces. Clic derecho en una voz para elegir la segunda.</p>}
        </div>
      )}
    </div>
  );
}
