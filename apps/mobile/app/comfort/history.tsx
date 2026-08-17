import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SITUATIONS, type ComfortResponse } from '@bible/shared';
import { api } from '../../src/api/client';
import { useAuth } from '../../src/state/auth';
import { Empty, ErrorBanner, Loading, Screen } from '../../src/components/ui';
import { theme } from '../../src/theme';

export default function ComfortHistory() {
  const { t } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<ComfortResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setItems(await api.comfortHistory());
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
      setItems([]);
    }
  }, [t.error]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <Screen>
      <View style={styles.header}>
        <ErrorBanner message={error} />
      </View>

      {items === null ? (
        <Loading />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(c) => c.id}
          contentContainerStyle={items.length === 0 ? styles.flex : styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={theme.colors.accent}
              onRefresh={() => {
                setRefreshing(true);
                void load().finally(() => setRefreshing(false));
              }}
            />
          }
          ListEmptyComponent={<Empty title={t.noComfortHistory} hint={t.noComfortHistoryHint} />}
          renderItem={({ item }) => {
            const situation = SITUATIONS.find((s) => s.id === item.situation);
            return (
              <Pressable style={styles.row} onPress={() => router.push(`/comfort/${item.id}`)}>
                <View style={styles.rowMain}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {situation ? `${situation.emoji}  ${situation.label}` : `💬  ${t.reflection}`}
                  </Text>
                  <Text style={styles.rowMeta} numberOfLines={2}>
                    {item.acknowledgement}
                  </Text>
                  <Text style={styles.rowDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.textFaint} />
              </Pressable>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flexGrow: 1 },
  header: { paddingHorizontal: theme.space(4), paddingTop: theme.space(3) },
  list: { padding: theme.space(4), paddingTop: theme.space(1) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.space(4),
    marginBottom: theme.space(2),
  },
  rowMain: { flex: 1 },
  rowTitle: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: '500' },
  rowMeta: {
    color: theme.colors.textMuted,
    fontSize: theme.font.small,
    marginTop: theme.space(1),
    lineHeight: 19,
  },
  rowDate: { color: theme.colors.textFaint, fontSize: theme.font.tiny, marginTop: theme.space(1) },
});
