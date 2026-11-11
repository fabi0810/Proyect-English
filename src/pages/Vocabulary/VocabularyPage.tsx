import { useMemo, useState } from 'react';
import { Brain, ListPlus, Plus, Repeat, Search, Sparkles, Star, Trash2 } from 'lucide-react';
import type { Level, VocabCategory, VocabWord } from '../../types/content';
import { LEVELS } from '../../types/content';
import { useAppStore } from '../../store/useAppStore';
import { useAsync } from '../../hooks/useAsync';
import { PageHeader } from '../../components/layout/AppShell';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Badge, EmptyState, Loading, Pill, Stat } from '../../components/ui/primitives';
import { Modal } from '../../components/ui/Modal';
import { SpeakButton } from '../../components/ui/SpeakButton';
import { hasLevelFile, loadVocabulary } from '../../services/content/loader';
import { CATEGORY_LABELS, CATEGORY_LABELS_ES } from '../../services/content/taxonomy';
import { cardState, isDue, isLearned, type CardState } from '../../services/vocabulary/srs';
import { basicNormalize, stripAccents } from '../../services/exercises/normalize';
import { currentLevel } from '../../services/progress/stats';
import { cn } from '../../utils/cn';

type Filter = 'all' | 'new' | 'learning' | 'mastered' | 'due' | 'difficult' | `list:${string}`;

const STATE_LABEL: Record<CardState, { label: string; tone: 'neutral' | 'info' | 'brand' | 'success' }> = {
  new: { label: 'Nueva', tone: 'neutral' },
  learning: { label: 'Aprendiendo', tone: 'info' },
  reviewing: { label: 'Repasando', tone: 'brand' },
  mastered: { label: 'Dominada', tone: 'success' },
};

function ListsModal({ word, onClose }: { word: VocabWord | null; onClose: () => void }) {
  const lists = useAppStore((s) => s.data.vocab.lists);
  const toggle = useAppStore((s) => s.toggleWordInList);
  const create = useAppStore((s) => s.createList);
  const [name, setName] = useState('');
  return (
    <Modal open={Boolean(word)} onClose={onClose} title={`Añadir «${word?.word}» a una lista`}>
      <div className="space-y-2">
        {lists.length === 0 && <p className="text-sm text-muted">Aún no tienes listas personales.</p>}
        {lists.map((l) => (
          <label key={l.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-line px-3 py-2.5 hover:bg-surface-2">
            <input type="checkbox" checked={Boolean(word && l.words.includes(word.id))} onChange={() => word && toggle(l.id, word.id)} className="h-4 w-4 accent-[var(--brand)]" />
            <span className="flex-1 text-sm font-medium text-ink">{l.name}</span>
            <span className="font-mono text-xs text-muted">{l.words.length}</span>
          </label>
        ))}
      </div>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim() || !word) return;
          const id = create(name);
          toggle(id, word.id);
          setName('');
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nueva lista (p. ej. Viaje a Londres)" className="input" />
        <Button type="submit" icon={<Plus size={16} />} disabled={!name.trim()}>
          Crear
        </Button>
      </form>
    </Modal>
  );
}

