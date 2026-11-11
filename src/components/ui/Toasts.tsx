import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { cn } from '../../utils/cn';

export function Toasts() {
  const toasts = useAppStore((s) => s.toasts);
  const dismiss = useAppStore((s) => s.dismissToast);
  useEffect(() => {
    if (!toasts.length) return;
    const timers = toasts.map((t) => setTimeout(() => dismiss(t.id), t.tone === 'achievement' ? 7000 : 4500));
    return () => timers.forEach(clearTimeout);
  }, [toasts, dismiss]);
  return (
    <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'animate-pop pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg',
            t.tone === 'achievement' ? 'border-brand/30 bg-ink text-on-ink' : 'border-line bg-surface text-ink',
          )}
        >
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">{t.title}</div>
            {t.description && <div className={cn('mt-0.5 text-xs', t.tone === 'achievement' ? 'opacity-75' : 'text-muted')}>{t.description}</div>}
          </div>
          <button type="button" onClick={() => dismiss(t.id)} aria-label="Cerrar aviso" className="rounded-full p-1 opacity-70 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
