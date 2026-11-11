import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import {
  BookA,
  BookOpen,
  CircleAlert,
  ClipboardCheck,
  Dumbbell,
  GraduationCap,
  Headphones,
  History,
  Languages,
  LayoutDashboard,
  Library,
  Menu,
  PenLine,
  Settings,
  Trophy,
  X,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useStudyTimer } from '../../hooks/useStudyTimer';
import { Toasts } from '../ui/Toasts';
import { cn } from '../../utils/cn';
import { isDue } from '../../services/vocabulary/srs';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  badge?: number;
}

function useNavItems(): NavItem[] {
  const mistakes = useAppStore((s) => s.data.mistakes);
  const cards = useAppStore((s) => s.data.vocab.cards);
  const unresolved = useMemo(() => Object.values(mistakes).filter((m) => !m.resolved).length, [mistakes]);
  const due = useMemo(() => Object.values(cards).filter((c) => isDue(c)).length, [cards]);
  return [
    { to: '/', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { to: '/courses', label: 'My Courses', icon: <GraduationCap size={18} /> },
    { to: '/grammar', label: 'Grammar', icon: <BookA size={18} /> },
    { to: '/vocabulary', label: 'Vocabulary', icon: <Library size={18} />, badge: due || undefined },
    { to: '/reading', label: 'Reading', icon: <BookOpen size={18} /> },
    { to: '/listening', label: 'Listening', icon: <Headphones size={18} /> },
    { to: '/writing', label: 'Writing', icon: <PenLine size={18} /> },
    { to: '/translation', label: 'Translation', icon: <Languages size={18} /> },
    { to: '/practice', label: 'Practice', icon: <Dumbbell size={18} /> },
    { to: '/mistakes', label: 'My Mistakes', icon: <CircleAlert size={18} />, badge: unresolved || undefined },
    { to: '/evaluations', label: 'Evaluations', icon: <ClipboardCheck size={18} /> },
    { to: '/history', label: 'History', icon: <History size={18} /> },
    { to: '/achievements', label: 'Achievements', icon: <Trophy size={18} /> },
  ];
}

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5 px-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink text-on-ink">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
          <path d="M6 7h10M6 12h8M6 17h10" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="19" cy="17" r="2.2" fill="var(--brand)" />
        </svg>
      </span>
      <span className="leading-tight">
        <span className="block text-[15px] font-extrabold tracking-tight text-ink">English Platform</span>
        <span className="block font-mono text-[10px] tracking-[0.18em] text-muted uppercase">A1 → B2</span>
      </span>
    </Link>
  );
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const items = useNavItems();
  return (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-4" aria-label="Navegación principal">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-full px-4 py-2.5 text-[14px] font-semibold transition-colors',
              isActive ? 'bg-ink text-on-ink' : 'text-ink-soft hover:bg-surface-2',
            )
          }
        >
          {item.icon}
          <span className="flex-1">{item.label}</span>
          {item.badge !== undefined && (
            <span className="rounded-full bg-coral px-2 py-0.5 font-mono text-[10px] font-bold text-white">{item.badge > 99 ? '99+' : item.badge}</span>
          )}
        </NavLink>
      ))}
      <div className="my-3 border-t border-line" />
      <NavLink
        to="/settings"
        onClick={onNavigate}
        className={({ isActive }) =>
          cn('flex items-center gap-3 rounded-full px-4 py-2.5 text-[14px] font-semibold transition-colors', isActive ? 'bg-ink text-on-ink' : 'text-ink-soft hover:bg-surface-2')
        }
      >
        <Settings size={18} /> Settings
      </NavLink>
    </nav>
  );
}

function Banners() {
  const storageKind = useAppStore((s) => s.storageKind);
  const storageError = useAppStore((s) => s.storageError);
  const multiTab = useAppStore((s) => s.multiTab);
  const activeExam = useAppStore((s) => s.data.activeExam);
  const location = useLocation();
  const inExam = location.pathname.startsWith('/evaluations/run') || location.pathname.startsWith('/lesson/');
  return (
    <div className="space-y-2">
      {storageKind === 'memory' && (
        <div className="rounded-2xl border border-danger/30 bg-danger-soft px-4 py-2.5 text-sm text-ink">
          <strong>Tu progreso no se está guardando.</strong> El navegador no permite almacenamiento local (¿modo privado?). Exporta una copia desde Settings antes de cerrar.
        </div>
      )}
      {storageError && storageKind !== 'memory' && (
        <div className="rounded-2xl border border-warning/30 bg-warning-soft px-4 py-2.5 text-sm text-ink">
          <strong>Problema al guardar:</strong> {storageError}. Exporta una copia de seguridad desde Settings.
        </div>
      )}
      {multiTab && (
        <div className="rounded-2xl border border-warning/30 bg-warning-soft px-4 py-2.5 text-sm text-ink">
          La aplicación está abierta en otra pestaña. Usa solo una para evitar que el progreso se sobrescriba.
        </div>
      )}
      {activeExam && !inExam && activeExam.kind !== 'lesson' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand/30 bg-brand-soft px-4 py-2.5 text-sm text-ink">
          <span>
            Tienes una evaluación en curso: <strong>{activeExam.title}</strong>
          </span>
          <Link to={`/evaluations/run/${activeExam.kind}/${activeExam.targetId}`} className="font-semibold text-brand underline-offset-2 hover:underline">
            Reanudar
          </Link>
        </div>
      )}
    </div>
  );
}

export function AppShell() {
  useStudyTimer();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => {
    setOpen(false);
    document.getElementById('main')?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="min-h-dvh lg:pl-[260px]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[70] focus:rounded-xl focus:bg-ink focus:px-3 focus:py-2 focus:text-on-ink">
        Saltar al contenido
      </a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] flex-col border-r border-line bg-surface lg:flex">
        <div className="px-4 pt-6 pb-5">
          <Brand />
        </div>
        <SidebarNav />
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface/90 px-4 py-3 backdrop-blur lg:hidden">
        <Brand />
        <button type="button" onClick={() => setOpen(true)} aria-label="Abrir menú" className="rounded-full p-2 text-ink hover:bg-surface-2">
          <Menu size={22} />
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="animate-pop absolute inset-y-0 left-0 flex w-[280px] flex-col bg-surface shadow-2xl">
            <div className="flex items-center justify-between px-4 pt-5 pb-4">
              <Brand />
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar menú" className="rounded-full p-2 hover:bg-surface-2">
                <X size={20} />
              </button>
            </div>
            <SidebarNav onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1200px] px-4 pt-5 pb-16 outline-none sm:px-6 lg:px-10 lg:pt-8">
        <Banners />
        <Outlet />
      </main>
      <Toasts />
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  actions,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mt-2 mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow && <div className="label-mono mb-2">{eyebrow}</div>}
        <h1 className="text-[28px] leading-tight font-bold tracking-tight text-ink sm:text-[34px]">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-[15px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
