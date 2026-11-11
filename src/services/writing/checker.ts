/**
 * Corrector determinista por reglas para textos en inglés de estudiantes hispanohablantes.
 * Detecta errores frecuentes y explica cada uno en español. No es exhaustivo:
 * la interfaz indica que es una ayuda, no una corrección humana.
 */
import type { WritingIssue } from '../../types/progress';

export const COMMON_VERBS = [
  'like', 'love', 'hate', 'want', 'need', 'work', 'live', 'go', 'have', 'do', 'play', 'study', 'watch', 'eat',
  'drink', 'read', 'speak', 'get', 'make', 'take', 'come', 'teach', 'write', 'cook', 'drive', 'walk', 'start',
  'finish', 'know', 'think', 'say', 'use', 'help', 'open', 'close', 'wash', 'visit', 'listen', 'sleep', 'wake',
  'run', 'buy', 'pay', 'leave', 'stay', 'travel', 'call', 'clean', 'dance', 'sing', 'swim', 'ride', 'wear',
  'feel', 'look', 'see', 'understand', 'remember', 'forget', 'learn', 'begin', 'arrive', 'try', 'carry', 'fly',
  'enjoy', 'prefer', 'meet', 'send', 'spend', 'sell', 'live', 'smoke', 'rain', 'snow', 'cost', 'mean', 'miss',
  'fix', 'relax', 'catch', 'teach', 'push', 'kiss', 'finish', 'brush', 'go', 'do',
];
const VERB_SET = new Set(COMMON_VERBS);

const IRREGULAR_PAST: Record<string, string> = {
  went: 'go', ate: 'eat', saw: 'see', came: 'come', had: 'have', did: 'do', made: 'make', took: 'take', got: 'get',
  bought: 'buy', wrote: 'write', gave: 'give', told: 'tell', said: 'say', knew: 'know', thought: 'think', found: 'find',
  left: 'leave', felt: 'feel', began: 'begin', drank: 'drink', drove: 'drive', spoke: 'speak', slept: 'sleep',
  swam: 'swim', ran: 'run', sang: 'sing', sat: 'sit', stood: 'stand', taught: 'teach', met: 'meet', paid: 'pay',
  sent: 'send', spent: 'spend', lost: 'lose', won: 'win', wore: 'wear', broke: 'break', chose: 'choose',
  forgot: 'forget', understood: 'understand', became: 'become', brought: 'bring', caught: 'catch', fell: 'fall',
  flew: 'fly', heard: 'hear', kept: 'keep', rode: 'ride', sold: 'sell', woke: 'wake', was: 'be', were: 'be',
};

export function thirdPerson(v: string): string {
  if (v === 'have') return 'has';
  if (v === 'do') return 'does';
  if (v === 'go') return 'goes';
  if (/(s|sh|ch|x|z|o)$/.test(v)) return `${v}es`;
  if (/[^aeiou]y$/.test(v)) return `${v.slice(0, -1)}ies`;
  return `${v}s`;
}

function baseFromS(w: string): string | undefined {
  const lw = w.toLowerCase();
  if (lw === 'has') return 'have';
  if (lw === 'does') return 'do';
  if (lw === 'goes') return 'go';
  if (lw.endsWith('ies') && VERB_SET.has(`${lw.slice(0, -3)}y`)) return `${lw.slice(0, -3)}y`;
  if (lw.endsWith('es') && VERB_SET.has(lw.slice(0, -2))) return lw.slice(0, -2);
  if (lw.endsWith('s') && VERB_SET.has(lw.slice(0, -1))) return lw.slice(0, -1);
  return undefined;
}

function baseFromPast(w: string): string | undefined {
  const lw = w.toLowerCase();
  if (IRREGULAR_PAST[lw] && lw !== 'was' && lw !== 'were') return IRREGULAR_PAST[lw];
  if (lw.endsWith('ied') && VERB_SET.has(`${lw.slice(0, -3)}y`)) return `${lw.slice(0, -3)}y`;
  if (lw.endsWith('ed')) {
    const a = lw.slice(0, -2);
    const b = lw.slice(0, -1);
    if (VERB_SET.has(b)) return b;
    if (VERB_SET.has(a)) return a;
    if (/(.)\1$/.test(a) && VERB_SET.has(a.slice(0, -1))) return a.slice(0, -1);
  }
  return undefined;
}

