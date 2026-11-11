import { Award, BookOpen, Brain, Compass, Crown, Flame, Headphones, Medal, PenLine, Shield, Star, Target, Trophy } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { PageHeader } from '../../components/layout/AppShell';
import { ProgressBar } from '../../components/ui/primitives';
import { ACHIEVEMENTS, type AchievementDef } from '../../services/progress/achievements';
import { formatDate } from '../../utils/dates';
import { cn } from '../../utils/cn';

const ICONS: Record<AchievementDef['icon'], React.ReactNode> = {
  book: <BookOpen size={22} />,
  trophy: <Trophy size={22} />,
  star: <Star size={22} />,
  flame: <Flame size={22} />,
  brain: <Brain size={22} />,
  pen: <PenLine size={22} />,
  headphones: <Headphones size={22} />,
  target: <Target size={22} />,
  medal: <Medal size={22} />,
  crown: <Crown size={22} />,
  shield: <Shield size={22} />,
  compass: <Compass size={22} />,
};

export default function AchievementsPage() {
  const data = useAppStore((s) => s.data);
  const unlocked = ACHIEVEMENTS.filter((a) => data.achievements[a.id]).length;
  return (
    <div>
      <PageHeader eyebrow="Achievements" title="Logros" subtitle={`Has desbloqueado ${unlocked} de ${ACHIEVEMENTS.length}. Cada logro depende de acciones reales registradas en tu historial.`} actions={<span className="inline-flex items-center gap-2 rounded-full bg-warning-soft px-4 py-2 font-mono text-sm font-bold text-warning"><Award size={16} /> {unlocked}/{ACHIEVEMENTS.length}</span>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {ACHIEVEMENTS.map((a) => {
          const got = data.achievements[a.id];
          const p = a.progress(data);
          return (
            <div key={a.id} className={cn('card card-pad flex gap-4', !got && 'bg-surface/60')}>
              <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl', got ? 'bg-warning text-white' : 'bg-surface-2 text-subtle')}>{ICONS[a.icon]}</span>
              <div className="min-w-0 flex-1">
                <h3 className={cn('font-semibold', got ? 'text-ink' : 'text-ink-soft')}>{a.title}</h3>
                <p className="mt-0.5 text-sm text-muted">{a.description}</p>
                {got ? (
                  <p className="mt-2 text-xs font-semibold text-success">Desbloqueado el {formatDate(got.unlockedAt)}</p>
                ) : (
                  <div className="mt-3 flex items-center gap-2">
                    <ProgressBar value={p.value / p.target} size="sm" barClassName="bg-warning" />
                    <span className="font-mono text-[11px] text-muted">
                      {p.value}/{p.target}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
