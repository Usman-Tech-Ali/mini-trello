import { describe, expect, it } from 'vitest';

import { PresenceTracker } from './presence';

describe('PresenceTracker', () => {
  it('reports when users come online and go offline', () => {
    const presence = new PresenceTracker();
    expect(presence.join('b1', 'alice', 's1')).toBe(true);
    expect(presence.join('b1', 'bob', 's2')).toBe(true);
    expect(presence.usersOn('b1').sort()).toEqual(['alice', 'bob']);

    expect(presence.leave('b1', 'bob', 's2')).toBe(true);
    expect(presence.usersOn('b1')).toEqual(['alice']);
  });

  it('keeps a user online until their last tab leaves', () => {
    const presence = new PresenceTracker();
    presence.join('b1', 'alice', 'tab1');
    expect(presence.join('b1', 'alice', 'tab2')).toBe(false);

    expect(presence.leave('b1', 'alice', 'tab1')).toBe(false);
    expect(presence.usersOn('b1')).toEqual(['alice']);
    expect(presence.leave('b1', 'alice', 'tab2')).toBe(true);
    expect(presence.usersOn('b1')).toEqual([]);
  });

  it('keeps boards independent and ignores unknown leaves', () => {
    const presence = new PresenceTracker();
    presence.join('b1', 'alice', 's1');
    presence.join('b2', 'alice', 's2');
    expect(presence.leave('b1', 'alice', 'unknown')).toBe(false);
    presence.clearBoard('b1');
    expect(presence.usersOn('b1')).toEqual([]);
    expect(presence.usersOn('b2')).toEqual(['alice']);
  });
});