/** El pronombre «i» suelto siempre en mayúscula dentro de una sugerencia. */
function fixI(s: string): string {
  return s.replace(/(^|\s)i(?=\s|')/g, '$1I');
}

function matchCase(original: string, replacement: string): string {
  if (original[0] && original[0] === original[0].toUpperCase() && original[0] !== original[0].toLowerCase())
    return replacement[0].toUpperCase() + replacement.slice(1);
  return replacement;
}

interface Rule {
  id: string;
  errorTag?: string;
  severity: WritingIssue['severity'];
  regex: RegExp;
  /** Devuelve null para ignorar la coincidencia. */
  check: (m: RegExpExecArray, text: string) => { message: string; suggestion?: string; start?: number; end?: number } | null;
}

const AUX_BEFORE_SUBJECT = /\b(does|did|doesn't|didn't|do|don't|can|can't|could|will|won't|would|should|must|might|may|let|lets|help|make|to|not)\s+$/i;
const DAYS_MONTHS = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'january', 'february', 'march',
  'april', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
];
const NATIONALITIES = [
  'english', 'spanish', 'colombian', 'mexican', 'american', 'british', 'french', 'german', 'italian', 'portuguese',
  'chinese', 'japanese', 'brazilian', 'argentinian', 'peruvian', 'chilean', 'canadian', 'australian', 'european',
  'latin', 'venezuelan', 'ecuadorian', 'korean', 'russian', 'irish', 'scottish',
];
const ADJ_NO_PLURAL = [
  'reds', 'blues', 'greens', 'yellows', 'bigs', 'smalls', 'olds', 'youngs', 'talls', 'beautifuls', 'expensives',
  'cheaps', 'interestings', 'importants', 'differents', 'happys', 'news', 'longs', 'shorts', 'goods', 'bads',
];
const PLURAL_NOUN_AFTER = /^(cars|houses|books|shoes|people|friends|children|eyes|dogs|cats|boys|girls|things|clothes|flowers|apples|days|rooms|chairs|windows|men|women)$/i;

const RULES: Rule[] = [
  {
    id: 'lowercase-i',
    errorTag: 'capital-i',
    severity: 'error',
    regex: /(?<![\w'.-])i(?=('m|'ve|'ll|'d)?(?![\w.-]))/g,
    check: () => ({ message: 'El pronombre «I» (yo) siempre se escribe con mayúscula, incluso en medio de la oración.', suggestion: 'I' }),
  },
  {
    id: 'sentence-capital',
    errorTag: 'capital-letters',
    severity: 'error',
    regex: /(?:^|[.!?]\s+)([a-z])/g,
    check: (m) => {
      const letter = m[1];
      const start = (m.index ?? 0) + m[0].length - 1;
      return { message: 'Cada oración empieza con mayúscula.', suggestion: letter.toUpperCase(), start, end: start + 1 };
    },
  },
  {
    id: 'days-months-nationalities',
    errorTag: 'capital-letters',
    severity: 'error',
    regex: new RegExp(`\\b(${[...DAYS_MONTHS, ...NATIONALITIES].join('|')})\\b`, 'g'),
    check: (m) => ({
      message: 'En inglés los días, meses, nacionalidades e idiomas se escriben con mayúscula (Monday, July, Spanish).',
      suggestion: m[0][0].toUpperCase() + m[0].slice(1),
    }),
  },
  {
    id: 'be-age',
    errorTag: 'be-age',
    severity: 'error',
    regex: /\b([Ii]|[Yy]ou|[Hh]e|[Ss]he|[Ww]e|[Tt]hey|[Mm]y \w+|[A-Z][a-z]+)\s+(have|has)\s+(\d+|[a-z]+(?:-[a-z]+)?)\s+years(\s+old)?(?=\s*(?:[.,!?]|$|\s+and\b))/g,
    check: (m) => {
      const subj = m[1].toLowerCase();
      const be = subj === 'i' ? 'am' : ['you', 'we', 'they'].includes(subj) ? 'are' : 'is';
      return {
        message: 'La edad se expresa con el verbo «to be», no con «have»: I am 20 (years old).',
        suggestion: fixI(`${m[1]} ${be} ${m[3]} years old`),
      };
    },
  },
  {
    id: 'be-missing',
    errorTag: 'be-missing',
    severity: 'error',
    regex: /\b(I|you|he|she|it|we|they)\s+(very\s+)?(happy|sad|tired|hungry|thirsty|cold|hot|sick|ill|busy|ready|late|married|single|from|years old|a student|a teacher|a doctor)\b/gi,
    check: (m, text) => {
      const before = text.slice(Math.max(0, (m.index ?? 0) - 12), m.index ?? 0);
      if (/\b(am|is|are|was|were|be|feel|feels|get|gets|look|looks|make|makes|keep|keeps|like|likes|want|wants|find|finds|let|lets)\s+$/i.test(before)) return null;
      const subj = m[1].toLowerCase();
      const be = subj === 'i' ? 'am' : ['you', 'we', 'they'].includes(subj) ? 'are' : 'is';
      return {
        message: 'Falta el verbo «to be». En inglés no se puede omitir: She is happy / I am from Colombia.',
        suggestion: fixI(`${m[1]} ${be} ${m[2] ?? ''}${m[3]}`),
      };
    },
  },
  {
    id: 'third-person-s',
    errorTag: 'third-person-s',
    severity: 'error',
    regex: new RegExp(`\\b(he|she|it|my (?:mother|father|mom|dad|brother|sister|friend|son|daughter|wife|husband|boss|teacher|dog|cat))\\s+(${COMMON_VERBS.join('|')})\\b`, 'gi'),
    check: (m, text) => {
      const before = text.slice(Math.max(0, (m.index ?? 0) - 14), m.index ?? 0);
      if (AUX_BEFORE_SUBJECT.test(before)) return null;
      const verb = m[2].toLowerCase();
      const start = (m.index ?? 0) + m[0].length - m[2].length;
      return {
        message: `Con ${m[1]} (3.ª persona del singular) el presente simple lleva -s/-es: ${verb} → ${thirdPerson(verb)}.`,
        suggestion: thirdPerson(verb),
        start,
        end: start + m[2].length,
      };
    },
  },
  {
    id: 'he-dont',
    errorTag: 'do-does-agreement',
    severity: 'error',
    regex: /\b(he|she|it)\s+(don't|dont|do not)\b/gi,
    check: (m) => ({
      message: 'Con he/she/it el auxiliar es «does»: She doesn\'t…',
      suggestion: `${m[1]} ${m[2].toLowerCase() === 'do not' ? 'does not' : "doesn't"}`,
    }),
  },
  {
    id: 'do-he',
    errorTag: 'do-does-agreement',
    severity: 'error',
    regex: /\b(do)\s+(he|she|it)\b/gi,
    check: (m) => ({ message: 'Con he/she/it la pregunta se forma con «Does»: Does she…?', suggestion: `${matchCase(m[1], 'does')} ${m[2]}` }),
  },
  {
    id: 'aux-inflected',
    errorTag: 'aux-plus-inflected',
    severity: 'error',
    regex: /\b(does|did|doesn't|didn't|does not|did not)\s+(?:(I|you|he|she|it|we|they)\s+)?([a-z]+)\b/gi,
    check: (m) => {
      const word = m[3];
      const base = baseFromS(word) ?? baseFromPast(word);
      if (!base || base === word.toLowerCase()) return null;
      const start = (m.index ?? 0) + m[0].length - word.length;
      return {
        message: `Después de ${m[1].toLowerCase()} el verbo va en forma base (sin -s ni pasado): ${word} → ${base}. El auxiliar ya marca la persona y el tiempo.`,
        suggestion: base,
        start,
        end: start + word.length,
      };
    },
  },
  {
    id: 'modal-to',
    errorTag: 'modal-to',
    severity: 'error',
    regex: /\b(can|can't|cannot|could|must|should|will|won't|might)\s+to\s+(\w+)/gi,
    check: (m) => ({ message: `Después de «${m[1]}» el verbo va sin «to»: ${m[1]} ${m[2]}.`, suggestion: `${m[1]} ${m[2]}` }),
  },
  {
    id: 'modal-s',
    errorTag: 'aux-plus-inflected',
    severity: 'error',
    regex: /\b(can|can't|could|must|should|will|might|may)\s+(\w+)\b/gi,
    check: (m) => {
      const base = baseFromS(m[2]);
      if (!base) return null;
      return { message: `Los verbos modales van seguidos de la forma base: ${m[1]} ${base}.`, suggestion: `${m[1]} ${base}` };
    },
  },
  {
    id: 'article-a-an',
    errorTag: 'article-a-an',
    severity: 'error',
    regex: /\b(a|an)\s+([a-z][\w-]*)/gi,
    check: (m) => {
      const art = m[1].toLowerCase();
      const word = m[2].toLowerCase();
      const vowelSound =
        /^[aeiou]/.test(word) && !/^(uni(?!mp|n)|use|usu|usa|uti|ute|eu|one|once|ura|uri|uro|ubiq|ukul|utop)/.test(word)
          ? true
          : /^(hour|honest|honou?r|heir)/.test(word);
      if (art === 'a' && vowelSound) return { message: `Se usa «an» delante de sonido vocálico: an ${m[2]}.`, suggestion: `${matchCase(m[1], 'an')} ${m[2]}` };
      if (art === 'an' && !vowelSound) return { message: `Se usa «a» delante de sonido consonántico: a ${m[2]}.`, suggestion: `${matchCase(m[1], 'a')} ${m[2]}` };
      return null;
    },
  },
  {
    id: 'people-is',
    errorTag: 'people-plural',
    severity: 'error',
    regex: /\bpeople\s+(is|was|has)\b/gi,
    check: (m) => {
      const fix = { is: 'are', was: 'were', has: 'have' }[m[1].toLowerCase()] ?? m[1];
      return { message: '«People» es plural (personas): people are / were / have.', suggestion: `people ${fix}` };
    },
  },
  {
    id: 'there-is-plural',
    errorTag: 'there-is-are-agreement',
    severity: 'error',
    regex: /\bthere\s+is\s+(two|three|four|five|six|seven|eight|nine|ten|many|several|\d+)\b/gi,
    check: (m) => ({ message: 'Con sustantivos en plural se usa «there are».', suggestion: `there are ${m[1]}` }),
  },
  {
    id: 'there-are-a',
    errorTag: 'there-is-are-agreement',
    severity: 'error',
    regex: /\bthere\s+are\s+(a|an|one)\s+(?!lot\b)/gi,
    check: (m) => ({ message: 'Con un sustantivo singular se usa «there is».', suggestion: `there is ${m[1]} ` }),
  },
  {
    id: 'double-comparative',
    errorTag: 'double-comparative',
    severity: 'error',
    regex: /\bmore\s+(bigger|smaller|better|worse|older|younger|taller|shorter|cheaper|easier|faster|happier|longer|hotter|colder|nicer)\b/gi,
    check: (m) => ({ message: 'No se combinan «more» y «-er»: el comparativo ya está formado.', suggestion: m[1] }),
  },
  {
    id: 'more-short-adjective',
    errorTag: 'double-comparative',
    severity: 'error',
    regex: /\bmore\s+(big|small|tall|old|young|cheap|fast|easy|happy|nice|long|short|hot|cold|good|bad)\s+than\b/gi,
    check: (m) => {
      const irregular: Record<string, string> = { good: 'better', bad: 'worse', big: 'bigger', hot: 'hotter', easy: 'easier', happy: 'happier' };
      const adj = m[1].toLowerCase();
      const comp = irregular[adj] ?? (adj.endsWith('e') ? `${adj}r` : `${adj}er`);
      return { message: `Los adjetivos cortos forman el comparativo con -er: ${comp} than.`, suggestion: `${comp} than` };
    },
  },
  {
    id: 'subject-omitted',
    errorTag: 'subject-omitted',
    severity: 'warning',
    regex: /(?:^|[.!?]\s+)((?:Is|Are|Am)\s+[^.!?]*)([.!])/g,
    check: (m) => {
      const start = (m.index ?? 0) + m[0].indexOf(m[1]);
      return {
        message: '¿Falta el sujeto? En inglés la oración necesita sujeto (It is cold. / They are here.). Si es una pregunta, termina con «?».',
        start,
        end: start + m[1].length,
      };
    },
  },
  {
    id: 'adjective-plural',
    errorTag: 'adjective-plural',
    severity: 'error',
    regex: new RegExp(`\\b(${ADJ_NO_PLURAL.join('|')})\\s+(\\w+)`, 'gi'),
    check: (m) => {
      if (!PLURAL_NOUN_AFTER.test(m[2])) return null;
      return { message: 'Los adjetivos no tienen plural en inglés: red cars, big houses.', suggestion: `${m[1].slice(0, -1)} ${m[2]}` };
    },
  },
  {
    id: 'go-to-home',
    errorTag: 'go-home',
    severity: 'error',
    regex: /\b(go|goes|went|going|come|comes|came|get|gets|got|arrive|arrives|arrived)\s+to\s+home\b/gi,
    check: (m) => ({ message: 'Con «home» no se usa «to»: go home, get home, arrive home.', suggestion: `${m[1]} home` }),
  },
  {
    id: 'explain-me',
    errorTag: 'preposition-verb',
    severity: 'error',
    regex: /\bexplain\s+(me|us|him|her|them)\b/gi,
    check: (m) => ({ message: '«Explain» necesita «to» antes de la persona: explain to me.', suggestion: `explain to ${m[1]}` }),
  },
  {
    id: 'depend-of',
    errorTag: 'preposition-verb',
    severity: 'error',
    regex: /\b(depend|depends|depended|depending)\s+of\b/gi,
    check: (m) => ({ message: 'En inglés es «depend on».', suggestion: `${m[1]} on` }),
  },
  {
    id: 'married-with',
    errorTag: 'preposition-verb',
    severity: 'warning',
    regex: /\bmarried\s+with\b/gi,
    check: () => ({ message: 'Se dice «married to» (casado con).', suggestion: 'married to' }),
  },
  {
    id: 'since-duration',
    errorTag: 'for-since',
    severity: 'error',
    regex: /\bsince\s+(\d+|two|three|four|five|six|seven|eight|nine|ten|many)\s+(years|months|weeks|days|hours)\b/gi,
    check: (m) => ({ message: 'Para una duración se usa «for» (for three years); «since» va con un punto de inicio (since 2020).', suggestion: `for ${m[1]} ${m[2]}` }),
  },
  {
    id: 'double-negative',
    errorTag: 'double-negative',
    severity: 'error',
    regex: /\b(don't|doesn't|didn't|can't|won't|isn't|aren't|wasn't|weren't|not)\s+(?:\w+\s+){0,2}(nothing|nobody|never|nowhere|none)\b/gi,
    check: (m) => {
      const map: Record<string, string> = { nothing: 'anything', nobody: 'anybody', never: 'ever', nowhere: 'anywhere', none: 'any' };
      const w = m[2].toLowerCase();
      const start = (m.index ?? 0) + m[0].length - m[2].length;
      return { message: `En inglés estándar no hay doble negación: usa «${map[w]}» después de una negación.`, suggestion: map[w], start, end: start + m[2].length };
    },
  },
  {
    id: 'be-agree',
    errorTag: 'be-agree',
    severity: 'error',
    regex: /\b(I am|I'm|we are|we're|they are|they're|you are|you're|he is|he's|she is|she's)\s+(agree|disagree)\b/gi,
    check: (m) => {
      const subj = m[1].split(/[\s']/)[0];
      const verb = /^(he|she)$/i.test(subj) ? `${m[2]}s` : m[2];
      return { message: '«Agree» es un verbo: I agree (no «I am agree»).', suggestion: `${subj} ${verb}` };
    },
  },
  {
    id: 'frequency-be-position',
    errorTag: 'frequency-adverb-position',
    severity: 'error',
    regex: /\b(I|you|he|she|it|we|they)\s+(always|usually|often|never|rarely|seldom|normally)\s+(am|is|are)\b/gi,
    check: (m) => ({ message: 'Con «to be», el adverbio de frecuencia va después del verbo: She is always late.', suggestion: fixI(`${m[1]} ${m[3]} ${m[2]}`) }),
  },
  {
    id: 'make-photo',
    errorTag: 'collocation',
    severity: 'warning',
    regex: /\b(make|makes|made|making)\s+(a\s+)?(photo|photos|picture|pictures)\b/gi,
    check: (m) => {
      const map: Record<string, string> = { make: 'take', makes: 'takes', made: 'took', making: 'taking' };
      return { message: 'Las fotos se «toman»: take a photo.', suggestion: `${map[m[1].toLowerCase()]} ${m[2] ?? ''}${m[3]}` };
    },
  },
  {
    id: 'make-homework',
    errorTag: 'collocation',
    severity: 'warning',
    regex: /\b(make|makes|made|making)\s+((?:my|your|his|her|our|their|the)\s+)?(homework|exercise|exercises)\b/gi,
    check: (m) => {
      const map: Record<string, string> = { make: 'do', makes: 'does', made: 'did', making: 'doing' };
      return { message: 'Con tareas y ejercicio se usa «do»: do my homework, do exercise.', suggestion: `${map[m[1].toLowerCase()]} ${m[2] ?? ''}${m[3]}` };
    },
  },
  {
    id: 'repeated-word',
    severity: 'warning',
    regex: /\b(\w+)\s+\1\b/gi,
    check: (m) => {
      if (/^(that|had|is|do)$/i.test(m[1])) return null;
      return { message: 'Palabra repetida.', suggestion: m[1] };
    },
  },
  {
    id: 'space-before-punct',
    severity: 'style',
    regex: /(\w)\s+([,.!?;:])/g,
    check: (m) => ({ message: 'No se deja espacio antes de los signos de puntuación.', suggestion: `${m[1]}${m[2]}` }),
  },
  {
    id: 'space-after-punct',
    severity: 'style',
    regex: /([a-z]{2,})([,;:!?]|\.)([A-Za-z]{2,})/g,
    check: (m, text) => {
      const ctx = text.slice(Math.max(0, m.index - 30), m.index + m[0].length + 6);
      if (/@|www|https?:|\.(com|org|net|co)\b/i.test(ctx)) return null;
      return { message: 'Deja un espacio después de los signos de puntuación.', suggestion: `${m[1]}${m[2]} ${m[3]}` };
    },
  },
  {
    id: 'spanish-question-marks',
    severity: 'error',
    errorTag: 'punctuation',
    regex: /[¿¡]/g,
    check: () => ({ message: 'En inglés no se usan los signos de apertura ¿ ¡.', suggestion: '' }),
  },
];

/** Analiza el texto y devuelve los problemas detectados, ordenados y sin solapamientos. */
export function checkText(text: string): WritingIssue[] {
  const issues: WritingIssue[] = [];
  for (const rule of RULES) {
    rule.regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rule.regex.exec(text)) !== null) {
      if (m[0].length === 0) {
        rule.regex.lastIndex++;
        continue;
      }
      const res = rule.check(m, text);
      if (!res) continue;
      const start = res.start ?? m.index;
      const end = res.end ?? m.index + m[0].length;
      issues.push({
        ruleId: rule.errorTag ?? rule.id,
        message: res.message,
        excerpt: text.slice(start, end),
        suggestion: res.suggestion,
        start,
        end,
        severity: rule.severity,
      });
    }
  }
  if (text.trim().length > 0 && !/[.!?]["')\]]?\s*$/.test(text.trim())) {
    const end = text.trimEnd().length;
    issues.push({
      ruleId: 'punctuation',
      message: 'Termina el texto con un punto (o con ? / ! si corresponde).',
      excerpt: text.trimEnd().slice(-1),
      start: end - 1,
      end,
      severity: 'warning',
    });
  }
  issues.sort((a, b) => a.start - b.start || b.end - a.end);
  const result: WritingIssue[] = [];
  let lastEnd = -1;
  for (const i of issues) {
    if (i.start < lastEnd) continue;
    result.push(i);
    lastEnd = i.end;
  }
  return result;
}

/** Aplica las sugerencias deterministas para producir una versión corregida. */
export function applySuggestions(text: string, issues: WritingIssue[]): string {
  let out = text;
  const withFix = issues.filter((i) => i.suggestion !== undefined).sort((a, b) => b.start - a.start);
  for (const i of withFix) out = out.slice(0, i.start) + (i.suggestion ?? '') + out.slice(i.end);
  const last = issues.find((i) => i.ruleId === 'punctuation' && i.excerpt !== '¿' && i.excerpt !== '¡' && i.severity === 'warning');
  if (last && !/[.!?]\s*$/.test(out.trim())) out = `${out.trimEnd()}.`;
  return out.replace(/ {2,}/g, ' ');
}
