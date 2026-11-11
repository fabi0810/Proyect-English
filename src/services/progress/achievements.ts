/** Logros: cada uno depende de acciones reales registradas en el historial. */
import type { Level } from '../../types/content';
import type { UserData } from '../../types/progress';
import { completedAttempts, streak, wordsLearned } from './stats';
import { isLevelPassed } from './unlock';

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: 'book' | 'trophy' | 'star' | 'flame' | 'brain' | 'pen' | 'headphones' | 'target' | 'medal' | 'crown' | 'shield' | 'compass';
  /** Progreso actual / objetivo (para la barra). */
  progress: (d: UserData) => { value: number; target: number };
}

const levelDone = (level: Level): AchievementDef => ({
  id: `level-${level.toLowerCase()}`,
  title: `Nivel ${level} completado`,
  description: `Aprobar el examen final integral de ${level}.`,
  icon: 'crown',
  progress: (d) => ({ value: isLevelPassed(d, level) ? 1 : 0, target: 1 }),
});

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first-lesson',
    title: 'Primera lección completada',
    description: 'Completar una lección aprobando su evaluación.',
    icon: 'book',
    progress: (d) => ({ value: Math.min(1, Object.values(d.lessons).filter((l) => l.status === 'completed').length), target: 1 }),
  },
  {
    id: 'first-module',
    title: 'Primer módulo aprobado',
    description: 'Aprobar la evaluación de un módulo.',
    icon: 'medal',
    progress: (d) => ({ value: Math.min(1, Object.values(d.modules).filter((m) => m.passedAt).length), target: 1 }),
  },
  {
    id: 'words-100',
    title: '100 palabras aprendidas',
    description: 'Recordar correctamente 100 palabras en repasos espaciados (≥ 2 aciertos seguidos e intervalo ≥ 6 días).',
    icon: 'brain',
    progress: (d) => ({ value: Math.min(100, wordsLearned(d)), target: 100 }),
  },
  {
    id: 'first-reading',
    title: 'Primera lectura completada',
    description: 'Terminar una lectura respondiendo sus preguntas.',
    icon: 'book',
    progress: (d) => ({ value: Math.min(1, Object.values(d.readings).filter((r) => r.completed).length), target: 1 }),
  },
  {
    id: 'five-evaluations',
    title: 'Cinco evaluaciones aprobadas',
    description: 'Aprobar cinco evaluaciones de módulo o de nivel.',
    icon: 'trophy',
    progress: (d) => ({
      value: Math.min(5, completedAttempts(d).filter((a) => (a.kind === 'module' || a.kind === 'level') && a.passed).length),
      target: 5,
    }),
  },
  levelDone('A1'),
  levelDone('A2'),
  levelDone('B1'),
  levelDone('B2'),
  {
    id: 'streak-7',
    title: 'Constancia: 7 días seguidos',
    description: 'Estudiar siete días consecutivos.',
    icon: 'flame',
    progress: (d) => ({ value: Math.min(7, streak(d)), target: 7 }),
  },
  {
    id: 'perfect-module',
    title: 'Nota perfecta',
    description: 'Obtener 5.0 en la evaluación de un módulo.',
    icon: 'star',
    progress: (d) => ({ value: completedAttempts(d, 'module').some((a) => a.grade === 5) ? 1 : 0, target: 1 }),
  },
  {
    id: 'comeback',
    title: 'Resiliencia',
    description: 'Aprobar una evaluación que antes no habías aprobado.',
    icon: 'shield',
    progress: (d) => {
      const byTarget = new Map<string, boolean[]>();
      for (const a of completedAttempts(d)) {
        if (a.kind !== 'module' && a.kind !== 'level') continue;
        const k = `${a.kind}:${a.targetId}`;
        byTarget.set(k, [...(byTarget.get(k) ?? []), Boolean(a.passed)]);
      }
      const ok = Array.from(byTarget.values()).some((r) => r.indexOf(false) !== -1 && r.lastIndexOf(true) > r.indexOf(false));
      return { value: ok ? 1 : 0, target: 1 };
    },
  },
  {
    id: 'mistakes-25',
    title: '25 errores corregidos',
    description: 'Resolver 25 errores (dos aciertos seguidos en preguntas que habías fallado).',
    icon: 'target',
    progress: (d) => ({ value: Math.min(25, Object.values(d.mistakes).filter((m) => m.resolved).length), target: 25 }),
  },
  {
    id: 'writer-5',
    title: 'Escritor constante',
    description: 'Enviar cinco textos al laboratorio de escritura.',
    icon: 'pen',
    progress: (d) => ({ value: Math.min(5, d.writings.length), target: 5 }),
  },
  {
    id: 'listener-5',
    title: 'Buen oído',
    description: 'Completar cinco actividades de comprensión auditiva.',
    icon: 'headphones',
    progress: (d) => ({ value: Math.min(5, Object.values(d.listening).filter((r) => r.completed).length), target: 5 }),
  },
  {
    id: 'diagnostic',
    title: 'Punto de partida',
    description: 'Realizar el diagnóstico inicial.',
    icon: 'compass',
    progress: (d) => ({ value: d.attempts.some((a) => a.kind === 'diagnostic' && a.status === 'completed') ? 1 : 0, target: 1 }),
  },
];

/** Logros cumplidos que aún no están registrados. */
export function newlyUnlocked(data: UserData): AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => {
    if (data.achievements[a.id]) return false;
    const p = a.progress(data);
    return p.value >= p.target;
  });
}
