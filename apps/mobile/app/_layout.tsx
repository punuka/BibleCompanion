import { Component, useEffect, type ReactNode } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator, StyleSheet, Text, ScrollView } from 'react-native';
import { AuthProvider, useAuth } from '../src/state/auth';
import { theme } from '../src/theme';
import { API_URL } from '../src/api/client';

/**
 * Catches render-time errors that would otherwise leave a blank white screen
 * with nothing in Metro/adb to explain why. Reports to the same endpoint the
 * pre-render crash handler in index.js uses, and renders the error directly
 * so it's visible without any tooling at all.
 */
class RootErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    fetch(`${API_URL}/v1/debug/client-error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: 'render',
        message: error.message,
        stack: error.stack,
        isFatal: true,
      }),
    }).catch(() => {});
  }

  render() {
    if (this.state.error) {
      return (
        <ScrollView contentContainerStyle={styles.errorContainer}>
          <Text style={styles.errorTitle}>Something crashed</Text>
          <Text style={styles.errorText}>{this.state.error.message}</Text>
          <Text style={styles.errorText}>{this.state.error.stack}</Text>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

function RootNavigator() {
  const { user, loading, t } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!user && !inAuthGroup) router.replace('/(auth)/sign-in');
    else if (user && inAuthGroup) router.replace('/(tabs)/chat');
  }, [user, loading, segments, router]);

  if (loading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={theme.colors.accent} size="large" />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.bg },
        headerTintColor: theme.colors.text,
        headerTitleStyle: { fontWeight: '600' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.colors.bg },
      }}
    >
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="chat/[id]" options={{ title: '' }} />
      <Stack.Screen name="counselors/[id]" options={{ title: '' }} />
      <Stack.Screen name="connections/[id]" options={{ title: '' }} />
      <Stack.Screen name="apply" options={{ title: '' }} />
      <Stack.Screen name="admin" options={{ title: 'Admin dashboard' }} />
      <Stack.Screen name="comfort/history" options={{ title: t.comfortHistory }} />
      <Stack.Screen name="comfort/[id]" options={{ title: '' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <RootErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="light" />
          <RootNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    </RootErrorBoundary>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flexGrow: 1,
    backgroundColor: '#1A1408',
    padding: theme.space(6),
    paddingTop: theme.space(16),
  },
  errorTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: theme.space(4),
  },
  errorText: {
    color: '#f88',
    fontSize: 13,
    marginBottom: theme.space(3),
  },
});
