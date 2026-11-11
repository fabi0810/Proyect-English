# Arquitectura técnica

## 1. Resumen

SPA (Single Page Application) **100 % cliente**, ejecutable localmente, sin backend.

```
┌──────────────────────────── Navegador ─────────────────────────────┐
│  UI (React + Tailwind)                                             │
│   pages/  ──usa──►  components/  (presentación pura)               │
│      │                                                             │
│      ▼                                                             │
│  store/ (Zustand) ── acciones ──► services/  (lógica pura y probada)│
│      │                             ├─ exercises/  (corrección)      │
│      │                             ├─ evaluation/ (exámenes, notas) │
│      │                             ├─ progress/   (desbloqueo, logros, estadísticas)
│      │                             ├─ vocabulary/ (SM-2, quizzes)   │
│      │                             ├─ writing/    (corrector por reglas)
│      │                             ├─ speech/     (Web Speech API)  │
│      │                             ├─ content/    (carga + validación de JSON)
│      ▼                             └─ storage/    (IndexedDB, backup)│
│  IndexedDB  ◄── persistencia incremental por "slices" (debounce)   │
│  data/*.json ── contenido educativo (carga diferida por nivel)     │
└─────────────────────────────────────────────────────────────────────┘
```

Separación estricta:

| Capa | Responsabilidad | No debe |
|---|---|---|
| `data/` | Contenido educativo en JSON | Contener lógica |
| `types/` | Tipos TypeScript del dominio | — |
| `services/` | Lógica pura: corregir, ensamblar exámenes, calificar, programar repasos, persistir | Importar React |
| `store/` | Estado global y acciones (orquesta services) | Contener reglas pedagógicas complejas |
| `components/` | Presentación reutilizable | Leer/escribir almacenamiento directamente |
| `pages/` | Composición de pantallas por ruta | Duplicar lógica de services |

## 2. Stack y versiones (fijadas)

