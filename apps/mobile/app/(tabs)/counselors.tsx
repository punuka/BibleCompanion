import { useCallback, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LANGUAGES, type Connection, type CounselorProfile } from '@bible/shared';
import { api } from '../../src/api/client';
import { useAuth } from '../../src/state/auth';
import { Chip, Empty, ErrorBanner, Loading, Screen } from '../../src/components/ui';
import { theme } from '../../src/theme';

type Tab = 'directory' | 'mine';

export default function Counselors() {
  const { t, language } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('directory');
  const [languageFilter, setLanguageFilter] = useState<string | null>(language);
  const [counselors, setCounselors] = useState<CounselorProfile[] | null>(null);
  const [connections, setConnections] = useState<
    (Connection & { role: 'seeker' | 'counselor' })[] | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [dir, conns] = await Promise.all([
        api.counselors(languageFilter ? { language: languageFilter } : {}),
        api.connections(),
      ]);
      setCounselors(dir);
      setConnections(conns);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
      setCounselors([]);
      setConnections([]);
    }
  }, [languageFilter, t.error]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <Screen>
      <View style={styles.tabs}>
        <Pressable
          onPress={() => setTab('directory')}
          style={[styles.tab, tab === 'directory' && styles.tabActive]}
        >
          <Text style={[styles.tabText, tab === 'directory' && styles.tabTextActive]}>
            {t.counselors}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTab('mine')}
          style={[styles.tab, tab === 'mine' && styles.tabActive]}
        >
          <Text style={[styles.tabText, tab === 'mine' && styles.tabTextActive]}>
            {t.myConnections}
            {connections && connections.length > 0 ? ` (${connections.length})` : ''}
          </Text>
        </Pressable>
      </View>

      <View style={styles.errorWrap}>
        <ErrorBanner message={error} />
      </View>

      {tab === 'directory' ? (
        counselors === null ? (
          <Loading />
        ) : (
          <FlatList
            data={counselors}
            keyExtractor={(c) => c.id}
            contentContainerStyle={counselors.length === 0 ? styles.flex : styles.list}
            ListHeaderComponent={
              <View>
                <Text style={styles.intro}>{t.counselorsIntro}</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.filterRow}
                >
                  <Chip
                    label="All"
                    selected={languageFilter === null}
                    onPress={() => setLanguageFilter(null)}
                  />
                  {LANGUAGES.map((l) => (
                    <Chip
                      key={l.code}
                      label={l.endonym}
                      selected={languageFilter === l.code}
                      onPress={() => setLanguageFilter(l.code)}
                    />
                  ))}
                </ScrollView>
              </View>
            }
            ListEmptyComponent={<Empty title={t.noCounselors} />}
            renderItem={({ item }) => (
              <Pressable style={styles.card} onPress={() => router.push(`/counselors/${item.id}`)}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardName}>{item.displayName}</Text>
                  <Text style={styles.cardYears}>
                    {item.yearsExperience} {t.yearsExperience}
                  </Text>
                </View>
                <Text style={styles.cardHeadline} numberOfLines={2}>
                  {item.headline}
                </Text>
                <Text style={styles.cardLanguages}>
                  {t.speaks}: {item.languages.join(' · ')}
                </Text>
              </Pressable>
            )}
          />
        )
      ) : connections === null ? (
        <Loading />
      ) : (
        <FlatList
          data={connections}
          keyExtractor={(c) => c.id}
          contentContainerStyle={connections.length === 0 ? styles.flex : styles.list}
          ListEmptyComponent={<Empty title={t.noConversations} hint={t.counselorsIntro} />}
          renderItem={({ item }) => {
            const other = item.role === 'seeker' ? item.counselor.displayName : item.user.displayName;
            const statusLabel =
              item.status === 'REQUESTED'
                ? t.pending
                : item.status === 'ACCEPTED'
                  ? t.accepted
                  : t.declined;
            return (
              <Pressable
                style={styles.card}
                onPress={() => router.push(`/connections/${item.id}`)}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardName}>{other}</Text>
                  <View
                    style={[
                      styles.badge,
                      item.status === 'ACCEPTED' && styles.badgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        item.status === 'ACCEPTED' && styles.badgeTextActive,
                      ]}
                    >
                      {statusLabel}
                    </Text>
                  </View>
                </View>
                <Text style={styles.cardHeadline} numberOfLines={2}>
                  {item.topic}
                </Text>
                <View style={styles.cardFooter}>
                  <Text style={styles.cardLanguages}>
                    {item.role === 'counselor' ? '↩︎ ' : ''}
                    {new Date(item.updatedAt).toLocaleDateString()}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={theme.colors.textFaint} />
                </View>
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
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: theme.space(4),
    paddingTop: theme.space(2),
    gap: theme.space(2),
  },
  tab: {
    flex: 1,
    paddingVertical: theme.space(2.5),
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: theme.colors.accent },
  tabText: { color: theme.colors.textFaint, fontSize: theme.font.small, fontWeight: '600' },
  tabTextActive: { color: theme.colors.accent },
  errorWrap: { paddingHorizontal: theme.space(4) },
  intro: {
    color: theme.colors.textMuted,
    fontSize: theme.font.small,
    marginBottom: theme.space(3),
    lineHeight: 20,
  },
  filterRow: { paddingBottom: theme.space(2) },
  list: { padding: theme.space(4) },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.space(4),
    marginBottom: theme.space(3),
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.space(1.5),
  },
  cardName: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: '600', flex: 1 },
  cardYears: { color: theme.colors.textFaint, fontSize: theme.font.tiny },
  cardHeadline: {
    color: theme.colors.textMuted,
    fontSize: theme.font.small,
    lineHeight: 20,
    marginBottom: theme.space(2),
  },
  cardLanguages: { color: theme.colors.textFaint, fontSize: theme.font.tiny },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: {
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.space(2.5),
    paddingVertical: theme.space(1),
    backgroundColor: theme.colors.surfaceRaised,
  },
  badgeActive: { backgroundColor: theme.colors.accentSoft },
  badgeText: { color: theme.colors.textFaint, fontSize: theme.font.tiny },
  badgeTextActive: { color: theme.colors.accent, fontWeight: '600' },
});
