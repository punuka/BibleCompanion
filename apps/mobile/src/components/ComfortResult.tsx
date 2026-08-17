import { StyleSheet, Text, View } from 'react-native';
import type { ComfortResponse } from '@bible/shared';
import { CrisisCard, SpeakButton, VerseCard } from './ui';
import { theme } from '../theme';
import type { useAuth } from '../state/auth';

/**
 * Renders a single comfort response — used both for a just-generated result
 * and for reopening a past one from history, so the two never drift apart.
 */
export function ComfortResult({
  result,
  t,
  language,
  autoPlay,
}: {
  result: ComfortResponse;
  t: ReturnType<typeof useAuth>['t'];
  language: string;
  autoPlay?: boolean;
}) {
  const spoken = [result.acknowledgement, result.reflection, result.prayer]
    .filter(Boolean)
    .join('\n\n');

  return (
    <View>
      {result.safety ? <CrisisCard notice={result.safety} title={t.crisisTitle} /> : null}

      <View style={styles.ackRow}>
        <Text style={[styles.acknowledgement, styles.ackTextFlex]}>{result.acknowledgement}</Text>
        <SpeakButton
          text={spoken}
          language={language}
          listenLabel={t.listen}
          stopLabel={t.stopSpeaking}
          autoPlay={autoPlay}
        />
      </View>

      <Text style={styles.sectionLabel}>{t.scripture}</Text>
      {result.verses.map((v) => (
        <VerseCard
          key={v.ref}
          reference={v.ref}
          text={v.text}
          translation={v.translation}
          language={language}
          listenLabel={t.listen}
          stopLabel={t.stopSpeaking}
        />
      ))}

      <Text style={styles.sectionLabel}>{t.reflection}</Text>
      <Text style={styles.body}>{result.reflection}</Text>

      <Text style={styles.sectionLabel}>{t.prayer}</Text>
      <View style={styles.prayer}>
        <Text style={styles.prayerText}>{result.prayer}</Text>
      </View>

      {result.followUp.length > 0 ? (
        <>
          <Text style={styles.sectionLabel}>{t.toSitWith}</Text>
          {result.followUp.map((f, i) => (
            <Text key={i} style={styles.followUp}>
              ·  {f}
            </Text>
          ))}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  ackRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: theme.space(6) },
  ackTextFlex: { flex: 1 },
  acknowledgement: {
    color: theme.colors.text,
    fontSize: theme.font.heading,
    lineHeight: 28,
  },
  sectionLabel: {
    color: theme.colors.accent,
    fontSize: theme.font.tiny,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: theme.space(5),
    marginBottom: theme.space(3),
  },
  body: { color: theme.colors.text, fontSize: theme.font.body, lineHeight: 25 },
  prayer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.space(4),
  },
  prayerText: {
    color: theme.colors.verse,
    fontSize: theme.font.body,
    lineHeight: 26,
    fontStyle: 'italic',
  },
  followUp: {
    color: theme.colors.textMuted,
    fontSize: theme.font.body,
    lineHeight: 24,
    marginBottom: theme.space(2),
  },
});