| Paquete | Versión | Motivo |
|---|---|---|
| react / react-dom | 19.1.x | Base de la UI |
| react-router | 7.x | Enrutado declarativo (`createHashRouter`) |
| vite + @vitejs/plugin-react | 7.3.x / 5.2.x | Dev server y build rápidos; `import.meta.glob` para contenido |
| typescript | 5.9.x | Tipado estricto (`strict: true`) |
| tailwindcss + @tailwindcss/vite | 4.1.x | Estilos utilitarios con *design tokens* en CSS (`@theme`) |
| zustand | 5.x | Estado global mínimo (~1 KB) con selectores; evita re-render global de Context |
| lucide-react | 0.577.x | Iconografía (solicitada) |
| recharts | 3.x | Gráficos de progreso (compatible con React 19 sin overrides) |
| @fontsource-variable/* | 5.x | Fuentes empaquetadas (Plus Jakarta Sans, JetBrains Mono, Playfair Display): funcionan **sin conexión** |
| vitest | 3.2.x | Pruebas unitarias de lógica y validación de contenido |

Se eligieron las últimas versiones de líneas mayores **estables y conocidas** (no las majors más
recientes publicadas este año) para minimizar riesgos de API. No hay más dependencias de ejecución.

**Dependencias descartadas:** Redux (excesivo), Immer (actualizaciones inmutables manuales bastan),
Dexie/idb (un *wrapper* propio de ~100 líneas sobre IndexedDB es suficiente), librerías de UI
(componentes propios con Tailwind), i18n (UI en español; el contenido define su propio idioma).

## 3. Estructura de carpetas

```
english-learning-platform/
├── docs/                          Documentación de diseño
├── public/
│   └── audio/                     Grabaciones reales opcionales (con licencia), referenciadas desde JSON
├── scripts/
│   └── validate-content.ts        (vía vitest) validación completa del contenido
├── src/
│   ├── app/
│   │   ├── App.tsx                Puerta de hidratación + RouterProvider
│   │   ├── routes/router.tsx      Definición de rutas (hash router)
│   │   └── providers/             Hidratación del store, aviso multipestaña, temporizador de estudio
│   ├── components/
│   │   ├── ui/                    Primitivas: Button, Card, Badge, ProgressBar, Tabs, Modal, Pill…
│   │   ├── layout/                AppShell, Sidebar, Topbar, PageHeader
│   │   ├── navigation/            Breadcrumbs, LevelSwitcher, Stepper
│   │   ├── dashboard/             Tarjetas del dashboard
│   │   ├── lessons/               Renderizado de bloques teóricos, tablas, comparaciones
│   │   ├── exercises/             Un componente por tipo + ExercisePlayer + FeedbackPanel
│   │   ├── evaluations/           ExamRunner, ExamReview, AttemptsTable
│   │   ├── vocabulary/            Flashcard, WordRow, ListManager
│   │   ├── reading/               ReadingViewer, WordPopover
│   │   ├── listening/             AudioPlayer (TTS), VoicePicker
│   │   ├── writing/               WritingEditor, CorrectionReport, DiffView
│   │   └── progress/              Gráficos, AchievementCard
│   ├── pages/                     Dashboard, Courses, Module, Lesson, Grammar, Vocabulary, Reading,
│   │                              Listening, Writing, Translation, Practice, Mistakes, Evaluations,
│   │                              History, Achievements, Diagnostic, Settings
│   ├── data/
│   │   ├── curriculum/
│   │   │   ├── levels.json        Definición de niveles (descriptores MCER, objetivos)
│   │   │   ├── A1/ index.json     Manifiesto del nivel (orden de módulos, examen final)
│   │   │   │   └── a1-01-*.json   Un archivo por módulo (lecciones + banco de ejercicios)
│   │   │   ├── A2/ B1/ B2/
│   │   ├── vocabulary/            A1.json, A2.json…
│   │   ├── readings/              A1.json…  (lecturas de la biblioteca)
│   │   ├── listening/             A1.json…
│   │   ├── writing/               A1.json…  (tareas de escritura)
│   │   ├── translation/           A1.json…
│   │   ├── exams/                 A1.json…  (pools exclusivos de examen final: lecturas, audios, escritura)
│   │   ├── diagnostic/            placement.json
│   │   └── errors/                catalog.json (catálogo de errores gramaticales)
│   ├── hooks/                     useSpeech, useStudyTimer, useContent…
│   ├── services/
│   │   ├── content/               Carga diferida, índice de ejercicios, validación de esquema
│   │   ├── exercises/             Normalización, patrones de respuesta, corrección por tipo
│   │   ├── evaluation/            Ensamblado de exámenes, escala 1–5, análisis de intentos
│   │   ├── progress/              Desbloqueo, estadísticas, logros, informe académico
│   │   ├── vocabulary/            SM-2, generación de quizzes de vocabulario
│   │   ├── writing/               Corrector por reglas, análisis de textos
│   │   ├── speech/                Envoltorio de SpeechSynthesis y voces
│   │   └── storage/               IndexedDB, fallback, migraciones, backup
│   ├── store/                     useAppStore (Zustand) + acciones
│   ├── types/                     content.ts, exercise.ts, progress.ts
│   ├── utils/                     random con semilla, fechas, texto, ids
│   └── styles/                    index.css (Tailwind + tokens claro/oscuro)
└── tests/ (junto al código como *.test.ts)
```

Diferencias justificadas respecto a la propuesta inicial:
- `components/ui/` añade primitivas reutilizables (evita duplicar estilos).
- `store/` separado de `hooks/`: el estado global es una pieza central, no un hook más.
- `services/content/`, `services/exercises/` y `services/writing/`: separan carga de contenido,
  corrección de ejercicios y corrección de escritura (cada uno con pruebas propias).
- `data/exams/` y `data/errors/`: pools exclusivos de examen (evita memorizar lecturas de la biblioteca)
  y catálogo reutilizable de errores (feedback consistente y "errores frecuentes").

## 4. Enrutado

`createHashRouter` (URLs `#/ruta`). Motivo: funciona en cualquier servidor estático (incluido
`vite preview` o GitHub Pages) sin configurar *rewrites*. Rutas:

| Ruta | Página |
|---|---|
| `/` | Dashboard |
| `/courses`, `/courses/:level` | My Courses (mapa de niveles y módulos) |
| `/module/:moduleId` | Vista del módulo (lecciones + evaluación) |
| `/lesson/:lessonId` | Reproductor de lección (pasos A–I) |
| `/grammar`, `/grammar/:lessonId` | Libro de gramática |
| `/vocabulary`, `/vocabulary/review`, `/vocabulary/quiz` | Biblioteca, tarjetas SM-2, quiz |
| `/reading`, `/reading/:id` | Biblioteca de lecturas y lector |
| `/listening`, `/listening/:id` | Comprensión auditiva |
| `/writing`, `/writing/:taskId` | Laboratorio de escritura |
| `/translation` | Entrenador de traducción |
| `/practice` | Práctica personalizada y adaptativa |
| `/mistakes` | My Mistakes |
| `/evaluations`, `/evaluations/run/:evalId`, `/evaluations/result/:attemptId` | Evaluaciones |
| `/history` | Historial académico e informe |
| `/achievements` | Logros |
| `/diagnostic` | Diagnóstico inicial |
| `/settings` | Configuración, copia de seguridad y reinicio |

Las páginas se cargan con `lazy()` (división de código por ruta).

## 5. Contenido educativo

- **Formato:** JSON por nivel y módulo. Tipos en `src/types/content.ts`.
- **Descubrimiento automático:** `import.meta.glob('src/data/curriculum/*/*.json')`. Añadir un módulo =
  crear su archivo y listarlo en el `index.json` del nivel.
