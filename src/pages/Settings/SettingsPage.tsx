import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { Database, Download, Flag, RotateCcw, Trash2, Upload, Volume2 } from 'lucide-react';
import type { ArchivedCourse, Settings, UserData } from '../../types/progress';
import { useAppStore } from '../../store/useAppStore';
import { useSpeech } from '../../hooks/useSpeech';
import { PageHeader } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { Callout, Card, CardTitle, Pill } from '../../components/ui/primitives';
import { ConfirmDialog, Modal } from '../../components/ui/Modal';
import { backupFileName, createBackup, downloadJson, parseBackup, summarizeData, type DataSummary } from '../../services/storage/backup';
import { buildAcademicReport } from '../../services/progress/report';
import { percentNeeded } from '../../services/evaluation/scale';
import { formatDateTime } from '../../utils/dates';
import { ReportView } from '../History/HistoryPage';

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-2">
      <span>
        <span className="block text-sm font-semibold text-ink">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-brand' : 'bg-surface-3'}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </label>
  );
}

function SummaryList({ s }: { s: DataSummary }) {
  return (
    <ul className="grid grid-cols-2 gap-2 text-sm">
      <li>Lecciones completadas: <strong>{s.lessonsCompleted}</strong></li>
      <li>Intentos de evaluación: <strong>{s.attempts}</strong></li>
      <li>Módulos aprobados: <strong>{s.modulesPassed}</strong></li>
      <li>Palabras estudiadas: <strong>{s.words}</strong></li>
      <li>Textos escritos: <strong>{s.writings}</strong></li>
      <li>Días con actividad: <strong>{s.daysActive}</strong></li>
    </ul>
  );
}

