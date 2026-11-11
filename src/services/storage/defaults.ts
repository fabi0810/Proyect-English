import type { Settings, UserData } from '../../types/progress';
import { SCHEMA_VERSION } from '../../types/progress';
import { nowIso } from '../../utils/dates';

export const DEFAULT_SETTINGS: Settings = {
  passGrade: 3.0,
  exigency: 0.7,
  sectionMinimum: 0.5,
  strictProgression: true,
  requireReviewBeforeRetake: false,
  speechRate: 0.9,
  theme: 'system',
  dailyGoalMinutes: 20,
  showSpanishSupport: true,
};

export function createDefaultUserData(courseNumber = 1): UserData {
  return {
    meta: { schemaVersion: SCHEMA_VERSION, createdAt: nowIso(), courseNumber },
    profile: { name: '', startLevel: 'A1', onboarded: false },
    settings: { ...DEFAULT_SETTINGS },
    lessons: {},
    modules: {},
    attempts: [],
    activeExam: null,
    itemStats: {},
    answerLog: [],
    mistakes: {},
    vocab: { cards: {}, lists: [], difficult: [] },
    readings: {},
    listening: {},
    writings: [],
    activity: {},
    events: [],
    achievements: {},
    flags: [],
  };
}

export const SLICE_KEYS = Object.keys(createDefaultUserData()) as (keyof UserData)[];
