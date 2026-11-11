# Diseño visual y experiencia de usuario

## 1. Análisis de las referencias visuales

| Aspecto | 1 · lingua.com (lectura) | 2 · Feedback de ejercicio | 3 · mondly (dashboard) | 4 · Flashcards |
|---|---|---|---|---|
| Colores | Blanco + gris claro; acento coral (#E8574F) en insignias "Question N" | Fondo #F3F4F6; azul primario (#3B82F6) en CTA; rojo/verde semánticos sobre fondos pálidos; naranja de advertencia | Fondo gris lavanda (#EEEFF3); violeta (#7C3AED) como color de curso; negro en navegación activa y CTA; verde/naranja/violeta para niveles por destreza; amarillo en progreso | Fondo #F7F8FA; tarjeta azul marino en degradado (#0F1B33 → #1E4B8F); verde esmeralda (#0E9F6E) para "Know it" |
| Distribución | Dos columnas: texto + audio / preguntas | Tarjeta única centrada con cabecera (chip de tema + progreso) | Rejilla de tarjetas 2/3 + 1/3 | Columna centrada: contadores → tarjeta → acciones → filtros |
| Tipografía | Sans humanista, títulos semibold | Sans (Inter-like), respuestas en monoespaciada | Sans geométrica (tipo Plus Jakarta / Urbanist); contraste gris/negro en el saludo | Serif display para la palabra; mono para etiquetas y cifras |
| Menús | Pestañas (Reading, Listening, Dictation, Grammar, Vocabulary) | — | Navegación en píldora; activo negro | Píldoras de filtro |
| Tarjetas | Bordes suaves, opciones con letra a/b/c/d en cuadrícula 2×2 | Radio ~16 px, borde fino, panel interno gris claro | Radio ~24 px, sin sombra marcada, fondos internos grises | Radio ~16–20 px, contadores con borde |
| Componentes | Reproductor (pausa, rebobinar, tiempo, barra, volumen, velocidad ±) y selector de voces con acento | Bandera de reporte, "1/10" + barra, chips de respuesta, "Review your mistakes", "Read explanation", botón ancho "Next Question" | Selector de idioma segmentado, tarjeta de curso con progreso, bloques bloqueados con candado, "Coming soon" punteado, racha semanal, tareas diarias con minutos, tabla con insignias de nivel y porcentaje | Contadores, tarjeta volteable, botones contorno/relleno, filtros "Adaptive ✦" |
| Jerarquía | Título → texto → audio; pregunta → opciones | Instrucción en negrita grande → oración → feedback → CTA | Saludo grande → tarjetas → métricas grandes (143, B1) | Cifras → palabra → acción |

### Síntesis aplicada

- **Base neutra fría** (gris lavanda muy claro) con **tarjetas blancas muy redondeadas** (mondly).
- **Negro tinta** para navegación activa y CTA principales (mondly); **violeta** como color de marca y
  del curso; **azul** para información/explicaciones (ref. 2); **verde** para correcto/"lo sé" (ref. 2 y 4);
  **rojo** para incorrecto; **naranja/ámbar** para advertencias y rachas; **coral** para numerar preguntas
  de lectura (ref. 1).
- **Tres familias tipográficas** con roles claros: sans geométrica para UI, serif para palabras/títulos
  de lectura, mono para respuestas, cifras y etiquetas técnicas.
- Patrones concretos reutilizados: opciones a/b/c/d (ref. 1), panel de feedback (ref. 2), tarjeta de
  curso + nivel + racha + tareas (ref. 3), flashcards y filtros en píldoras (ref. 4).
- Tono **adulto y educativo**: sin mascotas, sin colores saturados en grandes superficies, sin
  animaciones infantiles.

## 2. Tokens de diseño

Definidos como variables CSS (`src/styles/index.css`) y expuestos a Tailwind con `@theme`. El tema
oscuro redefine las mismas variables.

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--bg` | #F2F3F7 | #0E1015 | Fondo de la app |
| `--surface` | #FFFFFF | #171A21 | Tarjetas |
| `--surface-2` | #F6F7FA | #1E222B | Paneles internos, filas, inputs |
| `--border` | #E6E8EE | #2A2F3A | Bordes |
| `--ink` | #0F1115 | #F3F4F6 | Texto principal, CTA negro |
| `--muted` | #6B7280 | #9CA3AF | Texto secundario |
| `--brand` | #7C3AED | #A78BFA | Marca, curso, foco |
| `--brand-soft` | #F1EBFF | #2A2140 | Fondos de marca |
| `--info` / `--info-soft` | #2563EB / #EAF1FF | #60A5FA / #172338 | Explicaciones, chips de tema |
| `--success` / `--success-soft` | #059669 / #E7F8F0 | #34D399 / #12291F | Correcto |
| `--danger` / `--danger-soft` | #DC2626 / #FDECEC | #F87171 / #331A1A | Incorrecto |
| `--warning` / `--warning-soft` | #EA580C / #FFF1E7 | #FB923C / #33231A | Advertencias, rachas |
| `--coral` | #E8574F | #F2837D | Numeración de preguntas de lectura |
| Niveles | A1 #0EA5E9 · A2 #F97316 · B1 #7C3AED · B2 #10B981 | versiones claras | Insignias y barras por nivel |

**Radios:** tarjetas 24 px (`rounded-3xl`), elementos internos 16 px, chips/píldoras 999 px.
**Sombras:** mínimas (`0 1px 2px rgb(16 24 40 / .04)`); la profundidad se logra con contraste de fondos.
**Espaciado:** escala de 4 px; padding de tarjetas 20–24 px; separación de rejilla 16–20 px.

### Tipografía

| Rol | Fuente | Ejemplo |
|---|---|---|
| UI y textos | Plus Jakarta Sans (variable) | Botones, párrafos, títulos de tarjeta |
| Display / palabras | Playfair Display | Palabra en flashcard, título de lectura |
| Mono | JetBrains Mono | Respuestas evaluadas, contadores, IPA, etiquetas |

Escala: 12 / 13 / 14 / 16 / 18 / 22 / 28 / 36 / 48 px. Los saludos usan el contraste gris + negro de
la referencia 3 ("Welcome back, **Ana**").

## 3. Estructura visual

```
┌────────────┬──────────────────────────────────────────────────────┐
│  Sidebar   │  Topbar: título de página · buscador · nivel · ajustes│
│  (260 px)  ├──────────────────────────────────────────────────────┤
│  Dashboard │                                                      │
│  My Courses│                Área principal                        │
│  Grammar   │        (máx. 1 200 px, rejilla de tarjetas)          │
│  Vocabulary│                                                      │
│  Reading   │                                                      │
│  Listening │                                                      │
│  Writing   │                                                      │
│  Translation│                                                     │
│  Practice  │                                                      │
│  My Mistakes│                                                     │
│  Evaluations│                                                     │
│  History   │                                                      │
│  Achievements│                                                    │
│  ───────── │                                                      │
│  Settings  │                                                      │
└────────────┴──────────────────────────────────────────────────────┘
```

- Ítem activo del menú: píldora negra con texto blanco (ref. 3). Insignias numéricas (errores
  pendientes, palabras para repasar).
- **Móvil (< 1024 px):** el menú se convierte en cajón deslizante con botón de hamburguesa; las
  rejillas pasan a una columna; los ejercicios ocupan el ancho completo; botones de acción fijos abajo.

## 4. Pantallas

| Pantalla | Composición |
|---|---|
| **Dashboard** | Saludo · selector de nivel segmentado · tarjeta "Continuar" (violeta, progreso de lección) · tarjeta de nivel con barras por destreza · racha de actividad (7 días) · tareas de hoy (repasar palabras, aprender palabras, errores, lección) con CTA negro · progreso general y por nivel · calificación promedio · actividad reciente · temas pendientes · errores frecuentes · últimas evaluaciones · logros recientes |
| **My Courses** | Pestañas A1/A2/B1/B2, tarjeta de nivel (descriptor MCER), lista de módulos con estado (bloqueado 🔒, disponible, en curso, aprobado con nota), "En preparación" con borde punteado para módulos sin contenido |
| **Módulo** | Objetivos, lecciones con estado, evaluación del módulo (intentos y nota vigente), botón "Presentar evaluación" |
| **Lección** | Stepper A–I; bloques de teoría (reglas con fórmula, tablas, ejemplos con audio, correcto/incorrecto en rojo/verde, avisos de excepción), práctica con feedback, resumen, evaluación |
| **Ejercicio** | Cabecera: chip del tema · bandera "Reportar" · `3/10` + barra. Instrucción grande en negrita. Respuesta. Panel de feedback con respuesta errónea (rojo) vs correcta (verde), explicación, etiqueta de regla, "Leer explicación". CTA ancho "Siguiente" |
| **Examen** | Navegador de preguntas (cuadrícula de números, marcadas para revisar), sin feedback, autoguardado, entrega con confirmación |
| **Resultados** | Nota grande 1.0–5.0, aprobado/no aprobado, % y errores, secciones, temas dominados/pendientes, recomendaciones, revisión ítem por ítem |
| **Vocabulary** | Contadores (Aprendidas / Aprendiendo / Por repasar), filtros en píldoras (Adaptativo ✦, Nuevas, Difíciles, Mis listas…), tabla de palabras con audio, flashcard oscura con palabra en serif |
| **Reading** | Dos columnas (ref. 1): texto con palabras tocables, verbos resaltables, traducción por oración, reproductor; preguntas con insignias coral y opciones a/b/c/d |
| **Listening** | Reproductor con velocidad, selector de voz/acento, transcripción ocultable, preguntas |
| **Writing** | Consigna con requisitos, editor con contador, informe: puntuación por criterio, errores con explicación, original vs corregido (diff), reescritura |
| **Translation** | Fuente, campo de traducción, comparación palabra a palabra, alternativas válidas, notas literal vs natural |
| **My Mistakes** | Resumen por tipo de error, lista filtrable, "Repasar errores" |
| **History** | Tabla de intentos (Evaluación · Intento · Nota · Resultado · Fecha), gráfico de notas, tiempo de estudio, informe académico |
| **Achievements** | Rejilla de logros con estado bloqueado/desbloqueado y fecha |
| **Settings** | Calificación (nota mínima, exigencia, mínimos de sección), progresión estricta, voz y velocidad, tema, meta diaria, copia de seguridad, reinicio |

## 5. Componentes reutilizables

`Button` (primary negro, brand, secondary, ghost, danger; tamaños sm/md/lg) · `Card` · `Badge`/`Chip` ·
`LevelBadge` · `ProgressBar` · `ProgressRing` · `SegmentedControl` · `Pill` (filtros) · `Tabs` ·
`Modal`/`ConfirmDialog` · `EmptyState` · `Stat` (cifra + etiqueta) · `Stepper` · `Callout`
(tip/aviso/excepción) · `AnswerChip` (correcta/incorrecta, mono) · `OptionButton` (letra a/b/c/d) ·
`SpeakButton` · `AudioPlayer` · `Markdown` ligero seguro · `DiffView`.

## 6. Interacción y accesibilidad

- Todo operable con teclado: opciones con teclas `1–4` / `a–d`, `Enter` para comprobar/siguiente,
  fichas de "ordenar palabras" como botones (sin arrastrar obligatorio).
- Foco visible (anillo violeta), contraste AA, `aria-live` para el resultado de cada respuesta.
- Estados vacíos con siguiente acción clara; nada de botones decorativos.
- Movimiento reducido respetado (`prefers-reduced-motion`).
- Mensajes en español natural; enunciados en inglés progresivamente según el nivel.
