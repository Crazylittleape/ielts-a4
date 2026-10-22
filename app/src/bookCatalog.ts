import sequence from './data/book-sequence.json';
import units from './data/book-units.json';

export interface BookGroup {
  id: string;
  unitId: string;
  unitTitle: string;
  index: number;
  words: string[];
}

export interface BookUnit {
  id: string;
  title: string;
  index: number;
  words: string[];
  groups: BookGroup[];
}

export const BOOK = {
  id: 'ielts-bible-core-v1',
  title: '雅思词汇真经',
  edition: '去重整理版',
  units: units.map((unit, i): BookUnit => {
    const words = sequence.slice(unit.start, unit.end);
    const groups: BookGroup[] = [];
    for (let start = 0; start < words.length; start += 25) {
      const index = groups.length + 1;
      groups.push({ id: `${unit.id}-g${String(index).padStart(2, '0')}`, unitId: unit.id, unitTitle: unit.title, index, words: words.slice(start, start + 25) });
    }
    return { id: unit.id, title: unit.title, index: i + 1, words, groups };
  })
};

export const BOOK_GROUPS = BOOK.units.flatMap(unit => unit.groups);
export const BOOK_WORD_COUNT = sequence.length;
