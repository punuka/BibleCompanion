import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { LANGUAGES, SPECIALTIES } from '@bible/shared';
import { api } from '../src/api/client';
import { useAuth } from '../src/state/auth';
import { Button, Chip, ErrorBanner, Field } from '../src/components/ui';
import { theme } from '../src/theme';

export default function Apply() {
  const { t, language, user, refresh } = useAuth();
  const router = useRouter();
  const navigation = useNavigation();

  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [credentials, setCredentials] = useState('');
  const [organization, setOrganization] = useState('');
  const [years, setYears] = useState('');
  const [contactEmail, setContactEmail] = useState(user?.email ?? '');
  const [languages, setLanguages] = useState<string[]>([language]);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: t.becomeCounselor });
  }, [navigation, t.becomeCounselor]);

  // Prefill from an existing application so "update" is an edit, not a rewrite.
  useEffect(() => {
    void (async () => {
      try {
        const existing = await api.myApplication();
        setHeadline(existing.headline);
        setBio(existing.bio);
        setOrganization(existing.organization ?? '');
        setYears(String(existing.yearsExperience));
        setLanguages(existing.languages);
        setSpecialties(existing.specialties);
      } catch {
        // No prior application; the blank form is correct.
      }
    })();
  }, []);

  function toggle(list: string[], value: string, set: (next: string[]) => void) {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      await api.applyAsCounselor({
        headline: headline.trim(),
        bio: bio.trim(),
        credentials: credentials.trim(),
        organization: organization.trim() || undefined,
        yearsExperience: Number(years) || 0,
        contactEmail: contactEmail.trim(),
        languages,
        specialties,
      });
      await refresh();
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
    } finally {
      setBusy(false);
    }
  }

  // Named so the disabled submit button can say *why* — a silent disabled
  // state with six unlabelled requirements (three of them length minimums
  // with no visible counter, one of them a chip-tap easy to miss entirely)
  // otherwise reads as broken rather than incomplete.
  const missingRequirements: string[] = [];
  if (headline.trim().length < 10) missingRequirements.push('Headline: 10+ characters');
  if (bio.trim().length < 100)
    missingRequirements.push(`About your work: 100+ characters (${bio.trim().length}/100)`);
  if (credentials.trim().length < 10) missingRequirements.push('Credentials: 10+ characters');
  if (languages.length === 0) missingRequirements.push('Select at least one language');
  if (specialties.length === 0) missingRequirements.push('Select at least one area of focus');
  if (!contactEmail.includes('@')) missingRequirements.push('Contact email looks incomplete');

  const valid = missingRequirements.length === 0;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.notice}>
          Applications are reviewed by a person before your profile becomes visible. Nothing you
          write here is public until it is approved, and your credentials and contact email are
          never shown in the directory.
        </Text>

        <ErrorBanner message={error} />

        <Field
          label="Headline"
          value={headline}
          onChangeText={setHeadline}
          placeholder="Pastoral counsellor, 12 years, grief and bereavement"
        />
        <Field
          label="About your work (100+ characters)"
          value={bio}
          onChangeText={setBio}
          multiline
          placeholder="How you work, who you have walked with, what someone can expect."
        />
        <Field
          label="Credentials (reviewed privately)"
          value={credentials}
          onChangeText={setCredentials}
          multiline
          placeholder="Ordination, licences, training, references."
        />
        <Field
          label="Organization (optional)"
          value={organization}
          onChangeText={setOrganization}
          placeholder="Church, hospital, or practice"
        />
        <Field
          label="Years of experience"
          value={years}
          onChangeText={setYears}
          keyboardType="number-pad"
          placeholder="12"
        />
        <Field
          label="Contact email (reviewed privately)"
          value={contactEmail}
          onChangeText={setContactEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Text style={styles.label}>Languages you counsel in</Text>
        <View style={styles.chips}>
          {LANGUAGES.map((l) => (
            <Chip
              key={l.code}
              label={l.endonym}
              selected={languages.includes(l.code)}
              onPress={() => toggle(languages, l.code, setLanguages)}
            />
          ))}
        </View>

        <Text style={styles.label}>Areas of focus</Text>
        <View style={styles.chips}>
          {SPECIALTIES.map((s) => (
            <Chip
              key={s}
              label={s.replace(/-/g, ' ')}
              selected={specialties.includes(s)}
              onPress={() => toggle(specialties, s, setSpecialties)}
            />
          ))}
        </View>

        <View style={styles.spacer} />
        {!valid ? (
          <View style={styles.requirements}>
            <Text style={styles.requirementsTitle}>Before you can submit:</Text>
            {missingRequirements.map((requirement) => (
              <Text key={requirement} style={styles.requirementText}>
                •  {requirement}
              </Text>
            ))}
          </View>
        ) : null}
        <Button
          label="Submit application"
          onPress={() => void submit()}
          loading={busy}
          disabled={!valid}
        />
        <View style={styles.spacerSmall} />
        <Button label={t.cancel} variant="ghost" onPress={() => router.back()} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.bg },
  container: { padding: theme.space(4), paddingBottom: theme.space(12) },
  notice: {
    color: theme.colors.textMuted,
    fontSize: theme.font.small,
    lineHeight: 21,
    marginBottom: theme.space(6),
  },
  label: {
    color: theme.colors.textMuted,
    fontSize: theme.font.small,
    marginBottom: theme.space(2),
    marginTop: theme.space(2),
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  spacer: { height: theme.space(6) },
  spacerSmall: { height: theme.space(3) },
  requirements: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.space(4),
    marginBottom: theme.space(3),
  },
  requirementsTitle: {
    color: theme.colors.accent,
    fontSize: theme.font.small,
    fontWeight: '600',
    marginBottom: theme.space(2),
  },
  requirementText: {
    color: theme.colors.textMuted,
    fontSize: theme.font.small,
    lineHeight: 20,
  },
});
