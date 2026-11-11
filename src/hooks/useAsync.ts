import { useEffect, useState } from 'react';

/** Ejecuta una carga asíncrona (contenido JSON diferido) y expone su estado. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): { data: T | undefined; error: Error | undefined; loading: boolean } {
  const [state, setState] = useState<{ data: T | undefined; error: Error | undefined; loading: boolean }>({
    data: undefined,
    error: undefined,
    loading: true,
  });
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: undefined }));
    fn().then(
      (data) => alive && setState({ data, error: undefined, loading: false }),
      (error: unknown) => alive && setState({ data: undefined, error: error instanceof Error ? error : new Error(String(error)), loading: false }),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}
