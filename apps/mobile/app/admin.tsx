import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { getLanguage, type AdminStats, type CounselorApplication, type CounselorStatus } from '@bible/shared';
import { api } from '../src/api/client';
import { useAuth } from '../src/state/auth';
import { Button, Chip, ErrorBanner, Field, Loading } from '../src/components/ui';
import { theme } from '../src/theme';

const STATUS_FILTERS: CounselorStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'];

export default function AdminDashboard() {
  const { user, t } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [status, setStatus] = useState<CounselorStatus>('PENDING');
  const [applications, setApplications] = useState<CounselorApplication[] | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (forStatus: CounselorStatus) => {
    setError(null);
    setApplications(null);
    try {
      const [statsResult, applicationsResult] = await Promise.all([
        api.adminStats(),
        api.adminCounselors(forStatus),
      ]);
      setStats(statsResult);
      setApplications(applicationsResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
      setApplications([]);
    }
  }, [t.error]);

  useFocusEffect(
    useCallback(() => {
      void load(status);
      // Re-running on every focus (not just status change) keeps the queue
      // current if a decision was made elsewhere, or another admin acted.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status]),
  );

  async function decide(application: CounselorApplication, next: Exclude<CounselorStatus, 'PENDING'>) {
    setError(null);
    setBusyId(application.id);
    try {
      await api.adminDecideCounselor(application.id, next, notes[application.id]?.trim() || undefined);
      setApplications((prev) => prev?.filter((a) => a.id !== application.id) ?? null);
      setStats(await api.adminStats());
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
    } finally {
      setBusyId(null);
    }
  }

  if (user && user.role !== 'ADMIN') {
    return (
      <View style={styles.flex}>
        <ErrorBanner message="This page is only available to admins." />
      </View>
    );
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      {stats ? (
        <View style={styles.statsRow}>
          <Stat label="Users" value={stats.users} />
          <Stat label="Counsellors" value={stats.approvedCounselors} />
          <Stat label="Pending" value={stats.pendingApplications} />
          <Stat label="Conversations" value={stats.conversations} />
          <Stat label="Comfort" value={stats.comfortSessions} />
          <Stat label="Connections" value={stats.activeConnections} />
        </View>
      ) : null}

      <ErrorBanner message={error} />

      <View style={styles.chips}>
        {STATUS_FILTERS.map((s) => (
          <Chip key={s} label={s} selected={status === s} onPress={() => setStatus(s)} />
        ))}
      </View>

      {applications === null ? (
        <Loading />
      ) : applications.length === 0 ? (
        <Text style={styles.empty}>No {status.toLowerCase()} applications.</Text>
      ) : (
        applications.map((application) => (
          <ApplicationCard
            key={application.id}
            application={application}
            note={notes[application.id] ?? ''}
            onNoteChange={(note) => setNotes((prev) => ({ ...prev, [application.id]: note }))}
            busy={busyId === application.id}
            onDecide={(next) => void decide(application, next)}
          />
        ))
      )}
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ApplicationCard({
  application,
  note,
  onNoteChange,
  busy,
  onDecide,
}: {
  application: CounselorApplication;
  note: string;
  onNoteChange: (note: string) => void;
  busy: boolean;
  onDecide: (next: Exclude<CounselorStatus, 'PENDING'>) => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.headline}>{application.headline}</Text>
      <Text style={styles.applicant}>
        {application.displayName} · submitted {new Date(application.createdAt).toLocaleDateString()}
      </Text>

      <Row label="Organization" value={application.organization ?? '—'} />
      <Row label="Experience" value={`${application.yearsExperience} years`} />
      <Row label="Contact email" value={application.contactEmail} />
      <Row
        label="Languages"
        value={application.languages.map((code) => getLanguage(code).endonym).join(', ') || '—'}
      />
      <Row label="Focus" value={application.specialties.map((s) => s.replace(/-/g, ' ')).join(', ') || '—'} />

      <Text style={styles.sectionLabel}>About their work</Text>
      <Text style={styles.body}>{application.bio}</Text>

      <Text style={styles.sectionLabel}>Credentials (private)</Text>
      <Text style={styles.body}>{application.credentials}</Text>

      {application.reviewNote ? (
        <>
          <Text style={styles.sectionLabel}>Previous review note</Text>
          <Text style={styles.body}>{application.reviewNote}</Text>
        </>
      ) : null}

      <Field
        label="Review note (optional, shown to no one but stored for the record)"
        value={note}
        onChangeText={onNoteChange}
        multiline
        placeholder="…"
      />

      <View style={styles.actions}>
        {application.status === 'PENDING' ? (
          <>
            <View style={styles.actionFlex}>
              <Button label="Approve" onPress={() => onDecide('APPROVED')} loading={busy} />
            </View>
            <View style={styles.actionFlex}>
              <Button label="Reject" variant="danger" onPress={() => onDecide('REJECTED')} loading={busy} />
            </View>
          </>
        ) : application.status === 'APPROVED' ? (
          <View style={styles.actionFlex}>
            <Button label="Suspend" variant="danger" onPress={() => onDecide('SUSPENDED')} loading={busy} />
          </View>
        ) : (
          <View style={styles.actionFlex}>
            <Button label="Approve" onPress={() => onDecide('APPROVED')} loading={busy} />
          </View>
        )}
      </View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.bg },
  container: { padding: theme.space(4), paddingBottom: theme.space(12) },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space(2),
    marginBottom: theme.space(4),
  },
  stat: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    paddingVertical: theme.space(3),
    paddingHorizontal: theme.space(4),
    minWidth: 92,
  },
  statValue: { color: theme.colors.accent, fontSize: theme.font.heading, fontWeight: '700' },
  statLabel: { color: theme.colors.textFaint, fontSize: theme.font.tiny, marginTop: theme.space(1) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: theme.space(4) },
  empty: { color: theme.colors.textMuted, fontSize: theme.font.body, marginTop: theme.space(6) },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.space(4),
    marginBottom: theme.space(4),
  },
  headline: { color: theme.colors.text, fontSize: theme.font.heading, lineHeight: 25 },
  applicant: {
    color: theme.colors.textFaint,
    fontSize: theme.font.tiny,
    marginTop: theme.space(1),
    marginBottom: theme.space(3),
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: theme.space(1) },
  rowLabel: { color: theme.colors.textMuted, fontSize: theme.font.small },
  rowValue: { color: theme.colors.text, fontSize: theme.font.small, flexShrink: 1, textAlign: 'right' },
  sectionLabel: {
    color: theme.colors.accent,
    fontSize: theme.font.tiny,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: theme.space(4),
    marginBottom: theme.space(2),
  },
  body: { color: theme.colors.text, fontSize: theme.font.small, lineHeight: 21 },
  actions: { flexDirection: 'row', gap: theme.space(3), marginTop: theme.space(3) },
  actionFlex: { flex: 1 },
});
