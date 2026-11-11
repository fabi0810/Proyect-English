# English Learning Platform (A1 → B2)

Plataforma personal e interactiva para aprender inglés desde A1 hasta B2 (MCER). Funciona **100 % en el
navegador**, sin servidor ni cuentas: el progreso se guarda en IndexedDB y se puede exportar e importar.

## Puesta en marcha

Requisitos: Node.js 20.19+ (probado con Node 22).

```bash
npm install
npm run dev        # http://localhost:5173
```

Otros comandos:

```bash
npm run build      # tsc + build de producción en dist/
npm run preview    # sirve dist/ (http://localhost:4173)
npm test           # pruebas del motor + validación de TODO el contenido
```

> `.npmrc` activa `legacy-peer-deps` porque npm 10.9 falla al resolver los peerDependencies opcionales de
> vitest 4. Todas las dependencias pares necesarias (react, react-dom, react-is, vite) están declaradas.

## Qué incluye

| Sección | Estado |
|---|---|
| Dashboard, My Courses, Grammar, Vocabulary (SM-2), Reading, Listening, Writing, Translation, Practice, My Mistakes, Evaluations, History, Achievements, Diagnóstico, Settings | ✅ Funcionales |
| Motor de ejercicios (15 tipos), retroalimentación por opción, catálogo de errores | ✅ |
| Evaluaciones de lección, módulo y examen final de nivel; escala 1.0–5.0; intentos ilimitados con preguntas nuevas | ✅ |
| Persistencia IndexedDB + exportar/importar copia + reinicio del curso con archivo del historial | ✅ |
| Contenido A1: módulos con lecciones A–I | 🟡 ver `docs/DEVELOPMENT_ROADMAP.md` |
| Recursos A1: vocabulario (363), 8 lecturas, 8 audios, 6 tareas de escritura, 26 traducciones, pools del examen final | ✅ |
| Diagnóstico A1–B2 (48 preguntas) | ✅ |
| Contenido A2, B1, B2 | ⬜ estructura definida; contenido pendiente |

Los módulos sin contenido aparecen como **«En preparación»** y no se pueden abrir.

## Estructura

```
docs/            Documentación de diseño (visión, arquitectura, currículo, evaluación, datos, UI, roadmap)
src/app/         App, router (hash) y proveedores
src/components/  UI reutilizable: ejercicios, evaluaciones, lecciones, audio, escritura…
src/pages/       Una carpeta por sección
src/data/        Contenido educativo en JSON (curriculum, vocabulary, readings, listening, writing,
                 translation, exams, diagnostic, errors, topics)
src/services/    Lógica pura: corrección, evaluaciones, progreso, SM-2, escritura, voz, almacenamiento
src/store/       Estado global (Zustand) con persistencia incremental
```

## Añadir contenido

1. Crea `src/data/curriculum/<NIVEL>/<id>-<slug>.json` con la estructura de `docs/DATA_MODEL.md`
   (usa cualquier módulo de A1 como plantilla).
2. En `src/data/curriculum/<NIVEL>/index.json` cambia el módulo a `"status": "ready"` e indica `"lessons"`.
3. Ejecuta `npm test`: el validador comprueba estructura, referencias, tamaños de los bancos y que **cada
   ejercicio se califique como correcto con su propia clave**.

## Audio

Se usa la síntesis de voz del navegador (Web Speech API). La calidad y los acentos dependen de las voces
instaladas en el sistema (Chrome y Edge incluyen varias). Para usar grabaciones reales, coloca los archivos
en `public/audio/` y añade `audioUrl` (y `audioCredit` con la licencia) a la actividad.

## Privacidad

No hay servidor: nada sale del navegador. Exporta una copia de seguridad (Settings) con regularidad.
