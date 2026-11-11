import { Square, Volume2 } from 'lucide-react';
import { useSpeech } from '../../hooks/useSpeech';
import { cn } from '../../utils/cn';

/** Botón para escuchar un texto con la voz configurada. */
export function SpeakButton({
  text,
  id,
  size = 'sm',
  className,
  label = 'Escuchar',
  rate,
}: {
  text: string | { text: string; speaker?: string }[];
  id?: string;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
  label?: string;
  rate?: number;
}) {
  const { play, playing, supported, hasEnglishVoice } = useSpeech();
  const key = id ?? (typeof text === 'string' ? text : text.map((t) => t.text).join('|'));
  const active = playing === key;
  const disabled = !supported;
  const dim = size === 'xs' ? 'h-7 w-7' : size === 'sm' ? 'h-8 w-8' : 'h-10 w-10';
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        play(key, text, rate ? { rate } : {});
      }}
      title={disabled ? 'Tu navegador no admite síntesis de voz' : !hasEnglishVoice ? `${label} (no se detectaron voces en inglés)` : label}
      aria-label={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-30',
        active ? 'bg-brand text-white' : 'bg-surface-2 text-ink-soft hover:bg-brand-soft hover:text-brand',
        dim,
        className,
      )}
    >
      {active ? <Square size={size === 'md' ? 15 : 12} fill="currentColor" /> : <Volume2 size={size === 'md' ? 18 : 15} />}
    </button>
  );
}
