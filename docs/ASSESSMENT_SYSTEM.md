# Motor de ejercicios, retroalimentación y evaluaciones

## 1. Visión general

```
Ejercicio (JSON) ──► Componente de respuesta ──► Response ──► grade(exercise, response) ──► GradeResult
                                                                    │
                       ┌────────────────────────────────────────────┤
                       ▼                                            ▼
             FeedbackPanel (práctica)                     store.recordAnswer()
             o revisión final (examen)                    (estadísticas, errores, historial)
```

Todo el motor de corrección es **puro y determinista** (`src/services/exercises/`), probado con Vitest.

## 2. Tipos de ejercicio (15)

| # | Tipo (`type`) | Requisito cubierto | Respuesta del estudiante | Corrección |
|---|---|---|---|---|
| 1 | `multiple_choice` | Selección múltiple | índice | Exacta; feedback por opción |
| 2 | `fill_blank` | Completar espacios | texto por hueco (o elección si el hueco define `options`) | Patrones aceptados por hueco; crédito parcial por hueco |
| 3 | `word_order` | Ordenar palabras | secuencia de fichas | Oración reconstruida ∈ respuestas aceptadas |
| 4 | `sentence_building` | Construcción de oraciones | texto libre a partir de pistas | Patrones aceptados + diagnóstico de diferencias |
| 5 | `error_identification` | Identificación de errores | segmento elegido + corrección | 0,5 localizar + 0,5 corregir |
| 6 | `error_correction` | Corrección gramatical | oración reescrita | Patrones aceptados |
| 7 | `translation` (`en-es`) | Traducción inglés → español | texto | Patrones + tolerancia a tildes + conceptos clave |
| 8 | `translation` (`es-en`) | Traducción español → inglés | texto | Patrones + contracciones + tolerancia a erratas menores |
| 9 | `matching` | Relacionar columnas | pares | Crédito parcial por par |
| 10 | `true_false` | Verdadero o falso | booleano | Exacta |
| 11 | `reading_comprehension` | Comprensión lectora | grupo: texto + subpreguntas | Cada subpregunta se califica |
| 12 | `listening_comprehension` / `dictation` | Comprensión auditiva | grupo con audio / transcripción | Subpreguntas / precisión por palabra |
| 13 | `open_answer` | Respuestas abiertas | texto | Requisitos (regex) + longitud + corrector por reglas |
| 14 | `writing_task` | Escritura de párrafos | texto largo | Rúbrica automática (ver §7) |
| 15 | `tense_identification` | Identificar tiempos verbales | tiempo elegido | Exacta |

Cualquier ítem puede declarar `audio` (texto que se reproduce con TTS) o `audioUrl` (grabación);
con `hideText: true` se convierte en ejercicio de escucha.

### 2.1 Campos comunes

```ts
interface ExerciseBase {
  id: string;            // estable, único global: "a1-03-l2-q05"
  type: ExerciseType;
  topic: string;         // slug del tema: "be-negative"
  skill: Skill;          // grammar | vocabulary | reading | listening | writing | translation | construction | comprehension
  difficulty: 1 | 2 | 3; // básica | media | exigente
  prompt?: string;       // enunciado; si falta, se usa el predeterminado del tipo según el nivel
  explanation: string;   // explicación general (por qué la respuesta correcta lo es)
  errorTag?: string;     // error gramatical asociado (catálogo)
  points?: number;       // peso (1 por defecto)
  group?: string;        // ítems que prueban lo mismo: nunca coinciden en un examen
  // inyectados por el cargador: level, module, lesson, pool
}
```

### 2.2 Retroalimentación por opción

```json
{
  "type": "multiple_choice",
  "question": "She ___ to school every day.",
  "options": [
    { "text": "go", "why": "Con *she* (3.ª persona singular) el verbo lleva -s/-es: *goes*.", "error": "third-person-s" },
    { "text": "goes" },
    { "text": "going", "why": "La forma -ing necesita *be* (*is going*) y expresa algo en curso, no un hábito." },
    { "text": "went", "why": "*Went* es pasado; *every day* indica un hábito presente." }
  ],
  "answer": 1,
  "explanation": "El sujeto es SHE (tercera persona del singular). En presente simple el verbo añade -s o -es: go → goes."
}
```

