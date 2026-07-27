import { describe, it, expect } from 'vitest';
import { suggestIssues } from './issues';

describe('suggestIssues', () => {
  it('suggests creating a new issue for a deviation with no open match', () => {
    const out = suggestIssues(
      [{ item_code: 'exterior.awnings', title: 'Markise henger skjevt', note: { no: 'Ny motor?' } }],
      [],
    );
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('create');
    expect(out[0].title).toEqual({ no: 'Markise henger skjevt', _source: 'no' });
    expect(out[0].severity).toBe('medium');
  });

  it('suggests linking when an open issue exists on the same item_code', () => {
    const out = suggestIssues(
      [{ item_code: 'security.blinds', title: 'Treg persienne' }],
      [{ id: 'issue-1', item_code: 'security.blinds' }],
    );
    expect(out[0].kind).toBe('link');
    expect(out[0].link_to_issue_id).toBe('issue-1');
  });

  it('deduplicates multiple deviations on the same code into one suggestion', () => {
    const out = suggestIssues(
      [
        { item_code: 'water.leaks', title: 'Lekkasje' },
        { item_code: 'water.leaks', title: 'Lekkasje igjen' },
      ],
      [],
    );
    expect(out).toHaveLength(1);
  });

  it('carries a high severity (e.g. from a leak anomaly) into the suggestion', () => {
    const out = suggestIssues(
      [{ item_code: 'power.water_meter', title: 'Høyt forbruk', severity: 'high' }],
      [],
    );
    expect(out[0].severity).toBe('high');
  });

  it('honours the inspector locale for the jsonb title key', () => {
    const out = suggestIssues([{ item_code: 'x', title: 'Slow blind' }], [], 'en');
    expect(out[0].title).toEqual({ en: 'Slow blind', _source: 'en' });
  });

  it('ignores open issues with a null item_code', () => {
    const out = suggestIssues(
      [{ item_code: 'a', title: 't' }],
      [{ id: 'i', item_code: null }],
    );
    expect(out[0].kind).toBe('create');
  });
});
