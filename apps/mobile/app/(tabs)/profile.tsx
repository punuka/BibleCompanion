import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { LANGUAGES, type CounselorProfile } from '@bible/shared';
import { api, API_URL } from '../../src/api/client';
import { useAuth } from '../../src/state/auth';
import { Button, Chip, ErrorBanner } from '../../src/components/ui';
import { theme } from '../../src/theme';

export default function Profile() {
  const { user, t, language, setLanguage, signOut } = useAuth();
  const router = useRouter();
  const [application, setApplication] = useState<CounselorProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        try {
          setApplication(await api.myApplication());
        } catch {
          // 404 just means "has not applied" — not an error worth surfacing.
          setApplication(null);
        }
      })();
    }, []),
  );

  async function changeLanguage(code: string) {
    try {
      setError(null);
      await setLanguage(code);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
    }
  }

  const applicationStatus =
    application?.status === 'APPROVED'
      ? t.applicationApproved
      : application?.status === 'PENDING'
        ? t.applicationPending
        : application?.status === 'REJECTED'
          ? t.applicationRejected
          : null;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <Text style={styles.name}>{user?.displayName}</Text>
      <Text style={styles.email}>{user?.email}</Text>
      {user?.role !== 'USER' ? (
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>{user?.role}</Text>
        </View>
      ) : null}

      <ErrorBanner message={error} />

      <Text style={styles.sectionLabel}>{t.language}</Text>
      <Text style={styles.hint}>
        This sets the language of replies, verse translations, and which counsellors are shown.
      </Text>
      <View style={styles.chips}>
        {LANGUAGES.map((l) => (
          <Chip
            key={l.code}
            label={l.endonym}
            selected={language === l.code}
            onPress={() => void changeLanguage(l.code)}
          />
        ))}
      </View>

      <Text style={styles.sectionLabel}>{t.becomeCounselor}</Text>
      {applicationStatus ? (
        <View style={styles.statusCard}>
          <Text style={styles.statusText}>{applicationStatus}</Text>
        </View>
      ) : null}
      <Button
        label={application ? 'Update application' : t.becomeCounselor}
        variant="ghost"
        onPress={() => router.push('/apply')}
      />

      {user?.role === 'ADMIN' ? (
        <>
          <Text style={styles.sectionLabel}>Admin</Text>
          <Button label="Admin dashboard" variant="ghost" onPress={() => router.push('/admin')} />
        </>
      ) : null}

      <View style={styles.spacer} />
      <Button label={t.signOut} variant="danger" onPress={() => void signOut()} />

      <Text style={styles.debug}>API: {API_URL}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.bg },
  container: { padding: theme.space(4), paddingBottom: theme.space(12) },
  name: { color: theme.colors.text, fontSize: theme.font.title, fontWeight: '700' },
  email: { color: theme.colors.textMuted, fontSize: theme.font.small, marginTop: theme.space(1) },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.accentSoft,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.space(3),
    paddingVertical: theme.space(1),
    marginTop: theme.space(2),
  },
  roleBadgeText: {
    color: theme.colors.accent,
    fontSize: theme.font.tiny,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  sectionLabel: {
    color: theme.colors.accent,
    fontSize: theme.font.tiny,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: theme.space(8),
    marginBottom: theme.space(2),
  },
  hint: {
    color: theme.colors.textFaint,
    fontSize: theme.font.tiny,
    lineHeight: 17,
    marginBottom: theme.space(3),
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  statusCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.space(4),
    marginBottom: theme.space(3),
  },
  statusText: { color: theme.colors.text, fontSize: theme.font.small, lineHeight: 20 },
  spacer: { height: theme.space(10) },
  debug: {
    color: theme.colors.textFaint,
    fontSize: theme.font.tiny,
    textAlign: 'center',
    marginTop: theme.space(6),
  },
});
