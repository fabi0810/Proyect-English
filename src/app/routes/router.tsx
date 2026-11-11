import { lazy, Suspense, type ComponentType } from 'react';
import { createHashRouter, Link, useRouteError } from 'react-router';
import { AppShell } from '../../components/layout/AppShell';
import { Loading } from '../../components/ui/primitives';

function page(loader: () => Promise<{ default: ComponentType }>) {
  const C = lazy(loader);
  return (
    <Suspense fallback={<Loading />}>
      <C />
    </Suspense>
  );
}

function RouteError() {
  const error = useRouteError() as Error | { statusText?: string } | undefined;
  const msg = error instanceof Error ? error.message : (error?.statusText ?? 'Error desconocido');
  return (
    <div className="mx-auto max-w-lg py-24 text-center">
      <h1 className="text-2xl font-bold text-ink">Algo salió mal</h1>
      <p className="mt-2 text-muted">{msg}</p>
      <Link to="/" className="mt-6 inline-block rounded-2xl bg-ink px-5 py-3 font-semibold text-on-ink">
        Volver al Dashboard
      </Link>
    </div>
  );
}

export const router = createHashRouter([
  {
    path: '/',
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: page(() => import('../../pages/Dashboard/DashboardPage')) },
      { path: 'courses', element: page(() => import('../../pages/Courses/CoursesPage')) },
      { path: 'courses/:level', element: page(() => import('../../pages/Courses/CoursesPage')) },
      { path: 'module/:moduleId', element: page(() => import('../../pages/Courses/ModulePage')) },
      { path: 'lesson/:lessonId', element: page(() => import('../../pages/Courses/LessonPage')) },
      { path: 'grammar', element: page(() => import('../../pages/Grammar/GrammarPage')) },
      { path: 'grammar/:lessonId', element: page(() => import('../../pages/Grammar/GrammarLessonPage')) },
      { path: 'vocabulary', element: page(() => import('../../pages/Vocabulary/VocabularyPage')) },
      { path: 'vocabulary/review', element: page(() => import('../../pages/Vocabulary/FlashcardsPage')) },
      { path: 'vocabulary/quiz', element: page(() => import('../../pages/Vocabulary/VocabQuizPage')) },
      { path: 'reading', element: page(() => import('../../pages/Reading/ReadingListPage')) },
      { path: 'reading/:id', element: page(() => import('../../pages/Reading/ReadingPage')) },
      { path: 'listening', element: page(() => import('../../pages/Listening/ListeningListPage')) },
      { path: 'listening/:id', element: page(() => import('../../pages/Listening/ListeningPage')) },
      { path: 'writing', element: page(() => import('../../pages/Writing/WritingPage')) },
      { path: 'writing/:taskId', element: page(() => import('../../pages/Writing/WritingTaskPage')) },
      { path: 'translation', element: page(() => import('../../pages/Translation/TranslationPage')) },
      { path: 'practice', element: page(() => import('../../pages/Practice/PracticePage')) },
      { path: 'mistakes', element: page(() => import('../../pages/Practice/MistakesPage')) },
      { path: 'evaluations', element: page(() => import('../../pages/Evaluations/EvaluationsPage')) },
      { path: 'evaluations/run/:kind/:targetId', element: page(() => import('../../pages/Evaluations/ExamPage')) },
      { path: 'evaluations/result/:attemptId', element: page(() => import('../../pages/Evaluations/ResultPage')) },
      { path: 'history', element: page(() => import('../../pages/History/HistoryPage')) },
      { path: 'achievements', element: page(() => import('../../pages/Achievements/AchievementsPage')) },
      { path: 'diagnostic', element: page(() => import('../../pages/Diagnostic/DiagnosticPage')) },
      { path: 'settings', element: page(() => import('../../pages/Settings/SettingsPage')) },
      { path: '*', element: page(() => import('../../pages/NotFoundPage')) },
    ],
  },
]);