## 3. Normalización y comparación de respuestas de texto

`services/exercises/normalize.ts`:

1. Minúsculas, apóstrofos tipográficos → `'`, guiones unificados.
2. Se eliminan signos (`. , ! ? ; : ¿ ¡ " ( )`) y espacios repetidos (la puntuación no se penaliza,
   salvo en el laboratorio de escritura, donde se comenta).
3. **Contracciones** expandidas a forma canónica (`don't → do not`, `I'm → i am`, `can't/cannot → cannot`,
   `won't → will not`…). Las ambiguas generan variantes (`he's → he is | he has`, `I'd → i would | i had`,
   `there's → there is | there has`). Se acepta si **alguna** variante del estudiante coincide con alguna
   variante aceptada.
4. Español (`en-es`): igual, y además comparación **sin tildes**; si solo difieren las tildes se acepta con
   nota ("Cuidado con la tilde en *está*").

### 3.1 Sintaxis de patrones de respuesta

Para declarar muchas respuestas válidas sin duplicarlas:

| Sintaxis | Significado | Ejemplo | Expande a |
|---|---|---|---|
| `{a\|b}` | alternativas | `I {usually\|normally} get up at 7` | 2 variantes |
| `[x]` | opcional | `I am 20 [years old]` | 2 variantes |
| anidado | combinable | `{It's\|It is} [very] cold [today]` | 8 variantes |

El validador limita la expansión (≤ 2 000 variantes por respuesta) y exige que la primera variante sea
una oración canónica (la que se muestra como "respuesta modelo").

### 3.2 Casi aciertos

- Distancia de Levenshtein sobre el texto normalizado y diferencias palabra a palabra.
- `fill_blank`, `error_correction`, `sentence_building`: **estrictos** (la forma es lo evaluado). Si la
  distancia es mínima se avisa "Casi: revisa la ortografía de *studies*", pero cuenta como incorrecto.
- `translation`: se acepta con nota si la única diferencia es una errata menor (≤ 1 carácter por palabra,
  máx. 1 palabra en oraciones de ≥ 5 palabras). Si contiene todos los **conceptos clave** pero la
  estructura no coincide: crédito parcial 0,5 y comparación con la respuesta más cercana.
- En **práctica** (nunca en exámenes) el estudiante puede marcar "Mi respuesta también es válida": se
  registra como *auto-aceptada* y el ítem se marca para revisión de contenido.

## 4. Sistema de retroalimentación

`GradeResult`:

```ts
interface GradeResult {
  score: number;            // 0..1
  verdict: 'correct' | 'accepted_with_note' | 'partial' | 'incorrect';
  expected: string;         // respuesta modelo
  responseText: string;     // respuesta del estudiante en texto
  messages: FeedbackMessage[]; // explicación de la correcta, del error concreto, notas
  errorTags: string[];      // para "My Mistakes" y "errores frecuentes"
  details?: unknown;        // p. ej. pares correctos, diff palabra a palabra
}
```

Capas de explicación (de más específica a más general):

1. **Explicación del error concreto** (`why` de la opción elegida o `feedback[respuesta]` del hueco).
2. **Catálogo de errores** (`data/errors/catalog.json`): título, explicación y ejemplo reutilizables
   (p. ej. `third-person-s`, `be-age`, `article-a-an`).
3. **Explicación general** del ítem.
4. **Enlace a la teoría** ("Leer explicación") → abre la lección y sección correspondientes.

Inspirado en la referencia visual 2: chip del tema, respuesta errónea en rojo y correcta en verde,
panel "Revisa tu error" y botón "Leer explicación".

## 5. Evaluaciones

### 5.1 Tipos

| Evaluación | Fuente de preguntas | Tamaño | Feedback |
|---|---|---|---|
| Evaluación de lección | Pool `quiz` de la lección | 6 | Al finalizar |
| Evaluación de módulo | Pools `quiz` de todas sus lecciones + pool integrador del módulo | 15 | Al finalizar |
| Examen final de nivel | Todos los módulos del nivel + vocabulario + pools exclusivos de examen | ~45 | Al finalizar |
| Diagnóstico | Banco de nivelación A1–B2 | 20–40 (adaptativo) | Al finalizar |

