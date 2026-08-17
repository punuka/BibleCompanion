import { describe, expect, it } from 'vitest';
import { LANGUAGES } from '@bible/shared';
import { buildChatSystemPrompt, buildComfortSystemPrompt } from '../src/services/gemini/prompts.js';

/**
 * Prompt builders must be pure functions of the language code. If one ever
 * becomes impure — a date, a user id, a counter — the failure is invisible
 * except as a subtly different reply on every request.
 */
describe('prompt cache stability', () => {
  it('produces byte-identical chat prompts across calls', () => {
    expect(buildChatSystemPrompt('en')).toBe(buildChatSystemPrompt('en'));
  });

  it('produces byte-identical comfort prompts across calls', () => {
    expect(buildComfortSystemPrompt('es')).toBe(buildComfortSystemPrompt('es'));
  });

  it('contains nothing that looks like a timestamp or id', () => {
    const prompt = buildChatSystemPrompt('en');
    expect(prompt).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(prompt).not.toMatch(/\b\d{10,}\b/);
  });

  it('exceeds the 512-token minimum cacheable prefix on Opus 5', () => {
    // Rough proxy: ~4 chars per token. The real check is a non-zero
    // usage.cache_read_input_tokens in production.
    expect(buildChatSystemPrompt('en').length).toBeGreaterThan(512 * 4);
  });
});

describe('prompt content invariants', () => {
  it('names the language and its translation for every registered language', () => {
    for (const lang of LANGUAGES) {
      const prompt = buildChatSystemPrompt(lang.code);
      expect(prompt).toContain(lang.name);
      expect(prompt).toContain(lang.endonym);
      expect(prompt).toContain(lang.translation);
    }
  });

  it('binds scripture quotation to the tools', () => {
    const prompt = buildChatSystemPrompt('en');
    expect(prompt).toContain('bible_lookup');
    expect(prompt).toContain('bible_search');
    expect(prompt).toMatch(/not quote scripture from memory/i);
  });

  it('keeps the medical, legal, and financial boundary', () => {
    const prompt = buildChatSystemPrompt('en');
    expect(prompt).toMatch(/medical, legal, or financial/i);
  });

  it('tells the model human counsellors exist', () => {
    expect(buildChatSystemPrompt('en')).toMatch(/counsellors are available/i);
  });

  it('asks for brevity by default', () => {
    expect(buildChatSystemPrompt('en')).toMatch(/brief by default/i);
  });

  it('falls back to English for an unregistered code rather than throwing', () => {
    expect(() => buildChatSystemPrompt('xx')).not.toThrow();
    expect(buildChatSystemPrompt('xx')).toContain('English');
  });
});
