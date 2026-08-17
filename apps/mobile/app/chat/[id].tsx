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
import type { Citation, ChatMessage, SafetyNotice } from '@bible/shared';
import { api, streamChatMessage } from '../../src/api/client';
import { useAuth } from '../../src/state/auth';
import { CrisisCard, ErrorBanner, Loading, MicButton, SpeakButton, VerseCard } from '../../src/components/ui';
import { stopSpeaking } from '../../src/audio/tts';
import { theme } from '../../src/theme';

/** The in-flight assistant turn, before it is persisted and folded into `messages`. */
interface Streaming {
  text: string;
  citations: Citation[];
}

export default function ChatThread() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, language: defaultLanguage } = useAuth();
  const navigation = useNavigation();

  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  // The conversation owns its own language at creation time, which can differ
  // from the user's current setting — load() overwrites this once it resolves.
  const [language, setLanguage] = useState(defaultLanguage);
  const [draft, setDraft] = useState('');
  const [streaming, setStreaming] = useState<Streaming | null>(null);
  const [safety, setSafety] = useState<SafetyNotice | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The id of the reply that just finished streaming — read aloud automatically
  // so the exchange plays as a dialogue, not just text the user has to find and tap.
  const [autoPlayId, setAutoPlayId] = useState<string | null>(null);

  const listRef = useRef<FlatList>(null);
  const abortRef = useRef<(() => void) | null>(null);

  const load = useCallback(async () => {
    try {
      const conversation = await api.conversation(id);
      setMessages(conversation.messages);
      setLanguage(conversation.language);
      navigation.setOptions({ title: conversation.title });
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
      setMessages([]);
    }
  }, [id, navigation, t.error]);

  useEffect(() => {
    void load();
    // Abort any in-flight stream, and don't keep reading a reply aloud, once
    // the screen goes away.
    return () => {
      abortRef.current?.();
      stopSpeaking();
    };
  }, [load]);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, []);

  function send() {
    const content = draft.trim();
    if (!content || streaming) return;

    // A new turn starts — don't let the previous reply keep talking over it.
    stopSpeaking();
    setError(null);
    setDraft('');
    // The crisis notice is per-turn: clear the previous one as a new turn starts.
    setSafety(null);

    const optimistic: ChatMessage = {
      id: `local-${Date.now()}`,
      role: 'user',
      content,
      citations: [],
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...(prev ?? []), optimistic]);
    setStreaming({ text: '', citations: [] });
    scrollToEnd();

    abortRef.current = streamChatMessage(id, content, {
      onSafety: (notice) => {
        setSafety(notice);
        scrollToEnd();
      },
      onDelta: (text) => {
        setStreaming((prev) => (prev ? { ...prev, text: prev.text + text } : prev));
        scrollToEnd();
      },
      onCitation: (citation) => {
        setStreaming((prev) =>
          prev && !prev.citations.some((c) => c.ref === citation.ref)
            ? { ...prev, citations: [...prev.citations, citation] }
            : prev,
        );
      },
      onDone: ({ messageId, citations }) => {
        setStreaming((prev) => {
          if (prev) {
            setMessages((msgs) => [
              ...(msgs ?? []),
              {
                id: messageId,
                role: 'assistant',
                content: prev.text,
                citations,
                createdAt: new Date().toISOString(),
              },
            ]);
            setAutoPlayId(messageId);
          }
          return null;
        });
        abortRef.current = null;
        scrollToEnd();
      },
      onError: (message) => {
        setError(message);
        setStreaming(null);
        abortRef.current = null;
      },
    });
  }

  if (messages === null) return <Loading />;

  const data: (ChatMessage | { id: '__streaming__' })[] = streaming
    ? [...messages, { id: '__streaming__' as const }]
    : messages;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 96 : 0}
    >
      {/* Pinned above the thread — a hotline must never be something you
          scroll past a paragraph of prose to reach. */}
      {safety ? (
        <View style={styles.safetyWrap}>
          <CrisisCard notice={safety} title={t.crisisTitle} />
        </View>
      ) : null}

      <FlatList
        ref={listRef}
        data={data}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        onContentSizeChange={scrollToEnd}
        renderItem={({ item }) => {
          if (item.id === '__streaming__') {
            return (
              <Bubble
                role="assistant"
                content={streaming?.text ?? ''}
                citations={streaming?.citations ?? []}
                pending={!streaming?.text}
                pendingLabel={t.thinking}
                language={language}
                listenLabel={t.listen}
                stopLabel={t.stopSpeaking}
              />
            );
          }
          const message = item as ChatMessage;
          return (
            <Bubble
              role={message.role}
              content={message.content}
              citations={message.citations}
              language={language}
              listenLabel={t.listen}
              stopLabel={t.stopSpeaking}
              autoPlay={message.id === autoPlayId}
            />
          );
        }}
      />

      <View style={styles.composer}>
        <ErrorBanner message={error} />
        <View style={styles.composerRow}>
          <MicButton
            language={language}
            disabled={!!streaming}
            recordLabel={t.recordVoice}
            stopLabel={t.stopRecording}
            onTranscribed={(text) =>
              setDraft((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text))
            }
            onError={setError}
          />
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder={t.askAnything}
            placeholderTextColor={theme.colors.textFaint}
            multiline
            editable={!streaming}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.send}
            onPress={send}
            disabled={!draft.trim() || !!streaming}
            style={[styles.sendButton, (!draft.trim() || !!streaming) && styles.sendDisabled]}
          >
            <Ionicons name="arrow-up" size={20} color="#1A1408" />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function Bubble({
  role,
  content,
  citations,
  pending,
  pendingLabel,
  language,
  listenLabel,
  stopLabel,
  autoPlay,
}: {
  role: 'user' | 'assistant';
  content: string;
  citations: Citation[];
  pending?: boolean;
  pendingLabel?: string;
  language: string;
  listenLabel: string;
  stopLabel: string;
  autoPlay?: boolean;
}) {
  const isUser = role === 'user';
  return (
    <View style={[styles.bubbleWrap, isUser ? styles.bubbleRight : styles.bubbleLeft]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        {pending ? (
          <Text style={styles.pending}>{pendingLabel}</Text>
        ) : (
          <View style={styles.bubbleRow}>
            <Text style={[styles.bubbleText, styles.bubbleTextFlex]}>{content}</Text>
            {!isUser ? (
              <SpeakButton
                text={content}
                language={language}
                listenLabel={listenLabel}
                stopLabel={stopLabel}
                autoPlay={autoPlay}
              />
            ) : null}
          </View>
        )}
      </View>

      {/* Verse chips render independently of the prose — the citation event can
          arrive before or after the text that references it. */}
      {!isUser && citations.length > 0 ? (
        <View style={styles.citations}>
          {citations.map((c) => (
            <VerseCard
              key={c.ref}
              reference={c.ref}
              text={c.text}
              translation={c.translation}
              language={language}
              listenLabel={listenLabel}
              stopLabel={stopLabel}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.bg },
  safetyWrap: { paddingHorizontal: theme.space(4), paddingTop: theme.space(2) },
  list: { padding: theme.space(4), paddingBottom: theme.space(6) },

  bubbleWrap: { marginBottom: theme.space(4), maxWidth: '92%' },
  bubbleLeft: { alignSelf: 'flex-start' },
  bubbleRight: { alignSelf: 'flex-end' },
  bubble: { borderRadius: theme.radius.lg, paddingHorizontal: theme.space(4), paddingVertical: theme.space(3) },
  bubbleUser: { backgroundColor: theme.colors.userBubble, borderBottomRightRadius: theme.radius.sm },
  bubbleAssistant: {
    backgroundColor: theme.colors.assistantBubble,
    borderBottomLeftRadius: theme.radius.sm,
  },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-start' },
  bubbleText: { color: theme.colors.text, fontSize: theme.font.body, lineHeight: 24 },
  bubbleTextFlex: { flex: 1 },
  pending: { color: theme.colors.textFaint, fontSize: theme.font.body, fontStyle: 'italic' },
  citations: { marginTop: theme.space(3) },

  composer: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    padding: theme.space(3),
    backgroundColor: theme.colors.bg,
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
