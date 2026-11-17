import { describe, expect, it } from 'vitest';

import { activeMentionQuery, insertMention, matchMembers, splitMentions } from './mentions';

const members = [{ name: 'Sara Khan' }, { name: 'Ali Raza' }, { name: 'Salman Ahmed' }];

describe('activeMentionQuery', () => {
  it('finds the @query right before the caret', () => {
    expect(activeMentionQuery('hi @Sa', 6)).toEqual({ start: 3, query: 'Sa' });
    expect(activeMentionQuery('@', 1)).toEqual({ start: 0, query: '' });
    expect(activeMentionQuery('ask @Sara K', 11)).toEqual({ start: 4, query: 'Sara K' });
  });

  it('ignores emails, finished lines and text after the caret', () => {
    expect(activeMentionQuery('mail me@site', 12)).toBeNull();
    expect(activeMentionQuery('@Sara\nnext', 10)).toBeNull();
    expect(activeMentionQuery('hi @Sa there', 2)).toBeNull();
  });
});

describe('matchMembers', () => {
  it('matches the start of any word, best matches first', () => {
    expect(matchMembers(members, 'sa').map((m) => m.name)).toEqual(['Salman Ahmed', 'Sara Khan']);
    expect(matchMembers(members, 'raz').map((m) => m.name)).toEqual(['Ali Raza']);
    expect(matchMembers(members, 'zz')).toEqual([]);
    expect(matchMembers(members, '')).toHaveLength(3);
  });
});

describe('insertMention', () => {
  it('replaces the query with the full name and moves the caret after it', () => {
    const text = 'hi @sa tomorrow';
    const result = insertMention(text, { start: 3, query: 'sa' }, 6, 'Sara Khan');
    expect(result).toEqual({ text: 'hi @Sara Khan  tomorrow', caret: 14 });
  });
});

describe('splitMentions', () => {
  it('marks each mentioned name, longest name first', () => {
    expect(splitMentions('@Sara Khan and @Ali Raza, see @Sara', ['Ali Raza', 'Sara Khan'])).toEqual(
      [
        { text: '@Sara Khan', mention: true },
        { text: ' and ', mention: false },
        { text: '@Ali Raza', mention: true },
        { text: ', see @Sara', mention: false },
      ],
    );
  });

  it('treats names with special characters literally', () => {
    expect(splitMentions('cc @J. (Dev)', ['J. (Dev)'])).toEqual([
      { text: 'cc ', mention: false },
      { text: '@J. (Dev)', mention: true },
    ]);
    expect(splitMentions('plain', [])).toEqual([{ text: 'plain', mention: false }]);
  });
});
