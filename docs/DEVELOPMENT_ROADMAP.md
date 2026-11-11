# Hoja de ruta de desarrollo

Estado: ✅ hecho · 🟡 en curso · ⬜ pendiente

## Fase 1 — Investigación y planificación ✅

- ✅ Inspección del proyecto (vacío) y de las 4 imágenes de referencia.
- ✅ Análisis de FreeLingo (AGPL-3.0), Idiomap (MIT), Easy Peasy (ECL declarada) y LingoFlow (MIT). No se copió código.
- ✅ Alineación con MCER y British Council (sus sitios estaban bloqueados por la red de la sesión: revisión cruzada pendiente).
- ✅ Currículo revisado A1–B2, arquitectura, modelo de datos, sistema de evaluación y diseño visual.

## Fase 2 — Diseño ✅

- ✅ Sistema visual (tokens claro/oscuro, tipografías locales, componentes) a partir de las referencias.
- ✅ Navegación y pantallas (ver UI_DESIGN.md).

## Fase 3 — Núcleo de la aplicación ✅

| Tarea | Estado |
|---|---|
| Vite 7 + React 19 + TypeScript estricto + Tailwind 4 + fuentes locales | ✅ |
| Router con hash, layout responsive (sidebar/cajón móvil), páginas con carga diferida | ✅ |
| Tipos de contenido y de progreso | ✅ |
| Persistencia IndexedDB por slices + fallback localStorage/memoria + migraciones | ✅ |
| Exportar / importar copia de seguridad | ✅ |
| Temporizador de estudio, actividad diaria y racha | ✅ |
| Aviso de app abierta en varias pestañas | ✅ |

## Fase 4 — Motor y contenido A1

| Tarea | Estado |
|---|---|
| Normalización (contracciones, tildes, a.m./p.m.), patrones `{a\|b}` `[x]`, corrección de los 15 tipos | ✅ |
| Feedback por opción + catálogo de errores (75 tipos) + enlace a la teoría | ✅ |
| Reproductor de lecciones A–I con práctica guiada, independiente, resumen y evaluación | ✅ |
| Evaluaciones de lección, módulo y examen final; escala 1–5; intentos; rotación de preguntas | ✅ |
| Validador de contenido + prueba de autocoherencia (cada ítem correcto con su clave) | ✅ |
| Diagnóstico adaptativo A1–B2 (48 preguntas) | ✅ |
| Vocabulario A1 (363 entradas con IPA, ejemplo y notas) | ✅ (ampliable hacia ~450) |
| 8 lecturas, 8 actividades de listening, 6 tareas de escritura, 26 traducciones A1 | ✅ |
| Pools exclusivos del examen final A1 (3 lecturas, 3 audios, 10 traducciones, 3 escrituras) | ✅ |
| Módulos A1 con contenido completo | 🟡 ver tabla siguiente |

### Módulos A1

| # | Módulo | Estado |
|---|---|---|
| 1 | Introduction to English | ✅ |
| 2 | Personal Pronouns | ✅ |
| 3 | Verb To Be | ✅ |
| 4 | Numbers, Dates and Time | ✅ |
| 5 | Articles: A, An, The | ✅ |
| 6–20 | Singular and Plural Nouns … Basic Reading and Writing | ⬜ siguientes entregas (el examen final A1 se habilita cuando los 20 estén listos) |

## Fase 5 — Funcionalidades complementarias y niveles superiores

| Tarea | Estado |
|---|---|
| Repetición espaciada, listas personales, palabras difíciles, quiz de vocabulario | ✅ |
| My Mistakes con sesiones de repaso (resuelto tras 2 aciertos seguidos) | ✅ |
| Práctica personalizada y adaptativa | ✅ |
| Logros, historial académico, informe y reinicio del curso con archivo | ✅ |
| Laboratorio de escritura con corrector por reglas, versión corregida y reescritura | ✅ |
| Contenido A2 (25 módulos) | ⬜ |
| Contenido B1 (23 módulos) | ⬜ |
| Contenido B2 (25 módulos) | ⬜ |
| Grabaciones reales con licencia (CC0/CC-BY) en `public/audio` | ⬜ |
| Corrector ortográfico con diccionario (nspell + dictionary-en, carga diferida) | ⬜ |
| Reconocimiento de voz para pronunciación (opcional; Chrome envía el audio a servidores externos) | ⬜ |
| Tutor IA opcional vía proxy local (clave fuera del navegador) | ⬜ |

## Fase 6 — Evaluación y calidad (continua)

- ✅ 35 pruebas (motor, escala, ensamblado, SM-2, corrector, validación y autocoherencia del contenido).
- ✅ Prueba de humo con navegador: todas las rutas sin errores de consola; flujo práctica → evaluación → nota → recarga.
- ⬜ Revisión editorial humana de explicaciones y distractores (los tests no garantizan la corrección lingüística).

## Criterio de "módulo terminado"

Un módulo solo pasa a `status: "ready"` cuando tiene: todas sus lecciones con teoría A–I, práctica
guiada (≥ 4) e independiente (≥ 6) con feedback, pool de evaluación de lección (≥ 8 por lección), pool
integrador, evaluación de módulo funcional (≥ 30 ítems elegibles) y pasa el validador. Los módulos sin
contenido se muestran como **«En preparación»**.

## Cómo añadir contenido

1. Crear `src/data/curriculum/<NIVEL>/<id>-<slug>.json` siguiendo DATA_MODEL.md.
2. En `src/data/curriculum/<NIVEL>/index.json`: `"status": "ready"` y `"lessons": <n>`.
3. Ejecutar `npm test`.
4. Para lecturas, audios, escritura, traducción o vocabulario: añadir entradas en el JSON del nivel.

## Registro de entregas

| Fecha | Entrega |
|---|---|
| 2026-11-07 | Documentación (7 documentos), aplicación completa, motor y evaluaciones, recursos A1, diagnóstico y módulos A1-01 a A1-05 |
