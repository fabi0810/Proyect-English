# English Learning Platform — Visión general del proyecto

> Plataforma personal, local e interactiva para aprender inglés desde **A1** hasta **B2** (MCER).
> Combina curso estructurado, libro de gramática, biblioteca de vocabulario con repetición espaciada,
> lecturas graduadas, comprensión auditiva, laboratorio de escritura, entrenador de traducción,
> profesor virtual de errores, evaluaciones exigentes e historial académico completo.

---

## 1. Propósito

Construir la herramienta **principal** de aprendizaje de inglés de un estudiante hispanohablante.
No es una demo ni una página estática: cada pantalla debe **enseñar, practicar, evaluar, corregir y
registrar** progreso real.

Principios rectores:

1. **Comprender, no memorizar.** Toda respuesta incorrecta recibe una explicación en español: por qué
   la correcta lo es y por qué cada distractor falla.
2. **Progresión real.** No se avanza de módulo ni de nivel sin aprobar su evaluación.
3. **Exigencia honesta.** Exámenes aleatorios a partir de bancos amplios; un intento nuevo usa
   preguntas distintas; las respuestas no se muestran hasta finalizar.
4. **Español → inglés progresivo.** A1 explica todo en español; B2 explica mayoritariamente en inglés
   con apoyo en español opcional.
5. **Local y privado.** Todo funciona sin servidor, sin cuentas y sin APIs de pago. El progreso vive en
   el navegador (IndexedDB) y se puede exportar/importar.
6. **Extensible durante años.** El contenido es **datos JSON** validados; añadir un módulo, una
   lectura o un ejercicio no requiere tocar código.

## 2. Competencias que desarrolla

| Competencia | Cómo se trabaja |
|---|---|
| Grammar | Lecciones con teoría, tablas, comparaciones correcto/incorrecto, práctica y evaluación |
| Vocabulary | Biblioteca por nivel/categoría, tarjetas SM-2, listas personales, quizzes, uso en lecturas y exámenes |
| Reading | Lecturas graduadas con glosario, traducción por oración, identificación de verbos y tiempos, preguntas |
| Writing | Laboratorio de escritura con corrección por reglas, versión original vs. corregida, reescritura |
| Listening | Audios por síntesis de voz (Web Speech API) con varias voces/acentos y velocidades; soporte para grabaciones reales |
| Sentence Construction | Ordenar palabras, construir oraciones a partir de pistas, combinar oraciones con conectores |
| Translation | Traducción EN↔ES con respuestas alternativas válidas, comparación palabra a palabra y notas literal vs. natural |
| Language Comprehension | Explicaciones del "porqué" del idioma, catálogo de errores, identificación de tiempos verbales |

## 3. Alcance funcional

- **My Courses**: mapa A1 → B2, módulos con lecciones (estructura pedagógica A–I), evaluación de módulo
  y examen final integral por nivel.
- **Grammar**: libro interactivo de gramática navegable y con buscador (siempre accesible como referencia).
- **Vocabulary**: biblioteca, tarjetas con repetición espaciada, palabras difíciles, listas personales,
  práctica de traducción, reconocimiento, escritura y escucha.
- **Reading / Listening / Writing / Translation**: laboratorios independientes por nivel.
- **Practice**: sesiones personalizadas (por nivel, módulo, tipo de ejercicio, habilidad) y modo adaptativo.
- **My Mistakes**: cada error registrado, agrupado por tipo; sesiones de repaso hasta resolverlos.
- **Evaluations**: evaluaciones de módulo y finales de nivel con intentos ilimitados, exámenes distintos
  en cada intento y escala 1.0–5.0.
- **History**: historial académico completo (todos los intentos), tiempo de estudio, informe académico.
- **Achievements**: logros que dependen de acciones reales.
- **Diagnóstico inicial**: estima el nivel (A1–B2) sin sustituir las evaluaciones oficiales.
- **Configuración**: nota mínima, exigencia, progresión estricta, voz y velocidad, tema claro/oscuro,
  copia de seguridad (exportar/importar) y reinicio del curso con archivo del historial.

Fuera de alcance inicial (por decisión del proyecto): backend, autenticación, múltiples usuarios,
bases de datos de servidor (PostgreSQL, MongoDB, Firebase) y dependencias de APIs de pago.

## 4. Análisis de referencias

Los cuatro repositorios se clonaron y revisaron (README, licencia, estructura y código relevante) el
2026-11-07. **No se copió código**: se adaptan conceptos y se reimplementan desde cero.

