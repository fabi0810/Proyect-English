import { ButtonLink } from '../components/ui/Button';

export default function NotFoundPage() {
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <div className="font-mono text-6xl font-bold text-subtle">404</div>
      <h1 className="mt-3 text-xl font-bold text-ink">Página no encontrada</h1>
      <p className="mt-2 text-muted">La dirección no corresponde a ninguna sección.</p>
      <ButtonLink to="/" className="mt-6">
        Ir al Dashboard
      </ButtonLink>
    </div>
  );
}
