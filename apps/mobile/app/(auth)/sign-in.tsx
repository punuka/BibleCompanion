import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/state/auth';
import { Button, ErrorBanner, Field } from '../../src/components/ui';
import { theme } from '../../src/theme';

export default function SignIn() {
  const { signIn, t } = useAuth();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + theme.space(16) }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>{t.appName}</Text>
        <Text style={styles.tagline}>{t.tagline}</Text>

        <View style={styles.form}>
          <ErrorBanner message={error} />
          <Field
            label={t.email}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="you@example.com"
          />
          <Field
            label={t.password}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            placeholder="••••••••"
            onSubmitEditing={() => void submit()}
          />
          <Button label={t.signIn} onPress={() => void submit()} loading={busy} />

          <Link href="/(auth)/sign-up" asChild>
            <Pressable style={styles.switch}>
              <Text style={styles.switchText}>
                {t.noAccount} <Text style={styles.switchLink}>{t.signUp}</Text>
              </Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.bg },
  container: { paddingHorizontal: theme.space(6), paddingBottom: theme.space(10) },
  title: { color: theme.colors.text, fontSize: theme.font.title, fontWeight: '700' },
  tagline: {
    color: theme.colors.textMuted,
    fontSize: theme.font.body,
    marginTop: theme.space(2),
    lineHeight: 23,
  },
  form: { marginTop: theme.space(10) },
  switch: { marginTop: theme.space(6), alignItems: 'center' },
  switchText: { color: theme.colors.textMuted, fontSize: theme.font.small },
  switchLink: { color: theme.colors.accent, fontWeight: '600' },
});
