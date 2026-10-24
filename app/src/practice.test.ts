import { describe, expect, it } from 'vitest';
import { createWord } from './lib';
import { distinctMeanings, matchRound } from './Practice';

const day = '2026-10-22';
const make = (pairs: [string, string][]) => pairs.map(([word, meaning]) => createWord({ word, meaning }, day));
const keep = <T,>(items: T[]) => [...items];

describe('60s matching rounds', () => {
  it('never puts two words with the same meaning in one round and caps a round at 4', () => {
    const words = make([['a', '同'], ['b', '同'], ['c', '异'], ['d', '三'], ['e', '四'], ['f', '五']]);
    for (let i = 0; i < 200; i++) {
      const round = matchRound(words);
      expect(round.length).toBe(4);
      expect(distinctMeanings(round)).toBe(round.length);
    }
  });

  it('works with fewer than 4 distinct meanings and never returns an empty round', () => {
    const words = make([['a', '同'], ['b', '同'], ['c', '异']]);
    let previous: string[] = [];
    for (let i = 0; i < 50; i++) {
      const round = matchRound(words, previous);
      expect(round).toHaveLength(2);
      expect(distinctMeanings(round)).toBe(2);
      previous = round.map(w => w.id);
    }
  });

  it('prefers words not used in the previous round, then fills with earlier ones', () => {
    const words = make([['a', '一'], ['b', '二'], ['c', '三'], ['d', '四'], ['e', '五']]);
    const first = matchRound(words, [], keep);
    expect(first.map(w => w.word)).toEqual(['a', 'b', 'c', 'd']);
    const second = matchRound(words, first.map(w => w.id), keep);
    expect(second.map(w => w.word)).toEqual(['e', 'a', 'b', 'c']);
  });

  it('counts distinct meanings after trimming', () => {
    expect(distinctMeanings(make([['a', '同'], ['b', ' 同 ']]))).toBe(1);
  });
});
