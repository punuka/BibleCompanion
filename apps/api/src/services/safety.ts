import type { CrisisResource, SafetyLevel, SafetyNotice } from '@bible/shared';
import resources from '../../data/crisis-resources.json' with { type: 'json' };

/**
 * Pre-model crisis screen.
 *
 * Runs on every inbound chat message and comfort submission, BEFORE the model
 * sees anything. Deliberately blunt and deliberately biased toward false
 * positives: showing a hotline to someone who did not need it costs a moment of
 * friction, missing someone who did costs immeasurably more.
 *
 * Do not replace this with a model call. A model can be argued out of a
 * refusal; a pattern match cannot. The model's job is the response, not triage.
 */

const CRISIS_PATTERNS: RegExp[] = [
  // English
  /\b(kill|killing)\s+(myself|my ?self)\b/i,
  /\bsuicid(e|al)\b/i,
  /\b(end|ending|take|taking)\s+(my|his|her|their)\s+(own\s+)?life\b/i,
  /\bwant\s+to\s+die\b/i,
  /\bdon'?t\s+want\s+to\s+(live|be\s+here|wake\s+up)\b/i,
  /\bbetter\s+off\s+(dead|without\s+me)\b/i,
  /\bno\s+reason\s+to\s+(live|go\s+on)\b/i,
  /\b(hurt|harm|cut|cutting)\s+(myself|my ?self)\b/i,
  /\bself[-\s]?harm\b/i,
  /\boverdos(e|ing)\b/i,
  /\b(kill|hurt)\s+(him|her|them|someone)\b/i,
  // Spanish
  /\b(suicid(io|arme|a)|quitarme\s+la\s+vida|matarme)\b/i,
  /\bquiero\s+morir(me)?\b/i,
  // Portuguese
  /\b(suic[ií]dio|me\s+matar|tirar\s+minha\s+vida)\b/i,
  /\bquero\s+morrer\b/i,
  // French
  /\b(suicide|me\s+tuer|mettre\s+fin\s+[àa]\s+mes\s+jours)\b/i,
  /\bje\s+veux\s+mourir\b/i,
  // German
  /\b(selbstmord|suizid|mich\s+umbringen)\b/i,
  // Swahili
  /\b(kujiua|nataka\s+kufa)\b/i,
  // Indonesian / Filipino
  /\b(bunuh\s+diri|ingin\s+mati)\b/i,
  /\b(magpakamatay|gusto\s+ko\s+nang\s+mamatay)\b/i,
];

const CONCERN_PATTERNS: RegExp[] = [
  /\b(hopeless|worthless|can'?t\s+go\s+on|giving\s+up|nothing\s+matters)\b/i,
  /\b(despair|unbearable|numb\s+all\s+the\s+time)\b/i,
  /\b(abuse|abusing|abused|beats?\s+me|hits?\s+me)\b/i,
  /\b(desesperad[oa]|no\s+puedo\s+m[áa]s|sin\s+esperanza)\b/i,
  /\b(sem\s+esperan[çc]a|n[ãa]o\s+aguento\s+mais)\b/i,
  /\b(d[ée]sespoir|je\s+n'?en\s+peux\s+plus)\b/i,
  /\b(hoffnungslos|ich\s+kann\s+nicht\s+mehr)\b/i,
];

const ALL_RESOURCES = resources as CrisisResource[];

const MESSAGES: Record<string, { crisis: string; concern: string }> = {
  en: {
    crisis:
      'It sounds like you may be in danger right now. Please reach one of these — they are free, confidential, and staffed by people trained for exactly this moment.',
    concern:
      'What you are carrying sounds heavy. If it gets to be too much, these are here for you at any hour.',
  },
  es: {
    crisis:
      'Parece que podrías estar en peligro ahora mismo. Por favor comunícate con alguno de estos servicios: son gratuitos, confidenciales y atendidos por personas preparadas para este momento.',
    concern:
      'Lo que estás cargando suena pesado. Si llega a ser demasiado, esto está disponible a cualquier hora.',
  },
  pt: {
    crisis:
      'Parece que você pode estar em perigo agora. Por favor, procure um destes serviços: são gratuitos, confidenciais e atendidos por pessoas preparadas para este momento.',
    concern:
      'O que você está carregando parece pesado. Se ficar demais, isto está disponível a qualquer hora.',
  },
  fr: {
    crisis:
      "Il semble que vous soyez peut-être en danger en ce moment. Contactez l'un de ces services : ils sont gratuits, confidentiels et assurés par des personnes formées pour cela.",
    concern:
      "Ce que vous portez semble lourd. Si cela devient trop, ces ressources sont là à toute heure.",
  },
};

export function screen(text: string, language: string): SafetyNotice | null {
  const level: SafetyLevel = CRISIS_PATTERNS.some((p) => p.test(text))
    ? 'crisis'
    : CONCERN_PATTERNS.some((p) => p.test(text))
      ? 'concern'
      : 'none';

  if (level === 'none') return null;

  const copy = MESSAGES[language] ?? MESSAGES.en!;

  // Global resources always show. Region-specific ones are surfaced too —
  // we cannot reliably geolocate a user, and an extra hotline in the list is
  // harmless next to the cost of showing none.
  const shown = ALL_RESOURCES.filter((r) => (level === 'crisis' ? true : r.region === 'Global'));

  return {
    level,
    resources: shown,
    message: level === 'crisis' ? copy.crisis : copy.concern,
  };
}
