import { describe, expect, it } from 'vitest';
import { screen } from '../src/services/safety.js';

/**
 * The safety screen is biased toward false positives by design. These tests
 * pin that bias in place: a change that makes the screen "smarter" by tightening
 * it should fail here loudly rather than quietly stop catching people.
 */
describe('crisis screening', () => {
  const crisisPhrases = [
    'I want to kill myself',
    'i have been thinking about suicide',
    "I don't want to live anymore",
    'everyone would be better off without me',
    'I want to hurt myself tonight',
    'thinking about ending my life',
    'Quiero morir',
    'estoy pensando en el suicidio',
    'je veux mourir',
    'ich will mich umbringen',
    'nataka kufa',
  ];

  for (const phrase of crisisPhrases) {
    it(`flags as crisis: "${phrase}"`, () => {
      const result = screen(phrase, 'en');
      expect(result?.level).toBe('crisis');
      expect(result?.resources.length).toBeGreaterThan(0);
    });
  }

  it('returns resources with a usable contact for every crisis hit', () => {
    const result = screen('I want to kill myself', 'en');
    for (const resource of result!.resources) {
      expect(resource.name).toBeTruthy();
      expect(resource.contact).toBeTruthy();
    }
  });

  it('localises the accompanying message', () => {
    const en = screen('I want to kill myself', 'en');
    const es = screen('I want to kill myself', 'es');
    expect(en?.message).not.toBe(es?.message);
    expect(es?.message).toMatch(/peligro/i);
  });

  it('falls back to English copy for a language with no translation yet', () => {
    const result = screen('I want to kill myself', 'ko');
    expect(result?.level).toBe('crisis');
    expect(result?.message).toMatch(/danger/i);
  });
});

describe('concern screening', () => {
  it('flags distress that is not an explicit crisis', () => {
    const result = screen('I feel completely hopeless and worthless', 'en');
    expect(result?.level).toBe('concern');
    expect(result?.resources.length).toBeGreaterThan(0);
  });

  it('shows only global resources at concern level', () => {
    const result = screen('I feel hopeless', 'en');
    expect(result!.resources.every((r) => r.region === 'Global')).toBe(true);
  });
});

describe('ordinary messages', () => {
  const benign = [
    'What does Psalm 23 mean?',
    'I lost my job last week and I am worried about rent',
    'Can you explain the parable of the prodigal son?',
    'My grandmother died on Sunday and I miss her',
    'I am struggling with anger toward my brother',
  ];

  for (const phrase of benign) {
    it(`does not flag: "${phrase}"`, () => {
      expect(screen(phrase, 'en')).toBeNull();
    });
  }
});
