import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CrisisResource, SafetyNotice } from '@bible/shared';
import { ApiError, api } from '../api/client';
import { MicPermissionError, startRecording, type ActiveRecording } from '../audio/recorder';
import { speak, stopSpeaking } from '../audio/tts';
import { theme } from '../theme';

export function Screen({ children }: { children: ReactNode }) {
  return <View style={styles.screen}>{children}</View>;
}

export function Heading({ children }: { children: ReactNode }) {
  return <Text style={styles.heading}>{children}</Text>;
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function Button({
  label,
  onPress,
  loading,
  disabled,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'ghost' | 'danger';
}) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'ghost' && styles.buttonGhost,
        variant === 'danger' && styles.buttonDanger,
        (pressed || isDisabled) && styles.buttonDim,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? theme.colors.bg : theme.colors.text} />
      ) : (
        <Text
          style={[
            styles.buttonLabel,
            variant === 'primary' && styles.buttonLabelPrimary,
            variant === 'danger' && styles.buttonLabelDanger,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  ...props
}: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...props}
        style={[styles.input, props.multiline && styles.inputMultiline, props.style]}
        placeholderTextColor={theme.colors.textFaint}
      />
    </View>
  );
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.errorBanner}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

/**
 * Crisis resources. Pinned, non-dismissible for the turn that triggered it, and
 * rendered ABOVE the model's reply — the hotline must not be something the user
 * has to scroll past a paragraph of prose to reach.
 */
