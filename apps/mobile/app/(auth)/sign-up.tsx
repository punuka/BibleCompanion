import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Link } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DEFAULT_LANGUAGE, LANGUAGES } from '@bible/shared';
import { useAuth } from '../../src/state/auth';
import { Button, Chip, ErrorBanner, Field } from '../../src/components/ui';
import { dictFor } from '../../src/i18n/strings';
import { theme } from '../../src/theme';

export default function SignUp() {
  const { signUp } = useAuth();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Chrome follows the language being picked, before the account exists —
  // choosing Kiswahili should feel like it took effect immediately.
  const t = dictFor(language);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      await signUp({
        email: email.trim(),
        password,
        displayName: displayName.trim(),
        language,
      });
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
        contentContainerStyle={[styles.container, { paddingTop: insets.top + theme.space(10) }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>{t.createAccount}</Text>

        <View style={styles.form}>
          <ErrorBanner message={error} />
          <Field
            label={t.displayName}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Mary"
            autoComplete="name"
          />
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
            autoComplete="new-password"
            placeholder="At least 8 characters"
          />

          <Text style={styles.fieldLabel}>{t.language}</Text>
          <View style={styles.chips}>
            {LANGUAGES.map((l) => (
              <Chip
                key={l.code}
                label={l.endonym}
                selected={language === l.code}
                onPress={() => setLanguage(l.code)}
              />
            ))}
          </View>

          <View style={styles.submit}>
            <Button label={t.createAccount} onPress={() => void submit()} loading={busy} />
          </View>

          <Link href="/(auth)/sign-in" asChild>
            <Pressable style={styles.switch}>
              <Text style={styles.switchText}>
                {t.haveAccount} <Text style={styles.switchLink}>{t.signIn}</Text>
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
  container: { paddingHorizontal: theme.space(6), paddingBottom: theme.space(12) },
  title: { color: theme.colors.text, fontSize: theme.font.title, fontWeight: '700' },
  form: { marginTop: theme.space(8) },
  fieldLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.font.small,
    marginBottom: theme.space(2),
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  submit: { marginTop: theme.space(4) },
  switch: { marginTop: theme.space(6), alignItems: 'center' },
  switchText: { color: theme.colors.textMuted, fontSize: theme.font.small },
  switchLink: { color: theme.colors.accent, fontWeight: '600' },
});
