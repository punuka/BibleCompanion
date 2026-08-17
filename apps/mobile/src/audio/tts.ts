import * as Speech from 'expo-speech';

/**
 * expo-speech accepts a bare language code, but a full BCP-47 locale picks a
 * better on-device voice where the OS has more than one option for a language.
 * Not every registry entry needs an override — only ones where the bare code
 * would be ambiguous or missing.
 */
const SPEECH_LOCALES: Record<string, string> = {
  en: 'en-US',
  es: 'es-ES',
  pt: 'pt-BR',
  fr: 'fr-FR',
  de: 'de-DE',
  it: 'it-IT',
  sw: 'sw-KE',
  ha: 'ha-NG',
  yo: 'yo-NG',
  ig: 'ig-NG',
  am: 'am-ET',
  ar: 'ar-SA',
  hi: 'hi-IN',
  tl: 'fil-PH',
  id: 'id-ID',
  ko: 'ko-KR',
  zh: 'zh-CN',
  ru: 'ru-RU',
};

function localeFor(languageCode: string): string {
  return SPEECH_LOCALES[languageCode] ?? languageCode;
}

/**
 * Speaks `text` aloud, on-device — no network call, no API key, no quota.
 * Stops whatever is currently speaking first so only one utterance plays at a
 * time; that also fires the previous call's onStopped, which callers rely on
 * to reset their own "speaking" UI state without any shared/global state.
 */
export function speak(
  text: string,
  languageCode: string,
  handlers: { onDone?: () => void } = {},
): void {
  Speech.stop();
  Speech.speak(text, {
    language: localeFor(languageCode),
    onDone: handlers.onDone,
    onStopped: handlers.onDone,
    onError: handlers.onDone,
  });
}

export function stopSpeaking(): void {
  Speech.stop();
}
