import { useLayoutEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SITUATIONS, type ComfortResponse } from '@bible/shared';
import { api } from '../../src/api/client';
import { stopSpeaking } from '../../src/audio/tts';
import { useAuth } from '../../src/state/auth';
import { ComfortResult } from '../../src/components/ComfortResult';
import { Button, Chip, ErrorBanner, Field, MicButton } from '../../src/components/ui';
import { theme } from '../../src/theme';

export default function Comfort() {
  const { t, language } = useAuth();
  const navigation = useNavigation();
  const router = useRouter();
  const [situation, setSituation] = useState<string | null>(null);
  const [freeText, setFreeText] = useState('');
  const [result, setResult] = useState<ComfortResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    stopSpeaking();
    setError(null);
    setBusy(true);
    setResult(null);
    try {
      setResult(await api.comfort({ situation, freeText: freeText.trim() }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    stopSpeaking();
    setResult(null);
    setFreeText('');
    setSituation(null);
    setError(null);
  }

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.comfortHistory}
          hitSlop={8}
          onPress={() => router.push('/comfort/history')}
          style={styles.historyButton}
        >
          <Ionicons name="time-outline" size={22} color={theme.colors.text} />
        </Pressable>
      ),
    });
  }, [navigation, router, t.comfortHistory]);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {result ? (
          <>
            <ComfortResult result={result} t={t} language={language} autoPlay />
            <View style={styles.spacer} />
            <Button label={t.findComfort} variant="ghost" onPress={reset} />
          </>
        ) : (
          <>
            <Text style={styles.intro}>{t.comfortIntro}</Text>

            <Text style={styles.label}>{t.chooseSituation}</Text>
            <View style={styles.chips}>
              {SITUATIONS.map((s) => (
                <Chip
                  key={s.id}
                  label={`${s.emoji}  ${s.label}`}
                  selected={situation === s.id}
                  // Tapping a selected chip clears it — the category is a hint,
                  // not a required field, and people often do not fit one.
                  onPress={() => setSituation((prev) => (prev === s.id ? null : s.id))}
                />
              ))}
            </View>

            <View style={styles.spacer} />
            <ErrorBanner message={error} />
            <Field
              label={t.describeSituation}
              value={freeText}
              onChangeText={setFreeText}
              multiline
              placeholder="…"
            />
            <View style={styles.micRow}>
              <MicButton
                language={language}
                recordLabel={t.recordVoice}
                stopLabel={t.stopRecording}
                onTranscribed={(text) =>
                  setFreeText((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text))
                }
                onError={setError}
              />
            </View>
            <Button
              label={t.findComfort}
              onPress={() => void submit()}
              loading={busy}
              disabled={freeText.trim().length === 0}
            />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.bg },
  container: { padding: theme.space(4), paddingBottom: theme.space(12) },
  intro: {
    color: theme.colors.textMuted,
    fontSize: theme.font.body,
    lineHeight: 24,
    marginBottom: theme.space(6),
  },
  label: {
    color: theme.colors.textMuted,
    fontSize: theme.font.small,
    marginBottom: theme.space(2),
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  spacer: { height: theme.space(4) },
  micRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: theme.space(3) },
  historyButton: { paddingHorizontal: theme.space(3), paddingVertical: theme.space(2) },
});
