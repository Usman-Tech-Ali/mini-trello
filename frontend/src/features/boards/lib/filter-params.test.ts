import { describe, expect, it } from 'vitest';

import { applyFilterPatch, parseFilterParams } from './filter-params';

const MEMBER = '507f1f77bcf86cd799439011';
const COLUMN = '507f1f77bcf86cd799439012';

describe('parseFilterParams', () => {
  it('reads valid filters from the URL', () => {
    const params = new URLSearchParams(
      `q=%20login%20&assignee=${MEMBER}&priority=high&column=${COLUMN}`,
    );
    expect(parseFilterParams(params)).toEqual({
      q: 'login',
      assignee: MEMBER,
      priority: 'high',
      column: COLUMN,
    });
  });

  it('accepts "unassigned" and ignores invalid or empty values one by one', () => {
    const params = new URLSearchParams('assignee=unassigned&priority=urgent&column=nope&q=');
    expect(parseFilterParams(params)).toEqual({ assignee: 'unassigned' });
  });
});

describe('applyFilterPatch', () => {
  it('sets and removes filters while keeping unrelated params', () => {
    const params = new URLSearchParams('q=old&priority=low&tab=x');
    expect(applyFilterPatch(params, { q: 'new', priority: undefined })).toBe('q=new&tab=x');
    expect(applyFilterPatch(params, { q: '' })).toBe('priority=low&tab=x');
  });
});