Durante una evaluación: sin respuestas ni explicaciones, navegación libre entre preguntas, marcar para
revisar, autoguardado (se puede reanudar tras recargar) y confirmación al entregar con preguntas sin
responder.

### 5.2 Ensamblado aleatorio (`services/evaluation/assemble.ts`)

Entrada: pool elegible, estadísticas de uso de cada ítem, intentos previos de esa evaluación, semilla.

1. **Cobertura:** cuota por lección/módulo proporcional al tamaño de su pool (mínimo 2 por lección
   cuando el tamaño lo permite).
2. **Frescura:** prioridad 0 = nunca usado en esta evaluación; 1 = visto solo en la evaluación de la
   lección; 2 = usado en intentos antiguos; 3 = usado en el último intento. Dentro de la misma prioridad,
   aleatorio con semilla.
3. **Dificultad:** mezcla objetivo ≈ 30 % básica, 45 % media, 25 % exigente.
4. **Variedad:** ningún tipo supera el 40 % del examen; al menos 3 tipos distintos si existen.
5. **Sin duplicados conceptuales:** como máximo un ítem por `group`.
6. **Orden:** grupos de lectura/audio contiguos; dificultad ligeramente ascendente; opciones de
   selección múltiple barajadas (la permutación se guarda en el intento).

Garantía probada: si el pool tiene ≥ 2× el tamaño del examen, **dos intentos consecutivos no comparten
preguntas**.

### 5.3 Escala de calificación 1.0 – 5.0

Parámetros (configurables): **nota mínima de aprobación** `P` (3.0) y **exigencia** `E` (70 %): el
porcentaje que equivale a una nota de 3.0.

```
p = puntaje obtenido / puntaje máximo (0..1)
si p < E:   nota = 1.0 + 2.0 · p / E
si p ≥ E:   nota = 3.0 + 2.0 · (p − E) / (1 − E)
nota se trunca a un decimal  (2.97 → 2.9: no se aprueba "por redondeo")
aprobado ⇔ nota ≥ P
```

Subir `P` endurece la aprobación: con `E = 70 %`, `P = 3.5` exige 77,5 % y `P = 4.0` exige 85 %.

| % correcto | Nota (P = 3.0, E = 70 %) |
|---|---|
| 0 % | 1.0 |
| 35 % | 2.0 |
| 60 % | 2.7 |
| 70 % | **3.0** |
| 85 % | 4.0 |
| 100 % | 5.0 |

Examen final de nivel: además del promedio ponderado, cada sección (gramática, vocabulario, lectura,
audio, traducción, construcción, escritura) debe alcanzar **≥ 50 %** (configurable). Así no se aprueba
B1 con gramática perfecta y lectura reprobada.

Ponderación del examen final: Grammar 30 %, Vocabulary 15 %, Reading 15 %, Listening 15 %,
Translation 10 %, Construction 5 %, Writing 10 %.

**Nota final del nivel** (informe académico) = 40 % promedio de las notas vigentes de los módulos +
60 % nota vigente del examen final. **Nota vigente** = la más alta obtenida; **todos los intentos** se
conservan en el historial.

### 5.4 Resultados

Se muestran al entregar: nota, porcentaje, número de errores, resultado (aprobado / no aprobado),
temas dominados (≥ 80 % en el tema), temas pendientes (< 60 %), desglose por sección y la revisión
completa pregunta por pregunta con explicaciones.

### 5.5 Intentos

1. Se registra cada intento (nunca se sobrescribe).
2. Se identifican los temas con más errores.
3. Se recomiendan lecciones y una sesión de repaso dirigida (ítems de práctica de esos temas).
4. Se puede volver a presentar (opción en Configuración: exigir completar el repaso antes).
5. El nuevo examen usa preguntas distintas (§5.2).
6. Un examen abandonado queda como `abandoned` (sin nota) y sus ítems cuentan como usados.

### 5.6 Progresión

