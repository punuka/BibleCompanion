import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Connection, ConnectionMessage } from '@bible/shared';
import { api } from '../../src/api/client';
import { useAuth } from '../../src/state/auth';
import { Button, Empty, ErrorBanner, Loading } from '../../src/components/ui';
import { theme } from '../../src/theme';

/**
 * Human-to-human messaging. No model, no scripture tools, no streaming — the
 * point of this surface is that it is not the AI.
 */
export default function ConnectionThread() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, user } = useAuth();
  const navigation = useNavigation();

  const [connection, setConnection] = useState<Connection | null>(null);
  const [messages, setMessages] = useState<ConnectionMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const listRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const conn = await api.connection(id);
      setConnection(conn);
      navigation.setOptions({ title: conn.counselor.displayName });
      if (conn.status === 'ACCEPTED') setMessages(await api.connectionMessages(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
    }
  }, [id, navigation, t.error]);

  useEffect(() => {
    void load();
  }, [load]);

  // The counsellor sees accept/decline; the seeker just waits.
  const viewerIsCounselor = connection?.counselor.displayName === user?.displayName;

  async function decide(status: 'ACCEPTED' | 'DECLINED') {
    setBusy(true);
    try {
      setConnection(await api.decideConnection(id, status));
      if (status === 'ACCEPTED') setMessages(await api.connectionMessages(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    try {
      const message = await api.sendConnectionMessage(id, body);
      setMessages((prev) => [...prev, message]);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
      setDraft(body);
    }
  }

  if (!connection) return error ? <ErrorOnly message={error} /> : <Loading />;

  if (connection.status !== 'ACCEPTED') {
    return (
      <View style={styles.pending}>
        <Text style={styles.pendingTopic}>{connection.topic}</Text>
        <Text style={styles.pendingStatus}>
          {connection.status === 'REQUESTED' ? t.pending : t.declined}
        </Text>
        <ErrorBanner message={error} />
        {viewerIsCounselor && connection.status === 'REQUESTED' ? (
          <View style={styles.decisionRow}>
            <View style={styles.decisionButton}>
              <Button label={t.accept} onPress={() => void decide('ACCEPTED')} loading={busy} />
            </View>
            <View style={styles.decisionButton}>
              <Button
                label={t.decline}
                variant="danger"
                onPress={() => void decide('DECLINED')}
                loading={busy}
              />
            </View>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 96 : 0}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={messages.length === 0 ? styles.flexGrow : styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListHeaderComponent={<Text style={styles.topic}>{connection.topic}</Text>}
        ListEmptyComponent={<Empty title={t.writeMessage} />}
        renderItem={({ item }) => {
          const mine = item.senderId === user?.id;
          return (
            <View style={[styles.bubbleWrap, mine ? styles.right : styles.left]}>
              {!mine ? <Text style={styles.sender}>{item.senderName}</Text> : null}
              <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                <Text style={styles.bubbleText}>{item.body}</Text>
              </View>
            </View>
          );
        }}
      />

      <View style={styles.composer}>
        <ErrorBanner message={error} />
        <View style={styles.composerRow}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder={t.writeMessage}
            placeholderTextColor={theme.colors.textFaint}
            multiline
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.send}
            onPress={() => void send()}
            disabled={!draft.trim()}
            style={[styles.sendButton, !draft.trim() && styles.sendDisabled]}
          >
            <Ionicons name="arrow-up" size={20} color="#1A1408" />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function ErrorOnly({ message }: { message: string }) {
  return (
    <View style={styles.pending}>
      <ErrorBanner message={message} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.bg },
  flexGrow: { flexGrow: 1 },
  pending: { flex: 1, backgroundColor: theme.colors.bg, padding: theme.space(6) },
  pendingTopic: { color: theme.colors.text, fontSize: theme.font.heading, lineHeight: 27 },
  pendingStatus: {
    color: theme.colors.textMuted,
    fontSize: theme.font.small,
    marginTop: theme.space(3),
    marginBottom: theme.space(6),
  },
  decisionRow: { flexDirection: 'row', gap: theme.space(3) },
  decisionButton: { flex: 1 },

  list: { padding: theme.space(4) },
  topic: {
    color: theme.colors.textFaint,
    fontSize: theme.font.small,
    fontStyle: 'italic',
    marginBottom: theme.space(5),
    lineHeight: 20,
  },
  bubbleWrap: { marginBottom: theme.space(3), maxWidth: '86%' },
  left: { alignSelf: 'flex-start' },
  right: { alignSelf: 'flex-end' },
  sender: {
    color: theme.colors.textFaint,
    fontSize: theme.font.tiny,
    marginBottom: theme.space(1),
    marginLeft: theme.space(2),
  },
  bubble: {
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.space(4),
    paddingVertical: theme.space(3),
  },
  bubbleMine: { backgroundColor: theme.colors.userBubble, borderBottomRightRadius: theme.radius.sm },
  bubbleTheirs: { backgroundColor: theme.colors.surface, borderBottomLeftRadius: theme.radius.sm },
  bubbleText: { color: theme.colors.text, fontSize: theme.font.body, lineHeight: 23 },

  composer: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    padding: theme.space(3),
  },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: theme.space(2) },
  input: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.space(4),
    paddingVertical: theme.space(3),
    color: theme.colors.text,
    fontSize: theme.font.body,
    maxHeight: 120,
    minHeight: 46,
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.35 },
});
