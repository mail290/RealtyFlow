import { describe, it, expect } from 'vitest';
import { resolveTranslation } from './resolveTranslation';

const rows = [
  { locale: 'en', title: 'Kitchen drain trap — filled' },
  { locale: 'es', title: 'Sifón de la cocina — lleno' },
  { locale: 'no', title: 'Vannlås kjøkken — fylt' },
];

describe('resolveTranslation', () => {
  it('returns the requested locale when present', () => {
    expect(resolveTranslation(rows, 'no', 'en')).toBe('Vannlås kjøkken — fylt');
    expect(resolveTranslation(rows, 'es', 'en')).toBe('Sifón de la cocina — lleno');
  });

  it('falls back to org default when requested is missing', () => {
    // German requested, org default Norwegian, no German row
    expect(resolveTranslation(rows, 'de', 'no')).toBe('Vannlås kjøkken — fylt');
  });

  it('falls back to final fallback (en) when requested and org default missing', () => {
    // German requested, org default Dutch, only en/es/no exist
    expect(resolveTranslation(rows, 'de', 'nl')).toBe('Kitchen drain trap — filled');
  });

  it('treats a blank/whitespace value as missing and keeps falling back', () => {
    const withBlank = [
      { locale: 'de', title: '   ' },
      { locale: 'en', title: 'English' },
    ];
    expect(resolveTranslation(withBlank, 'de', 'en')).toBe('English');
  });

  it('throws a clear error when the text is missing in every language', () => {
    expect(() => resolveTranslation([], 'no', 'en')).toThrow(/no 'title' found/);
    expect(() => resolveTranslation(null, 'no', 'en')).toThrow(/no 'title' found/);
  });

  it('never returns an empty string for a required field', () => {
    const onlyOther = [{ locale: 'fr', title: 'Bonjour' }];
    // requested no, org default en, fallback en — none match fr
    expect(() => resolveTranslation(onlyOther, 'no', 'en')).toThrow();
  });

  it('supports custom fields and optional mode (help_text)', () => {
    const help = [{ locale: 'no', title: 'x', help_text: 'Hjelp' }];
    expect(resolveTranslation(help, 'no', 'en', { field: 'help_text' })).toBe('Hjelp');
    // optional field missing everywhere returns '' instead of throwing
    expect(
      resolveTranslation(help, 'de', 'es', { field: 'help_text', optional: true }),
    ).toBe('');
  });

  it('handles duplicate locales in the chain (requested === org default)', () => {
    expect(resolveTranslation(rows, 'en', 'en')).toBe('Kitchen drain trap — filled');
  });
});