export default function SettingsPage() {
  const data = useAppStore((s) => s.data);
  const storageKind = useAppStore((s) => s.storageKind);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const updateProfile = useAppStore((s) => s.updateProfile);
  const importData = useAppStore((s) => s.importData);
  const resetCourse = useAppStore((s) => s.resetCourse);
  const eraseAll = useAppStore((s) => s.eraseAll);
  const getArchives = useAppStore((s) => s.getArchives);
  const pushToast = useAppStore((s) => s.pushToast);
  const { voices, play } = useSpeech();
  const s = data.settings;
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ data: UserData; archives: ArchivedCourse[]; exportedAt?: string } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [keepLists, setKeepLists] = useState(true);
  const [eraseOpen, setEraseOpen] = useState(false);
  const set = (patch: Partial<Settings>) => updateSettings(patch);

  const location = useLocation();
  useEffect(() => {
    if (location.hash === '#reset') setResetOpen(true);
  }, [location.hash]);

  const exportNow = async () => {
    const archives = await getArchives();
    downloadJson(createBackup(useAppStore.getState().data, archives), backupFileName());
    pushToast({ title: 'Copia de seguridad descargada', tone: 'success' });
  };

  return (
    <div>
      <PageHeader eyebrow="Settings" title="Configuración" subtitle="Parámetros de evaluación, audio, apariencia y gestión de tus datos locales." />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardTitle>Perfil</CardTitle>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-ink">Nombre</span>
            <input value={data.profile.name} onChange={(e) => updateProfile({ name: e.target.value })} className="input" placeholder="Tu nombre" />
          </label>
          <p className="mt-3 text-sm text-muted">Nivel de inicio: {data.profile.startLevel} · curso n.º {data.meta.courseNumber}</p>
        </Card>

        <Card>
          <CardTitle>Evaluación</CardTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-ink">Nota mínima de aprobación</span>
              <input type="number" min={2} max={4.5} step={0.1} value={s.passGrade} onChange={(e) => set({ passGrade: Math.min(4.5, Math.max(2, Number(e.target.value) || 3)) })} className="input font-mono" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-ink">Exigencia (% para un 3.0)</span>
              <select value={s.exigency} onChange={(e) => set({ exigency: Number(e.target.value) })} className="input">
                {[0.6, 0.65, 0.7, 0.75, 0.8, 0.85].map((v) => (
                  <option key={v} value={v}>
                    {Math.round(v * 100)} %
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-ink">Mínimo por sección (examen final)</span>
              <select value={s.sectionMinimum} onChange={(e) => set({ sectionMinimum: Number(e.target.value) })} className="input">
                {[0.4, 0.5, 0.6, 0.7].map((v) => (
                  <option key={v} value={v}>
                    {Math.round(v * 100)} %
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-sm text-ink-soft">
            Con estos valores, aprobar exige <strong className="text-ink">{Math.round(percentNeeded(s.passGrade, s.exigency) * 1000) / 10} %</strong> de aciertos.
          </p>
          <div className="mt-3 divide-y divide-line">
            <Toggle checked={s.strictProgression} onChange={(v) => set({ strictProgression: v })} label="Progresión estricta" hint="Los módulos y lecciones se desbloquean al aprobar los anteriores." />
            <Toggle checked={s.requireReviewBeforeRetake} onChange={(v) => set({ requireReviewBeforeRetake: v })} label="Exigir repaso antes de reintentar" hint="Tras reprobar un módulo, hay que completar una práctica dirigida antes del siguiente intento." />
          </div>
        </Card>

        <Card>
          <CardTitle>Audio</CardTitle>
          {voices.length === 0 ? (
            <Callout tone="warning">No se detectaron voces en inglés. Instala voces en inglés en tu sistema operativo o usa Chrome/Edge.</Callout>
          ) : (
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-ink">Voz principal</span>
                <select value={s.voiceURI ?? ''} onChange={(e) => set({ voiceURI: e.target.value || undefined })} className="input">
                  <option value="">Automática (inglés americano)</option>
                  {voices.map((v) => (
                    <option key={v.uri} value={v.uri}>
                      {v.name} — {v.accent}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-ink">Segunda voz (diálogos)</span>
                <select value={s.secondVoiceURI ?? ''} onChange={(e) => set({ secondVoiceURI: e.target.value || undefined })} className="input">
                  <option value="">Automática</option>
                  {voices.map((v) => (
                    <option key={v.uri} value={v.uri}>
                      {v.name} — {v.accent}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <label className="mt-4 block">
            <span className="mb-1.5 flex justify-between text-sm font-semibold text-ink">
              Velocidad <span className="font-mono text-muted">{Math.round(s.speechRate * 100)} %</span>
            </span>
            <input type="range" min={0.5} max={1.3} step={0.05} value={s.speechRate} onChange={(e) => set({ speechRate: Number(e.target.value) })} className="w-full accent-[var(--brand)]" />
          </label>
          <Button className="mt-3" variant="secondary" size="sm" icon={<Volume2 size={15} />} onClick={() => play('settings-test', [{ text: 'Hello! This is how I sound.', speaker: 'A' }, { text: 'And this is the second voice.', speaker: 'B' }])}>
            Probar voces
          </Button>
        </Card>

        <Card>
          <CardTitle>Apariencia y estudio</CardTitle>
          <div className="mb-4">
            <span className="mb-2 block text-sm font-semibold text-ink">Tema</span>
            <div className="flex gap-2">
              {(['light', 'dark', 'system'] as const).map((t) => (
                <Pill key={t} active={s.theme === t} onClick={() => set({ theme: t })}>
                  {t === 'light' ? 'Claro' : t === 'dark' ? 'Oscuro' : 'Sistema'}
                </Pill>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-ink">Meta diaria (minutos)</span>
            <input type="number" min={5} max={240} value={s.dailyGoalMinutes} onChange={(e) => set({ dailyGoalMinutes: Math.max(5, Math.min(240, Number(e.target.value) || 20)) })} className="input font-mono" />
          </label>
          <div className="mt-2 divide-y divide-line">
            <Toggle checked={s.showSpanishSupport} onChange={(v) => set({ showSpanishSupport: v })} label="Mostrar traducciones de apoyo" hint="Traducción de los ejemplos y diálogos de las lecciones." />
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardTitle action={<span className="inline-flex items-center gap-1.5 text-xs text-muted"><Database size={14} /> {storageKind === 'indexeddb' ? 'IndexedDB' : storageKind === 'localstorage' ? 'localStorage' : 'Memoria (no persistente)'}</span>}>
            Datos y copia de seguridad
          </CardTitle>
          <p className="mb-4 text-sm text-ink-soft">Tu progreso se guarda solo en este navegador. Exporta una copia con regularidad para no perderla (al borrar datos del navegador o cambiar de equipo).</p>
          <SummaryList s={summarizeData(data)} />
          <div className="mt-5 flex flex-wrap gap-2">
            <Button icon={<Download size={16} />} onClick={() => void exportNow()}>
              Exportar copia (.json)
            </Button>
            <Button variant="secondary" icon={<Upload size={16} />} onClick={() => fileRef.current?.click()}>
              Importar copia
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                try {
                  setImportError(null);
                  setPending(parseBackup(await f.text()));
                } catch (err) {
                  setImportError(err instanceof Error ? err.message : String(err));
                }
              }}
            />
          </div>
          {importError && <Callout tone="danger" className="mt-4" title="No se pudo importar">{importError}</Callout>}
        </Card>

        <Card className="lg:col-span-2" as="section">
          <div id="reset" />
          <CardTitle>Reiniciar el curso</CardTitle>
          <p className="text-sm text-ink-soft">
            Archiva todo tu historial actual (notas, intentos, errores, escritos) en «Cursos anteriores» y vuelve a empezar desde A1. Se conservan la configuración y, si quieres, tus listas de vocabulario.
          </p>
          <Button className="mt-4" variant="secondary" icon={<RotateCcw size={16} />} onClick={() => setResetOpen(true)}>
            Ver informe y reiniciar
          </Button>
        </Card>

        <Card className="lg:col-span-2">
          <CardTitle action={data.flags.length > 0 && <Button size="sm" variant="secondary" icon={<Download size={14} />} onClick={() => downloadJson(data.flags, 'reportes-de-contenido.json')}>Exportar</Button>}>
            Revisión de contenido
          </CardTitle>
          {data.flags.length === 0 ? (
            <p className="text-sm text-muted">No has reportado preguntas. Usa la bandera <Flag size={13} className="inline" /> de cada ejercicio si algo te parece incorrecto.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {data.flags.slice(-30).reverse().map((f, i) => (
                <li key={i} className="py-2">
                  <span className="font-mono text-xs text-muted">{f.itemId}</span> · {f.reason}
                  {f.response && <span className="text-muted"> · «{f.response}»</span>}
                  <span className="block text-xs text-subtle">{formatDateTime(f.ts)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="border-danger/30 lg:col-span-2">
          <CardTitle>Zona de peligro</CardTitle>
          <p className="text-sm text-ink-soft">Borra todos los datos de este navegador, incluidos los cursos archivados. Exporta una copia antes.</p>
          <Button className="mt-4" variant="danger" icon={<Trash2 size={16} />} onClick={() => setEraseOpen(true)}>
            Borrar todos los datos
          </Button>
        </Card>
      </div>

      <Modal
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        title="Importar copia de seguridad"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPending(null)}>
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                if (!pending) return;
                await importData(pending.data, pending.archives);
                setPending(null);
                pushToast({ title: 'Copia importada', description: 'Tu progreso se restauró correctamente.', tone: 'success' });
              }}
            >
              Reemplazar mis datos
            </Button>
          </>
        }
      >
        {pending && (
          <div className="space-y-4">
            <p>Copia exportada el {formatDateTime(pending.exportedAt)}. Contiene:</p>
            <SummaryList s={summarizeData(pending.data)} />
            {pending.archives.length > 0 && <p className="text-sm">Además, {pending.archives.length} curso(s) archivado(s).</p>}
            <Callout tone="warning">Tus datos actuales se reemplazarán. Exporta primero una copia si quieres conservarlos.</Callout>
          </div>
        )}
      </Modal>

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        size="lg"
        title="Informe académico y reinicio"
        footer={
          <>
            <Button variant="secondary" icon={<Download size={15} />} onClick={() => void exportNow()}>
              Exportar copia primero
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                await resetCourse({ keepLists });
                setResetOpen(false);
                pushToast({ title: 'Curso reiniciado', description: 'Tu historial anterior está en History › Cursos anteriores.', tone: 'info' });
              }}
            >
              Archivar y empezar desde A1
            </Button>
          </>
        }
      >
        <ReportView report={buildAcademicReport(data)} />
        <label className="mt-5 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={keepLists} onChange={(e) => setKeepLists(e.target.checked)} className="h-4 w-4 accent-[var(--brand)]" /> Conservar mis listas de vocabulario y palabras difíciles
        </label>
        <Callout tone="warning" className="mt-4">
          Esta acción reinicia lecciones, módulos, evaluaciones, errores y repasos. El historial completo se conserva archivado y puedes exportarlo.
        </Callout>
      </Modal>

      <ConfirmDialog
        open={eraseOpen}
        title="¿Borrar todos los datos?"
        danger
        confirmLabel="Borrar definitivamente"
        onCancel={() => setEraseOpen(false)}
        onConfirm={async () => {
          await eraseAll();
          setEraseOpen(false);
          pushToast({ title: 'Datos borrados', tone: 'warning' });
        }}
      >
        Se eliminarán tu progreso, tu historial y los cursos archivados de este navegador. Esta acción no se puede deshacer.
      </ConfirmDialog>
    </div>
  );
}