export function CrisisCard({ notice, title }: { notice: SafetyNotice; title: string }) {
  const critical = notice.level === 'crisis';
  return (
    <View style={[styles.crisis, critical && styles.crisisCritical]}>
      {critical && <Text style={styles.crisisTitle}>{title}</Text>}
      <Text style={styles.crisisMessage}>{notice.message}</Text>
      {notice.resources.map((r: CrisisResource) => (
        <View key={`${r.name}-${r.region}`} style={styles.resource}>
          <Text style={styles.resourceName}>{r.name}</Text>
          <Text style={styles.resourceContact}>{r.contact}</Text>
          <Text style={styles.resourceRegion}>
            {r.region}
            {r.note ? ` — ${r.note}` : ''}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function VerseCard({
  reference,
  text,
  translation,
  language,
  listenLabel,
  stopLabel,
}: {
  reference: string;
  text: string;
  translation?: string;
  /** When given, along with the two labels, renders a speak button for this verse. */
  language?: string;
  listenLabel?: string;
  stopLabel?: string;
}) {
  return (
    <View style={styles.verseCard}>
      <View style={styles.verseRow}>
        <Text style={[styles.verseText, styles.verseTextFlex]}>{text}</Text>
        {language && listenLabel && stopLabel ? (
          <SpeakButton
            text={`${reference}. ${text}`}
            language={language}
            listenLabel={listenLabel}
            stopLabel={stopLabel}
          />
        ) : null}
      </View>
      <Text style={styles.verseRef}>
        {reference}
        {translation ? `  ·  ${translation}` : ''}
      </Text>
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

/**
 * Reads `text` aloud on-device (expo-speech — free, no network, no API key).
 * Toggles between play and stop; stop only ever happens if the user taps
 * again, since `speak()` stops whatever else was playing before it starts.
 */
export function SpeakButton({
  text,
  language,
  listenLabel,
  stopLabel,
  autoPlay,
}: {
  text: string;
  language: string;
  listenLabel: string;
  stopLabel: string;
  /**
   * Starts speaking as soon as this instance mounts, so a fresh reply reads
   * itself aloud without the user tapping first. Callers only ever set this
   * on a newly-created message/result — never toggle it on an existing one —
   * so a mount-only effect is enough; it won't re-fire on later re-renders.
   */
  autoPlay?: boolean;
}) {
  const [speaking, setSpeaking] = useState(false);

  function toggle() {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    speak(text, language, { onDone: () => setSpeaking(false) });
  }

  useEffect(() => {
    if (!autoPlay) return;
    setSpeaking(true);
    speak(text, language, { onDone: () => setSpeaking(false) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={speaking ? stopLabel : listenLabel}
      onPress={toggle}
      hitSlop={8}
      style={styles.speakButton}
    >
      <Ionicons
        name={speaking ? 'stop-circle' : 'volume-medium-outline'}
        size={18}
        color={theme.colors.accent}
      />
    </Pressable>
  );
}

/**
 * Records a voice note and transcribes it via the API (Gemini, reusing the
 * app's existing free-tier key — no separate speech service to configure).
 * Tap to start, tap again to stop and transcribe; `onTranscribed` receives
 * the resulting text so the caller can drop it into a composer.
 */
export function MicButton({
  language,
  onTranscribed,
  onError,
  disabled,
  recordLabel,
  stopLabel,
}: {
  language: string;
  onTranscribed: (text: string) => void;
  onError: (message: string) => void;
  disabled?: boolean;
  recordLabel: string;
  stopLabel: string;
}) {
  const [state, setState] = useState<'idle' | 'recording' | 'transcribing'>('idle');
  const activeRef = useRef<ActiveRecording | null>(null);

  async function start() {
    // Barge-in: don't let the mic pick up the assistant's own voice, and let
    // the user interrupt a reply the same way they would a real conversation.
    stopSpeaking();
    try {
      activeRef.current = await startRecording();
      setState('recording');
    } catch (err) {
      onError(
        err instanceof MicPermissionError
          ? err.message
          : 'Could not start recording.',
      );
    }
  }

  async function stop() {
    const active = activeRef.current;
    activeRef.current = null;
    if (!active) return;
    setState('transcribing');
    try {
      const { base64, mimeType } = await active.stop();
      const { text } = await api.transcribe({ audio: base64, mimeType, language });
      onTranscribed(text);
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Could not transcribe that recording.');
    } finally {
      setState('idle');
    }
  }

  function toggle() {
    if (state === 'transcribing' || disabled) return;
    if (state === 'recording') void stop();
    else void start();
  }

  const isRecording = state === 'recording';
  const isBusy = state === 'transcribing';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isRecording ? stopLabel : recordLabel}
      accessibilityState={{ disabled: !!disabled || isBusy, busy: isBusy }}
      onPress={toggle}
      disabled={disabled || isBusy}
      style={[
        styles.micButton,
        isRecording && styles.micButtonActive,
        (disabled || isBusy) && styles.micButtonDim,
      ]}
    >
      {isBusy ? (
        <ActivityIndicator size="small" color={theme.colors.accent} />
      ) : (
        <Ionicons
          name={isRecording ? 'stop' : 'mic-outline'}
          size={20}
          color={isRecording ? theme.colors.danger : theme.colors.accent}
        />
      )}
    </Pressable>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {hint ? <Text style={styles.emptyHint}>{hint}</Text> : null}
    </View>
  );
}

export function Loading() {
  return (
    <View style={styles.empty}>
      <ActivityIndicator color={theme.colors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.bg },
  heading: {
    color: theme.colors.text,
    fontSize: theme.font.heading,
    fontWeight: '600',
    marginBottom: theme.space(2),
  },
  muted: { color: theme.colors.textMuted, fontSize: theme.font.small, lineHeight: 20 },

  button: {
    borderRadius: theme.radius.md,
    paddingVertical: theme.space(3.5),
    paddingHorizontal: theme.space(5),
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  buttonPrimary: { backgroundColor: theme.colors.accent },
  buttonGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.colors.border },
  buttonDanger: { backgroundColor: theme.colors.dangerBg },
  buttonDim: { opacity: 0.55 },
  buttonLabel: { color: theme.colors.text, fontSize: theme.font.body, fontWeight: '600' },
  buttonLabelPrimary: { color: '#1A1408' },
  buttonLabelDanger: { color: theme.colors.danger },

  field: { marginBottom: theme.space(4) },
  fieldLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.font.small,
    marginBottom: theme.space(1.5),
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space(4),
    paddingVertical: theme.space(3),
    color: theme.colors.text,
    fontSize: theme.font.body,
    minHeight: 48,
  },
  inputMultiline: { minHeight: 110, textAlignVertical: 'top' },

  errorBanner: {
    backgroundColor: theme.colors.dangerBg,
    borderRadius: theme.radius.sm,
    padding: theme.space(3),
    marginBottom: theme.space(3),
  },
  errorText: { color: theme.colors.danger, fontSize: theme.font.small, lineHeight: 19 },

  crisis: {
    backgroundColor: theme.colors.surfaceRaised,
    borderRadius: theme.radius.md,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.textMuted,
    padding: theme.space(4),
    marginVertical: theme.space(2),
  },
  crisisCritical: { borderLeftColor: theme.colors.danger, backgroundColor: theme.colors.dangerBg },
  crisisTitle: {
    color: theme.colors.danger,
    fontSize: theme.font.body,
    fontWeight: '700',
    marginBottom: theme.space(2),
  },
  crisisMessage: {
    color: theme.colors.text,
    fontSize: theme.font.small,
    lineHeight: 21,
    marginBottom: theme.space(3),
  },
  resource: { marginBottom: theme.space(3) },
  resourceName: { color: theme.colors.text, fontSize: theme.font.small, fontWeight: '600' },
  resourceContact: { color: theme.colors.accent, fontSize: theme.font.body, marginTop: 2 },
  resourceRegion: { color: theme.colors.textFaint, fontSize: theme.font.tiny, marginTop: 2 },

  verseCard: {
    backgroundColor: theme.colors.surfaceRaised,
    borderRadius: theme.radius.md,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.accent,
    padding: theme.space(4),
    marginBottom: theme.space(3),
  },
  verseRow: { flexDirection: 'row', alignItems: 'flex-start' },
  verseText: {
    color: theme.colors.verse,
    fontSize: theme.font.verse,
    lineHeight: 27,
    fontStyle: 'italic',
  },
  verseTextFlex: { flex: 1 },
  verseRef: {
    color: theme.colors.accent,
    fontSize: theme.font.small,
    marginTop: theme.space(2),
    fontWeight: '600',
  },

  chip: {
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: theme.space(2),
    paddingHorizontal: theme.space(3.5),
    marginRight: theme.space(2),
    marginBottom: theme.space(2),
    backgroundColor: theme.colors.surface,
  },
  chipSelected: { backgroundColor: theme.colors.accentSoft, borderColor: theme.colors.accent },
  chipLabel: { color: theme.colors.textMuted, fontSize: theme.font.small },
  chipLabelSelected: { color: theme.colors.accent, fontWeight: '600' },

  speakButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },

  micButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButtonActive: { backgroundColor: theme.colors.dangerBg, borderColor: theme.colors.danger },
  micButtonDim: { opacity: 0.5 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.space(8) },
  emptyTitle: { color: theme.colors.textMuted, fontSize: theme.font.body, textAlign: 'center' },
  emptyHint: {
    color: theme.colors.textFaint,
    fontSize: theme.font.small,
    textAlign: 'center',
    marginTop: theme.space(2),
    lineHeight: 20,
  },
});
