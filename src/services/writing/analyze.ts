import type { Requirement } from '../../types/content';
import type { WritingIssue } from '../../types/progress';
import { countWords, clamp } from '../../utils/text';
import { applySuggestions, checkText } from './checker';

export const CONNECTORS = [
  'and', 'but', 'or', 'because', 'so', 'then', 'also', 'first', 'firstly', 'after that', 'finally', 'when', 'however',
  'although', 'though', 'while', 'before', 'after', 'later', 'next', 'for example', 'for instance', 'in addition',
  'moreover', 'therefore', 'on the other hand', 'in my opinion', 'in conclusion', 'as well', 'too', 'until', 'if',
  'unless', 'since', 'as a result', 'despite', 'whereas', 'nevertheless', 'furthermore', 'besides',
];

export interface WritingTaskLike {
  requirements: Requirement[];
  targetStructures?: Requirement[];
  minWords: number;
  maxWords: number;
}

export interface WritingAnalysis {
  wordCount: number;
  sentenceCount: number;
  requirements: { label: string; met: boolean; feedback?: string }[];
  structures: { label: string; met: boolean; feedback?: string }[];
  connectors: string[];
  issues: WritingIssue[];
  corrected: string;
  criteria: { task: number; accuracy: number; organization: number; length: number };
  score: number;
}

export function safeRegex(pattern: string): RegExp {
  try {
    return new RegExp(pattern, 'i');
  } catch {
    return /$^/;
  }
}

export function findConnectors(text: string): string[] {
  const lower = ` ${text.toLowerCase().replace(/[^a-z' ]+/g, ' ')} `;
  return CONNECTORS.filter((c) => lower.includes(` ${c} `));
}

export function countSentences(text: string): number {
  return text.split(/[.!?]+/).filter((s) => countWords(s) > 0).length;
}

export function analyzeWriting(text: string, task: WritingTaskLike): WritingAnalysis {
  const wordCount = countWords(text);
  const sentenceCount = countSentences(text);
  const requirements = task.requirements.map((r) => ({ label: r.label, met: safeRegex(r.pattern).test(text), feedback: r.feedback }));
  const structures = (task.targetStructures ?? []).map((r) => ({ label: r.label, met: safeRegex(r.pattern).test(text), feedback: r.feedback }));
  const connectors = findConnectors(text);
  const issues = checkText(text);
  const corrected = applySuggestions(text, issues);

  const reqTotal = requirements.length + structures.length;
  const reqMet = requirements.filter((r) => r.met).length + structures.filter((r) => r.met).length;
  const taskScore = reqTotal === 0 ? 1 : reqMet / reqTotal;

  const errors = issues.filter((i) => i.severity === 'error').length + issues.filter((i) => i.severity === 'warning').length * 0.5;
  const per100 = (errors / Math.max(wordCount, 1)) * 100;
  const accuracy = wordCount === 0 ? 0 : clamp(1 - per100 / 10, 0, 1);

  const orgChecks = [
    connectors.length >= (task.minWords >= 60 ? 2 : 1),
    !issues.some((i) => i.ruleId === 'capital-letters' && /^[a-z]$/.test(i.excerpt)),
    /[.!?]["')\]]?\s*$/.test(text.trim()),
    sentenceCount >= (task.minWords >= 40 ? 3 : 2),
  ];
  const organization = wordCount === 0 ? 0 : orgChecks.filter(Boolean).length / orgChecks.length;

  let length: number;
  if (wordCount >= task.minWords && wordCount <= task.maxWords) length = 1;
  else if (wordCount < task.minWords) length = wordCount / Math.max(task.minWords, 1);
  else length = clamp(1 - (wordCount - task.maxWords) / task.maxWords, 0, 1);

  let score = 0.4 * taskScore + 0.3 * accuracy + 0.15 * organization + 0.15 * length;
  if (wordCount < task.minWords * 0.3) score = Math.min(score, 0.3);
  return {
    wordCount,
    sentenceCount,
    requirements,
    structures,
    connectors,
    issues,
    corrected,
    criteria: { task: taskScore, accuracy, organization, length },
    score: clamp(score, 0, 1),
  };
}