| Repositorio | Licencia | Arquitectura | Conceptos que adoptamos | Lo que NO adoptamos |
|---|---|---|---|---|
| [ArtCC/freelingo](https://github.com/ArtCC/freelingo) (principal) | **AGPL-3.0** + licencia comercial | Next.js + FastAPI + PostgreSQL + Redis + LLM | Unidades con *competency checklist* (can-do), prerrequisitos explícitos entre unidades, tipos de lección por unidad, diagnóstico adaptativo determinista con opción "No lo sé" y posibilidad de ignorar la recomendación, examen de fin de nivel con recomendación, reglas de autoría de contenido (contexto suficiente para una sola respuesta, distractores plausibles, no presentar alternativas válidas como errores), juegos "Error Detective" (2 pasos: localizar y corregir), "Sentence Order" (varias órdenes aceptadas) y "Vocabulary Pairs" | Generación de lecciones con LLM, backend, cuentas, cuotas. Por ser AGPL no se reutiliza ninguna línea de código. |
| [JesusOrihuela/idiomap](https://github.com/JesusOrihuela/idiomap) | MIT | PWA estática sin build, `localStorage` | SM-2 simplificado con estados de dominio (*learning / practiced / mastered*), cola priorizando tarjetas vencidas, normalización de respuestas con expansión de contracciones y grupos de equivalencia, validadores de contenido (scripts que revisan esquema e IDs), recordatorio de copia de seguridad, todo local | Modelos TTS/STT en el navegador (~130 MB): usamos la Web Speech API nativa |
| [romaniso/easy-peasy-platform](https://github.com/romaniso/easy-peasy-platform) | "Educational Community License" declarada en `package.json`, sin archivo LICENSE | MERN (React + Express + MongoDB) | Hoja de referencia rápida junto a los ejercicios (*cheatsheet*), glosario personal alimentado desde las lecturas, variedad de tipos (dropdown, drag & drop, match headings, listen & type), filtrado por nivel | Backend, autenticación, MongoDB |
| [CuplexUser/LingoFlow](https://github.com/CuplexUser/LingoFlow) | MIT | React + Express + Postgres/SQLite | Mapa de conocimiento por habilidad (no iniciado / aprendiendo / débil / inestable / sabido / sólido), revisión de errores "los peores primero", autoguardado y reanudación de sesiones, `acceptedAnswers` que nunca se ofrecen como distractores, lector de historias con palabra tocable (significado + nota gramatical + audio) y "guardar para repasar", examen de unidad repartido entre habilidades, panel de cobertura de contenido | Backend, TTS de pago, cuentas |

### Fuentes académicas

- **MCER / CEFR (Consejo de Europa)** — descriptores globales y "can-do" por destreza para A1–B2 (volumen
  complementario 2020). Se usan para los objetivos de cada nivel y la distribución de contenidos.
- **British Council — LearnEnglish** — organización de la gramática en bloques A1–A2 y B1–B2, y
  secciones de Grammar, Vocabulary, Reading, Listening y Writing.

> **Limitación de esta sesión:** la política de red del entorno bloqueó `www.coe.int` y
> `learnenglish.britishcouncil.org`, por lo que no fue posible leer esas páginas en vivo. La alineación
> curricular se basa en el conocimiento establecido de los descriptores globales del MCER y de la
> organización temática de British Council (confirmada por búsqueda: secciones
> [A1-A2 grammar](https://learnenglish.britishcouncil.org/free-resources/grammar/a1-a2) y
> [B1-B2 grammar](https://learnenglish.britishcouncil.org/free-resources/grammar/b1-b2)).
> Si se permiten esos dominios en la configuración de red, conviene hacer una revisión cruzada.

## 5. Referencias visuales

Se analizaron las cuatro imágenes aportadas (detalle en [UI_DESIGN.md](UI_DESIGN.md)):

1. **lingua.com – lectura**: texto + reproductor con selección de voces/acentos a la izquierda; preguntas
   con opciones a/b/c/d en cuadrícula 2×2 a la derecha.
2. **Tarjeta de feedback**: chip de tema, barra de progreso `1/10`, respuesta errónea en rojo y correcta
   en verde (monoespaciada), panel "Review your mistakes" con etiqueta de regla y botón "Read explanation".
3. **mondly – dashboard**: fondo gris suave, tarjetas blancas muy redondeadas, navegación tipo píldora
   con activo en negro, tarjeta de curso violeta, nivel con barras por destreza, racha de actividad,
   tareas diarias y CTA negro.
4. **Tarjetas de vocabulario**: contadores (Know it / Still learning / Remaining), tarjeta oscura con
   palabra en serif, botones "Still learning" / "Know it" y filtros en píldoras (Adaptive, Unseen…).

## 6. Usuario y contexto

- Un único estudiante hispanohablante, uso personal, escritorio y móvil (diseño responsive).
- Variedad de referencia: **inglés americano** (ortografía, pronunciación orientativa en IPA y voz por
  defecto `en-US`), señalando diferencias británicas relevantes.
- Escala de calificación académica **1.0–5.0** con aprobación inicial en **3.0** (configurable).

## 7. Criterios de éxito

- El estudiante puede recorrer A1 completo: lecciones → práctica → evaluaciones → examen final A1.
- Cada ejercicio tiene respuesta verificada o criterios explícitos, y retroalimentación didáctica.
- El progreso sobrevive a recargas y cierres; se puede exportar e importar.
- `npm run build`, `npm test` y el validador de contenido pasan sin errores; sin errores en consola.
- Añadir contenido nuevo = añadir/editar JSON + pasar el validador.

## 8. Documentos relacionados

- [ARCHITECTURE.md](ARCHITECTURE.md) — arquitectura técnica.
- [CURRICULUM.md](CURRICULUM.md) — organización académica A1–B2.
- [ASSESSMENT_SYSTEM.md](ASSESSMENT_SYSTEM.md) — motor de ejercicios, retroalimentación y evaluaciones.
- [DATA_MODEL.md](DATA_MODEL.md) — modelos de datos y persistencia local.
- [UI_DESIGN.md](UI_DESIGN.md) — sistema visual y experiencia de usuario.
- [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md) — etapas y prioridades.
