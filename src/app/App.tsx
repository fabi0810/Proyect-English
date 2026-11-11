import { useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes/router';
import { useAppStore } from '../store/useAppStore';
import { ThemeSync } from './providers/ThemeSync';

export function App() {
  const hydrated = useAppStore((s) => s.hydrated);
  const hydrate = useAppStore((s) => s.hydrate);
  useEffect(() => {
    void hydrate();
  }, [hydrate]);
  if (!hydrated)
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-muted">
          <span className="h-2.5 w-2.5 animate-ping rounded-full bg-brand" /> Cargando tu progreso…
        </div>
      </div>
    );
  return (
    <>
      <ThemeSync />
      <RouterProvider router={router} />
    </>
  );
}
