import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ComfortResponse } from '@bible/shared';
import { api } from '../../src/api/client';
import { useAuth } from '../../src/state/auth';
import { stopSpeaking } from '../../src/audio/tts';
import { ComfortResult } from '../../src/components/ComfortResult';
import { Button, ErrorBanner, Loading } from '../../src/components/ui';
import { theme } from '../../src/theme';

export default function ComfortDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, language: defaultLanguage } = useAuth();
  const router = useRouter();

  const [result, setResult] = useState<ComfortResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setResult(await api.comfortSession(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
    }
  }, [id, t.error]);

  useEffect(() => {
    void load();
    return () => stopSpeaking();
  }, [load]);

  if (error) {
    return (
      <View style={styles.flex}>
        <ErrorBanner message={error} />
      </View>
    );
  }

  if (!result) return <Loading />;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <ComfortResult result={result} t={t} language={defaultLanguage} />
      <View style={styles.spacer} />
      <Button label={t.findComfort} variant="ghost" onPress={() => router.push('/(tabs)/comfort')} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.bg },
  container: { padding: theme.space(4), paddingBottom: theme.space(12) },
  spacer: { height: theme.space(4) },
});
