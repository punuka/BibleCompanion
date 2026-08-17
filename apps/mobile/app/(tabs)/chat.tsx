import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Conversation } from '@bible/shared';
import { api } from '../../src/api/client';
import { useAuth } from '../../src/state/auth';
import { Empty, ErrorBanner, Loading, Screen } from '../../src/components/ui';
import { theme } from '../../src/theme';

export default function ConversationList() {
  const { t } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Conversation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setItems(await api.conversations());
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
      setItems([]);
    }
  }, [t.error]);

  // Reload on focus so a thread started elsewhere, or a title that finished
  // generating after the reply, shows up without a manual pull.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function startNew() {
    try {
      const conversation = await api.createConversation();
      router.push(`/chat/${conversation.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <ErrorBanner message={error} />
        <Pressable style={styles.newButton} onPress={() => void startNew()}>
          <Ionicons name="add" size={20} color={theme.colors.accent} />
          <Text style={styles.newButtonText}>{t.newConversation}</Text>
        </Pressable>
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
          ListEmptyComponent={<Empty title={t.noConversations} hint={t.noConversationsHint} />}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => router.push(`/chat/${item.id}`)}>
              <View style={styles.rowMain}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.rowMeta}>
                  {new Date(item.updatedAt).toLocaleDateString()}
                  {item.messageCount ? ` · ${item.messageCount}` : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textFaint} />
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flexGrow: 1 },
  header: { paddingHorizontal: theme.space(4), paddingTop: theme.space(3) },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space(2),
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingVertical: theme.space(3.5),
    marginBottom: theme.space(2),
  },
  newButtonText: { color: theme.colors.accent, fontSize: theme.font.body, fontWeight: '600' },
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
  rowMeta: { color: theme.colors.textFaint, fontSize: theme.font.tiny, marginTop: theme.space(1) },
});