- **Carga diferida:** los manifiestos (`levels.json`, `*/index.json`) se cargan al inicio; los módulos,
  lecturas, vocabulario, etc. se cargan bajo demanda y se cachean en memoria.
- **Inyección de contexto:** el cargador añade `level`, `module` y `lesson` a cada ejercicio (no se
  repiten en el JSON) y aplica valores por defecto (`points: 1`, instrucción por tipo).
- **Validación:** `services/content/validate.ts` comprueba esquema, IDs únicos, referencias (lecciones,
  catálogo de errores, vocabulario), coherencia de respuestas (índice correcto existente, opciones
  distintas, número de huecos, que las fichas de "ordenar palabras" formen una respuesta aceptada,
  patrones expandibles), tamaño mínimo de bancos de evaluación y cobertura por lección. Se ejecuta en
  `npm test`. Los tests verifican estructura y coherencia; **no** sustituyen la revisión lingüística.

## 6. Estado y persistencia

### 6.1 Store

Un único store Zustand (`store/useAppStore.ts`) con el objeto `UserData` (ver
[DATA_MODEL.md](DATA_MODEL.md)) y acciones de dominio:
`recordAnswer`, `completeLessonStep`, `submitLessonQuiz`, `startExam`, `saveExamAnswer`,
`submitExam`, `reviewCard`, `saveWriting`, `completeReading`, `flagItem`, `updateSettings`,
`importBackup`, `resetCourse`… Cada acción delega en funciones puras de `services/` y produce un
nuevo estado inmutable.

### 6.2 IndexedDB por *slices*

- Base `english-learning-platform`, almacenes `kv` (un registro por *slice* de `UserData`) y
  `archives` (historiales archivados al reiniciar).
- Un suscriptor del store compara referencias de cada clave de primer nivel (`prev[k] !== next[k]`) y
  marca *slices* sucios; se escriben con *debounce* de 400 ms y de inmediato al ocultar la pestaña
  (`visibilitychange`/`pagehide`).
- **Fallback:** si IndexedDB no está disponible → `localStorage` por *slice*; si tampoco → memoria con
  aviso permanente ("tu progreso no se guardará").
- `schemaVersion` + migraciones encadenadas al cargar y al importar.
- Aviso si la app está abierta en dos pestañas (`BroadcastChannel`) para evitar escrituras cruzadas.

### 6.3 Copia de seguridad

Exportar: archivo `english-platform-backup-YYYY-MM-DD.json` con `{ app, schemaVersion, exportedAt,
data, archives }`. Importar: validación de estructura, migración, resumen previo y confirmación.

## 7. Audio

- `services/speech/tts.ts`: envoltorio de `speechSynthesis` con cola, cancelación, velocidad
  (0.6×–1.2×), selección de voz por acento (`en-US`, `en-GB`, `en-AU`, `en-IN`…) y asignación de voces
  distintas por hablante en diálogos.
- Detección de capacidades: si no hay voces en inglés se avisa y se ofrece la transcripción.
- Grabaciones reales: cualquier ítem puede declarar `audioUrl` (archivo en `public/audio/` o URL con
  licencia compatible) y `audioCredit`; el reproductor prioriza el archivo y usa TTS como respaldo.

## 8. Corrección de escritura sin IA

`services/writing/` implementa un analizador determinista:
- Reglas gramaticales frecuentes en hispanohablantes (sujeto omitido, `-s` de tercera persona,
  `I have 20 years`, `a/an`, `he don't`, `did + pasado`, `can + to`, comparativos dobles, mayúsculas,
  puntuación, falsos amigos…), cada una con explicación en español y corrección sugerida.
- Métricas: número de palabras, oraciones, conectores usados, estructuras objetivo detectadas,
  vocabulario del nivel, requisitos de contenido de la tarea.
- Conserva **original**, **versión corregida automáticamente** y **reescritura del estudiante**, con
  vista de diferencias.
- Limitación documentada: un corrector por reglas no detecta todos los errores; la interfaz lo indica.

## 9. Inteligencia artificial (opcional, futura)

Interfaz `TutorProvider` con implementación por defecto **sin IA**. Una implementación opcional
podrá llamar a un **proxy local** (`server/ai-proxy`, Node) que lea la clave desde `.env` y nunca la
envíe al navegador. Las funciones educativas principales nunca dependerán de ella.

## 10. Calidad

- `tsc --noEmit` estricto, `vite build` sin advertencias críticas.
- Vitest: normalización y patrones de respuesta, corrección por tipo, escala 1–5, ensamblado de
  exámenes (sin repetidos, rotación entre intentos, cobertura), SM-2, logros, migraciones y
  **validación de todo el contenido**.
- Prueba de humo con Playwright (Chromium preinstalado) recorriendo rutas principales sin errores de
  consola.

## 11. Ejecución

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # genera dist/
npm run preview    # sirve dist/
npm test           # pruebas + validación de contenido
```
