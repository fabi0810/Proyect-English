import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import { useAppStore } from '../store/useAppStore';

const TICK_SECONDS = 15;
const IDLE_LIMIT_MS = 120_000;

/** Cuenta tiempo de estudio activo (pestaña visible y actividad reciente del usuario). */
export function useStudyTimer(): void {
  const location = useLocation();
  const area = location.pathname.split('/')[1] || 'dashboard';
  const areaRef = useRef(area);
  areaRef.current = area;
  const lastInteraction = useRef(Date.now());
  const addStudySeconds = useAppStore((s) => s.addStudySeconds);

  useEffect(() => {
    const mark = () => {
      lastInteraction.current = Date.now();
    };
    const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastInteraction.current > IDLE_LIMIT_MS) return;
      addStudySeconds(TICK_SECONDS, areaRef.current);
    }, TICK_SECONDS * 1000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, mark));
      window.clearInterval(id);
    };
  }, [addStudySeconds]);
}
