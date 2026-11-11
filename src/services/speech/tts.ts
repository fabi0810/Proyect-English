/**
 * Síntesis de voz con la Web Speech API (sin dependencias ni servidores).
 * Selección de voz por acento, velocidad configurable y voces distintas por hablante.
 */

export interface VoiceInfo {
  uri: string;
  name: string;
  lang: string;
  accent: string;
  local: boolean;
}

const ACCENTS: Record<string, string> = {
  'en-US': 'Inglés americano',
  'en-GB': 'Inglés británico',
  'en-AU': 'Inglés australiano',
  'en-CA': 'Inglés canadiense',
  'en-IE': 'Inglés irlandés',
  'en-IN': 'Inglés de la India',
  'en-NZ': 'Inglés neozelandés',
  'en-ZA': 'Inglés sudafricano',
  'en-SG': 'Inglés de Singapur',
};

export function accentLabel(lang: string): string {
  const norm = lang.replace('_', '-');
  return ACCENTS[norm] ?? (norm.toLowerCase().startsWith('en') ? 'Inglés' : norm);
}

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}

let cachedVoices: SpeechSynthesisVoice[] = [];
const listeners = new Set<() => void>();

function refreshVoices() {
  if (!isSpeechSupported()) return;
  cachedVoices = window.speechSynthesis.getVoices();
  listeners.forEach((l) => l());
}

if (isSpeechSupported()) {
  refreshVoices();
  window.speechSynthesis.addEventListener?.('voiceschanged', refreshVoices);
}

export function onVoicesChanged(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function englishVoices(): VoiceInfo[] {
  return cachedVoices
    .filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith('en'))
    .map((v) => ({ uri: v.voiceURI, name: v.name, lang: v.lang.replace('_', '-'), accent: accentLabel(v.lang), local: v.localService }))
    .sort((a, b) => Number(b.lang === 'en-US') - Number(a.lang === 'en-US') || a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name));
}

function findVoice(uri?: string): SpeechSynthesisVoice | undefined {
  const en = cachedVoices.filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith('en'));
  if (uri) {
    const v = en.find((x) => x.voiceURI === uri);
    if (v) return v;
  }
  return en.find((v) => v.lang.replace('_', '-') === 'en-US' && v.default) ?? en.find((v) => v.lang.replace('_', '-') === 'en-US') ?? en[0];
}

/** Segunda voz distinta (para diálogos). */
function alternateVoice(primary?: SpeechSynthesisVoice, preferredUri?: string): SpeechSynthesisVoice | undefined {
  const en = cachedVoices.filter((v) => v.lang.toLowerCase().startsWith('en'));
  if (preferredUri) {
    const p = en.find((v) => v.voiceURI === preferredUri);
    if (p && p !== primary) return p;
  }
  return en.find((v) => v !== primary && v.lang === primary?.lang) ?? en.find((v) => v !== primary) ?? primary;
}

export interface SpeakOptions {
  rate?: number;
  voiceURI?: string;
  secondVoiceURI?: string;
  pitch?: number;
  onEnd?: () => void;
  onStart?: () => void;
}

export function stopSpeaking(): void {
  if (isSpeechSupported()) window.speechSynthesis.cancel();
}

export function speak(text: string, opts: SpeakOptions = {}): void {
  speakSequence([{ text }], opts);
}

/** Reproduce una secuencia de líneas; los hablantes alternan voz si hay varias disponibles. */
export function speakSequence(lines: { text: string; speaker?: string }[], opts: SpeakOptions = {}): void {
  if (!isSpeechSupported()) {
    opts.onEnd?.();
    return;
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  if (!cachedVoices.length) refreshVoices();
  const primary = findVoice(opts.voiceURI);
  const secondary = alternateVoice(primary, opts.secondVoiceURI);
  const speakers = Array.from(new Set(lines.map((l) => l.speaker ?? '')));
  lines.forEach((line, i) => {
    const u = new SpeechSynthesisUtterance(line.text);
    const idx = speakers.indexOf(line.speaker ?? '');
    const voice = idx % 2 === 1 ? secondary : primary;
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    } else u.lang = 'en-US';
    u.rate = opts.rate ?? 0.9;
    u.pitch = idx % 2 === 1 && voice === primary ? 1.25 : (opts.pitch ?? 1);
    if (i === 0) u.onstart = () => opts.onStart?.();
    if (i === lines.length - 1) {
      u.onend = () => opts.onEnd?.();
      u.onerror = () => opts.onEnd?.();
    }
    synth.speak(u);
  });
}

export function isSpeaking(): boolean {
  return isSpeechSupported() && window.speechSynthesis.speaking;
}
