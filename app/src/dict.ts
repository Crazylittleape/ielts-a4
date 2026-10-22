import raw from './data/dict.txt?raw';

export interface DictEntry {
  word: string;
  phonetic: string;
  meaning: string;
  collins: number;
  oxford: boolean;
  frq: number;
  ielts: boolean;
  basic: boolean;
  tags: string;
}

let entries: DictEntry[] | null = null;
let index: Map<string, DictEntry> | null = null;

function ensure(): void {
  if (entries) return;
  const list: DictEntry[] = [];
  const map = new Map<string, DictEntry>();
  raw.split('\n').forEach((line) => {
    if (!line) return;
    const [word, phonetic, meaning, collins, oxford, frq, tags] = line.split('\x1f');
    const e: DictEntry = {
      word,
      phonetic,
      meaning,
      collins: Number(collins) || 0,
      oxford: oxford === '1',
      frq: Number(frq) || 99999,
      ielts: tags.includes('I'),
      basic: tags.includes('H') || tags.includes('Z') || oxford === '1',
      tags
    };
    list.push(e);
    map.set(word.toLowerCase(), e);
  });
  entries = list;
  index = map;
}

export function dictSize(): number {
  ensure();
  return entries!.length;
}

export function ieltsEntries(): DictEntry[] {
  ensure();
  return entries!.filter((e) => e.ielts);
}

export function allEntries(): DictEntry[] {
  ensure();
  return entries!;
}

const SUFFIX_RULES: [RegExp, string[]][] = [
  [/ies$/, ['y']],
  [/ied$/, ['y']],
  [/(ss|sh|ch|x|z)es$/, ['$1']],
  [/ves$/, ['f', 'fe']],
  [/es$/, ['e', '']],
  [/s$/, ['']],
  [/ing$/, ['', 'e']],
  [/([^aeiou])\1ing$/, ['$1']],
  [/ied$/, ['y']],
  [/ed$/, ['', 'e']],
  [/([^aeiou])\1ed$/, ['$1']],
  [/er$/, ['', 'e']],
  [/est$/, ['', 'e']],
  [/ly$/, ['']],
  [/ally$/, ['']],
  [/ness$/, ['']],
  [/ment$/, ['']]
];

export function lookup(word: string): DictEntry | null {
  ensure();
  const k = word.trim().toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, ' ');
  if (!k) return null;
  const direct = index!.get(k);
  if (direct) return direct;
  for (const [re, reps] of SUFFIX_RULES) {
    if (!re.test(k)) continue;
    for (const rep of reps) {
      const cand = k.replace(re, rep);
      if (cand.length < 3) continue;
      const hit = index!.get(cand);
      if (hit) return hit;
    }
  }
  return null;
}

export function searchDict(q: string, limit = 30): DictEntry[] {
  ensure();
  const k = q.trim().toLowerCase();
  if (!k) return [];
  const starts: DictEntry[] = [];
  const contains: DictEntry[] = [];
  for (const e of entries!) {
    const w = e.word.toLowerCase();
    if (w.startsWith(k)) starts.push(e);
    else if (w.includes(k) || e.meaning.includes(k)) contains.push(e);
    if (starts.length >= limit) break;
  }
  return starts.concat(contains).slice(0, limit);
}
