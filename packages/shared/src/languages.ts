/**
 * The language registry. This is the single source of truth for every language
 * the app supports — the system prompt builder, the counsellor filter, the
 * verse store, and the mobile picker all read from here.
 *
 * Adding a language: append an entry, add the UI dictionary in
 * apps/mobile/src/i18n/strings.ts, and (optionally) seed verses for it.
 */

export interface Language {
  /** BCP-47 primary subtag. */
  code: string;
  /** English name, for admin surfaces and logs. */
  name: string;
  /** The language's own name, for the picker. Users look for this, not the English name. */
  endonym: string;
  /** Right-to-left script. Drives I18nManager and text alignment. */
  rtl: boolean;
  /**
   * Bible translation the model should quote in this language.
   * Must be public domain or licensed — see references/ai-chat.md.
   */
  translation: string;
}

export const LANGUAGES: readonly Language[] = [
  { code: 'en', name: 'English', endonym: 'English', rtl: false, translation: 'WEB' },
  { code: 'es', name: 'Spanish', endonym: 'Español', rtl: false, translation: 'RVA' },
  { code: 'pt', name: 'Portuguese', endonym: 'Português', rtl: false, translation: 'ALMEIDA' },
  { code: 'fr', name: 'French', endonym: 'Français', rtl: false, translation: 'LSG' },
  { code: 'de', name: 'German', endonym: 'Deutsch', rtl: false, translation: 'LUTH1912' },
  { code: 'it', name: 'Italian', endonym: 'Italiano', rtl: false, translation: 'DIODATI' },
  { code: 'sw', name: 'Swahili', endonym: 'Kiswahili', rtl: false, translation: 'SWAHILI' },
  { code: 'ha', name: 'Hausa', endonym: 'Harshen Hausa', rtl: false, translation: 'HAUSA' },
  { code: 'yo', name: 'Yoruba', endonym: 'Èdè Yorùbá', rtl: false, translation: 'YORUBA' },
  { code: 'ig', name: 'Igbo', endonym: 'Asụsụ Igbo', rtl: false, translation: 'IGBO' },
  { code: 'am', name: 'Amharic', endonym: 'አማርኛ', rtl: false, translation: 'AMHARIC' },
  { code: 'ar', name: 'Arabic', endonym: 'العربية', rtl: true, translation: 'SVD' },
  { code: 'hi', name: 'Hindi', endonym: 'हिन्दी', rtl: false, translation: 'IRV' },
  { code: 'tl', name: 'Filipino', endonym: 'Filipino', rtl: false, translation: 'ABTAG' },
  { code: 'id', name: 'Indonesian', endonym: 'Bahasa Indonesia', rtl: false, translation: 'TB' },
  { code: 'ko', name: 'Korean', endonym: '한국어', rtl: false, translation: 'KRV' },
  { code: 'zh', name: 'Chinese (Simplified)', endonym: '简体中文', rtl: false, translation: 'CUV' },
  { code: 'ru', name: 'Russian', endonym: 'Русский', rtl: false, translation: 'SYNODAL' },
] as const;

export const DEFAULT_LANGUAGE = 'en';

const BY_CODE = new Map(LANGUAGES.map((l) => [l.code, l]));

export function getLanguage(code: string | null | undefined): Language {
  return BY_CODE.get(code ?? '') ?? BY_CODE.get(DEFAULT_LANGUAGE)!;
}

export function isSupportedLanguage(code: string): boolean {
  return BY_CODE.has(code);
}
