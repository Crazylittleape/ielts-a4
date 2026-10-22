import { describe, expect, it } from 'vitest';
import sequence from './data/book-sequence.json';
import { allEntries } from './dict';
describe('bundled book sequence and dictionary', () => {
  it('preserves 3630 distinct words and explicitly identifies both definition gaps', () => {
    expect(sequence).toHaveLength(3630);
    expect(new Set(sequence.map(w=>w.toLowerCase())).size).toBe(3630);
    const dictionary = new Map(allEntries().map(e=>[e.word.toLowerCase(),e]));
    expect(sequence.filter(w=>!dictionary.has(w.toLowerCase())).map(w=>w.toLowerCase()).sort()).toEqual(['el niño','shade-tolerant']);
    expect(sequence.filter(w=>dictionary.has(w.toLowerCase())).every(w=>dictionary.get(w.toLowerCase())!.meaning.trim())).toBe(true);
  });
});
