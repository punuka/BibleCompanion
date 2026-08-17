/**
 * Comfort categories. Each maps to verse `themes` in the Bible store, so the
 * comfort flow can pre-fetch relevant scripture before the model composes.
 *
 * Adding one: append here, then tag verses with the same theme strings in
 * apps/api/data/verses.*.json and re-seed.
 */

export interface Situation {
  id: string;
  /** English label; the mobile app translates via i18n keyed on `id`. */
  label: string;
  /** Verse themes to pre-fetch for this situation. */
  themes: string[];
  emoji: string;
}

export const SITUATIONS: readonly Situation[] = [
  { id: 'grief', label: 'Grief and loss', themes: ['comfort', 'mourning', 'hope'], emoji: '🕯️' },
  { id: 'anxiety', label: 'Anxiety and worry', themes: ['peace', 'trust', 'fear'], emoji: '🌊' },
  { id: 'loneliness', label: 'Loneliness', themes: ['presence', 'belonging', 'comfort'], emoji: '🌙' },
  { id: 'illness', label: 'Illness and pain', themes: ['healing', 'endurance', 'comfort'], emoji: '🤲' },
  { id: 'work', label: 'Work and provision', themes: ['provision', 'trust', 'work'], emoji: '🌾' },
  { id: 'family', label: 'Family and marriage', themes: ['love', 'forgiveness', 'patience'], emoji: '🏠' },
  { id: 'guilt', label: 'Guilt and shame', themes: ['forgiveness', 'grace', 'mercy'], emoji: '🕊️' },
  { id: 'doubt', label: 'Doubt and faith', themes: ['faith', 'seeking', 'trust'], emoji: '🔦' },
  { id: 'anger', label: 'Anger and conflict', themes: ['patience', 'peace', 'forgiveness'], emoji: '🔥' },
  { id: 'purpose', label: 'Purpose and direction', themes: ['guidance', 'calling', 'wisdom'], emoji: '🧭' },
  { id: 'gratitude', label: 'Gratitude and praise', themes: ['thanksgiving', 'joy', 'praise'], emoji: '✨' },
  { id: 'temptation', label: 'Temptation and struggle', themes: ['strength', 'endurance', 'grace'], emoji: '⛰️' },
];

export const SITUATION_IDS = SITUATIONS.map((s) => s.id);

/** Counsellor specialties. Kept separate from situations: a counsellor's
 *  expertise is not the same axis as a moment's need. */
export const SPECIALTIES = [
  'grief-and-bereavement',
  'marriage-and-family',
  'youth-and-students',
  'addiction-recovery',
  'anxiety-and-depression',
  'trauma-informed-care',
  'spiritual-direction',
  'scripture-study',
  'prayer-ministry',
  'vocational-discernment',
  'financial-stewardship',
  'chaplaincy',
] as const;

export type Specialty = (typeof SPECIALTIES)[number];
