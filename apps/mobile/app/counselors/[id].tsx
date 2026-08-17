import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { getLanguage, type CounselorProfile } from '@bible/shared';
import { api } from '../../src/api/client';
import { useAuth } from '../../src/state/auth';
import { Button, ErrorBanner, Field, Loading } from '../../src/components/ui';
import { theme } from '../../src/theme';

export default function CounselorDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useAuth();
  const router = useRouter();
  const navigation = useNavigation();

  const [profile, setProfile] = useState<CounselorProfile | null>(null);
  const [topic, setTopic] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const p = await api.counselor(id);
        setProfile(p);
        navigation.setOptions({ title: p.displayName });
      } catch (err) {
        setError(err instanceof Error ? err.message : t.error);
      }
    })();
  }, [id, navigation, t.error]);

  async function requestConnection() {
    setError(null);
    setBusy(true);
    try {
      const connection = await api.requestConnection(id, { topic: topic.trim() });
      router.replace(`/connections/${connection.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
    } finally {
      setBusy(false);
    }
  }

  if (!profile) return error ? <ErrorScreen message={error} /> : <Loading />;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.headline}>{profile.headline}</Text>

        <View style={styles.meta}>
          <Text style={styles.metaItem}>
            {profile.yearsExperience} {t.yearsExperience}
          </Text>
          {profile.organization ? (
            <Text style={styles.metaItem}>· {profile.organization}</Text>
          ) : null}
        </View>

        <Text style={styles.sectionLabel}>{t.speaks}</Text>
        <Text style={styles.body}>
          {profile.languages.map((code) => getLanguage(code).endonym).join(' · ')}
        </Text>

        <Text style={styles.sectionLabel}>Focus</Text>
        <Text style={styles.body}>
          {profile.specialties.map((s) => s.replace(/-/g, ' ')).join(' · ')}
        </Text>

        <Text style={styles.sectionLabel}>About</Text>
        <Text style={styles.body}>{profile.bio}</Text>

        <View style={styles.divider} />

        <Text style={styles.sectionLabel}>{t.requestConnection}</Text>
        <ErrorBanner message={error} />
        <Field
          label={t.topic}
          value={topic}
          onChangeText={setTopic}
          multiline
          placeholder="…"
        />
        <Text style={styles.hint}>{t.topicHint}</Text>
        <Button
          label={t.requestConnection}
          onPress={() => void requestConnection()}
          loading={busy}
          disabled={topic.trim().length < 5}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <View style={styles.errorScreen}>
      <ErrorBanner message={message} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.bg },
  container: { padding: theme.space(4), paddingBottom: theme.space(12) },
  errorScreen: { flex: 1, backgroundColor: theme.colors.bg, padding: theme.space(4) },
  headline: { color: theme.colors.text, fontSize: theme.font.heading, lineHeight: 27 },
  meta: { flexDirection: 'row', gap: theme.space(2), marginTop: theme.space(2) },
  metaItem: { color: theme.colors.textFaint, fontSize: theme.font.small },
  sectionLabel: {
    color: theme.colors.accent,
    fontSize: theme.font.tiny,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: theme.space(6),
    marginBottom: theme.space(2),
  },
  body: { color: theme.colors.text, fontSize: theme.font.body, lineHeight: 25 },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.space(7),
  },
  hint: {
    color: theme.colors.textFaint,
    fontSize: theme.font.tiny,
    marginTop: -theme.space(2),
    marginBottom: theme.space(4),
  },
});