- **Lección completada:** evaluación de la lección ≥ exigencia (70 %).
- **Evaluación de módulo disponible:** todas sus lecciones completadas.
- **Módulo aprobado:** nota ≥ P. Desbloquea el siguiente módulo (modo estricto).
- **Examen final disponible:** todos los módulos del nivel aprobados.
- **Nivel aprobado:** nota ≥ P y mínimos por sección. Desbloquea el siguiente nivel.
- **Modo estricto** (por defecto activado): si se desactiva, todo el contenido queda abierto, pero los
  requisitos de aprobación y los logros no cambian.
- El libro de gramática, el vocabulario y las bibliotecas son siempre consultables.

## 6. My Mistakes

- Cada respuesta incorrecta crea o actualiza un registro por ítem (respuesta dada, fecha, etiquetas de
  error, número de fallos).
- Un error se considera **resuelto** tras 2 aciertos consecutivos posteriores en ese ítem.
- "Repasar errores": sesión con los ítems no resueltos, los más fallados y recientes primero.
- "Errores frecuentes": agregación por etiqueta del catálogo y por tema.

## 7. Escritura y respuestas abiertas

Puntuación automática de `writing_task` (0..1):

| Criterio | Peso | Cómo se mide |
|---|---|---|
| Cumplimiento de la tarea | 40 % | Requisitos de contenido (expresiones regulares documentadas por tarea) |
| Corrección gramatical y ortográfica | 30 % | Errores detectados por 100 palabras (corrector por reglas) |
| Organización | 15 % | Conectores, mayúsculas iniciales, puntuación final, número de oraciones |
| Extensión | 15 % | Dentro del rango de palabras pedido |

El informe conserva original, versión corregida y reescritura. Es una **estimación**: se indica que la
corrección por reglas no detecta todos los errores.

## 8. Diagnóstico inicial

- Banco con preguntas por nivel (A1–B2), cada una con habilidad, tema y módulo asociado; opción
  "No lo sé" (cuenta como incorrecta y como laguna explícita).
- Bloques adaptativos: se empieza con un bloque A1; si se obtiene ≥ 70 % se pasa al siguiente nivel;
  si no, el diagnóstico termina.
- Resultado: nivel estimado (el más alto con ≥ 70 %), temas dominados y pendientes, recomendación de
  inicio. El estudiante puede empezar en A1 igualmente. **No aprueba módulos ni niveles.**

## 9. Repetición espaciada (vocabulario)

SM-2 con cuatro respuestas:

| Botón | Calidad q | Efecto |
|---|---|---|
| Otra vez | 1 | repeticiones = 0, intervalo = 1 día, vuelve a aparecer en la misma sesión |
| Difícil | 3 | intervalo × 1,2 (mín. 1 día) |
| Bien | 4 | 1 → 6 días → intervalo × facilidad |
| Fácil | 5 | intervalo × facilidad × 1,3 |

Facilidad: `EF' = EF + (0.1 − (5 − q)(0.08 + (5 − q)·0.02))`, mínimo 1,3, inicial 2,5.
Estados: nueva → aprendiendo (intervalo < 6 d) → repasando (6–21 d) → dominada (> 21 d).
**Palabra aprendida** = al menos 2 recuerdos correctos consecutivos y intervalo ≥ 6 días (base del logro
"100 palabras aprendidas"). "Ya la conozco" programa la tarjeta a 4 días: cuenta como aprendida solo
tras confirmarla en un repaso.

## 10. Garantías de calidad del banco

El validador de contenido falla si:
- un ID se repite o falta un campo obligatorio;
- `answer` no apunta a una opción, hay opciones duplicadas o una opción incorrecta coincide con una
  respuesta aceptada (normalizada);
- el número de `___` no coincide con `blanks`;
- las fichas de `word_order` no reconstruyen una respuesta aceptada;
- un patrón no se puede expandir o excede el límite;
- un `errorTag`, una lección referida o una palabra del glosario no existen;
- el pool de evaluación de un módulo listo tiene menos de 30 ítems o una lección menos de 8 ítems de quiz;
- un `true_false` no tiene explicación, o un `matching` repite elementos.

Los tests verifican estructura y coherencia. La corrección lingüística se garantiza por revisión
editorial: cada explicación debe citar la regla aplicada.
