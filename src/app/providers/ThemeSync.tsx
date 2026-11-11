import { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';

/** Aplica el tema (claro / oscuro / sistema) a <html>. */
export function ThemeSync() {
  const theme = useAppStore((s) => s.data.settings.theme);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches);
      document.documentElement.classList.toggle('dark', dark);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0E1015' : '#F2F3F7');
    };
    apply();
    try {
      localStorage.setItem('elp:theme', theme);
    } catch {
      /* sin almacenamiento */
    }
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
  return null;
}