export default function VocabularyPage() {
  const data = useAppStore((s) => s.data);
  const toggleDifficult = useAppStore((s) => s.toggleDifficult);
  const deleteList = useAppStore((s) => s.deleteList);
  const [level, setLevel] = useState<Level>(currentLevel(data));
  const [filter, setFilter] = useState<Filter>('all');
  const [category, setCategory] = useState<VocabCategory | 'all'>('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [listWord, setListWord] = useState<VocabWord | null>(null);
  const { data: words, loading } = useAsync(() => loadVocabulary(level), [level]);
  const cards = data.vocab.cards;
  const difficult = data.vocab.difficult;

  const stats = useMemo(() => {
    const all = words ?? [];
    return {
      learned: all.filter((w) => isLearned(cards[w.id])).length,
      learning: all.filter((w) => cards[w.id] && !isLearned(cards[w.id])).length,
      due: all.filter((w) => isDue(cards[w.id])).length,
      fresh: all.filter((w) => !cards[w.id]).length,
    };
  }, [words, cards]);

  const categories = useMemo(() => Array.from(new Set((words ?? []).map((w) => w.category))), [words]);
  const query = stripAccents(basicNormalize(q));
  const list = filter.startsWith('list:') ? data.vocab.lists.find((l) => l.id === filter.slice(5)) : undefined;

  const shown = useMemo(() => {
    return (words ?? []).filter((w) => {
      const st = cardState(cards[w.id]);
      if (category !== 'all' && w.category !== category) return false;
      if (filter === 'new' && st !== 'new') return false;
      if (filter === 'learning' && st !== 'learning' && st !== 'reviewing') return false;
      if (filter === 'mastered' && st !== 'mastered') return false;
      if (filter === 'due' && !isDue(cards[w.id])) return false;
      if (filter === 'difficult' && !difficult.includes(w.id)) return false;
      if (list && !list.words.includes(w.id)) return false;
      if (query && !stripAccents(basicNormalize(`${w.word} ${w.translation}`)).includes(query)) return false;
      return true;
    });
  }, [words, cards, category, filter, difficult, list, query]);

  const available = LEVELS.filter((l) => hasLevelFile('vocabulary', l));

  return (
    <div>
      <PageHeader
        eyebrow="Vocabulary"
        title="Biblioteca de vocabulario"
        subtitle="Palabras por nivel y categoría con pronunciación, ejemplos y repetición espaciada (SM-2): las palabras que olvidas vuelven antes."
        actions={
          <>
            <ButtonLink to="/vocabulary/quiz" variant="secondary" icon={<Brain size={16} />}>
              Quiz
            </ButtonLink>
            <ButtonLink to="/vocabulary/review?mode=adaptive" icon={<Repeat size={16} />}>
              Repasar ({stats.due})
            </ButtonLink>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat value={stats.learned} label="✓ Aprendidas" tone="success" />
        <Stat value={stats.learning} label="↺ Aprendiendo" tone="brand" />
        <Stat value={stats.due} label="Por repasar" tone="warning" />
        <Stat value={stats.fresh} label="Sin estudiar" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {LEVELS.map((l) => (
          <Pill key={l} active={level === l} onClick={() => available.includes(l) && setLevel(l)} className={!available.includes(l) ? 'opacity-40' : ''}>
            {l}
            {!available.includes(l) && <span className="text-[10px]">pronto</span>}
          </Pill>
        ))}
        <span className="mx-1 h-6 w-px bg-line" />
        <ButtonLink to="/vocabulary/review?mode=new" variant="secondary" size="sm" icon={<Sparkles size={14} />}>
          Aprender nuevas
        </ButtonLink>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ['all', 'Todas'],
            ['new', 'Nuevas'],
            ['learning', 'Aprendiendo'],
            ['mastered', 'Dominadas'],
            ['due', 'Por repasar'],
            ['difficult', '★ Difíciles'],
          ] as [Filter, string][]
        ).map(([f, label]) => (
          <Pill key={f} active={filter === f} onClick={() => setFilter(f)}>
            {label}
          </Pill>
        ))}
        {data.vocab.lists.map((l) => (
          <Pill key={l.id} active={filter === `list:${l.id}`} onClick={() => setFilter(`list:${l.id}`)} count={l.words.length}>
            {l.name}
          </Pill>
        ))}
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={17} className="absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en inglés o español…" className="input pl-11" aria-label="Buscar palabra" />
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value as VocabCategory | 'all')} className="input sm:w-60" aria-label="Categoría">
          <option value="all">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]} · {CATEGORY_LABELS_ES[c]}
            </option>
          ))}
        </select>
      </div>

      {list && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl bg-surface-2 px-4 py-3 text-sm">
          <span className="font-semibold text-ink">Lista «{list.name}»</span>
          <span className="text-muted">· {list.words.length} palabras</span>
          <ButtonLink to={`/vocabulary/review?mode=list:${list.id}`} size="sm" variant="secondary" className="ml-auto">
            Estudiar lista
          </ButtonLink>
          <Button
            size="sm"
            variant="ghost"
            icon={<Trash2 size={14} />}
            onClick={() => {
              deleteList(list.id);
              setFilter('all');
            }}
          >
            Eliminar
          </Button>
        </div>
      )}

      {loading ? (
        <Loading />
      ) : !words?.length ? (
        <EmptyState title={`El vocabulario de ${level} está en preparación`} />
      ) : shown.length === 0 ? (
        <EmptyState icon={<Search size={20} />} title="No hay palabras con estos filtros" />
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {shown.slice(0, 300).map((w) => {
            const st = cardState(cards[w.id]);
            const isOpen = open === w.id;
            return (
              <div key={w.id}>
                <div className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2/60">
                  <SpeakButton text={w.word} size="xs" />
                  <button type="button" onClick={() => setOpen(isOpen ? null : w.id)} className="min-w-0 flex-1 text-left">
                    <span className="font-semibold text-ink">{w.word}</span>
                    <span className="ml-2 hidden font-mono text-xs text-subtle sm:inline">{w.ipa}</span>
                    <span className="block truncate text-sm text-muted">{w.translation}</span>
                  </button>
                  <span className="hidden text-xs text-subtle md:inline">{CATEGORY_LABELS_ES[w.category]}</span>
                  <Badge tone={STATE_LABEL[st].tone}>{STATE_LABEL[st].label}</Badge>
                  <button type="button" onClick={() => toggleDifficult(w.id)} aria-label="Marcar como difícil" title="Palabra difícil" className={cn('rounded-full p-1.5', difficult.includes(w.id) ? 'text-warning' : 'text-subtle hover:text-warning')}>
                    <Star size={17} fill={difficult.includes(w.id) ? 'currentColor' : 'none'} />
                  </button>
                  <button type="button" onClick={() => setListWord(w)} aria-label="Añadir a una lista" title="Añadir a una lista" className="rounded-full p-1.5 text-subtle hover:text-brand">
                    <ListPlus size={17} />
                  </button>
                </div>
                {isOpen && (
                  <div className="bg-surface-2/60 px-4 pt-1 pb-4 pl-14 text-sm">
                    <div className="flex items-start gap-2">
                      <SpeakButton text={w.example} size="xs" />
                      <div>
                        <div className="text-ink">{w.example}</div>
                        <div className="text-muted">{w.exampleEs}</div>
                      </div>
                    </div>
                    {w.context && <p className="mt-2 text-info">{w.context}</p>}
                    <p className="mt-2 font-mono text-xs text-subtle">
                      {w.pos} · {w.ipa}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <ListsModal word={listWord} onClose={() => setListWord(null)} />
    </div>
  );
}
