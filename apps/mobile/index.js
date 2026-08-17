// Custom entry point, replacing expo-router/entry directly (rather than
// wrapping it) so a startup crash is actually visible.
//
// expo-router's own entry (renderRootComponent, in
// expo-router/build/renderRootComponent.js) catches exactly this class of
// error itself and, on native, silently registers an empty <View/> as the
// root component — a blank white screen with nothing logged anywhere. This
// file re-implements the same registration but renders the real error
// instead of swallowing it.
import '@expo/metro-runtime';
import * as React from 'react';
import { ScrollView, Text, StyleSheet } from 'react-native';
import { registerRootComponent, requireOptionalNativeModule } from 'expo';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8787';

function reportCrash(label, error) {
  try {
    const message = error && error.message ? error.message : String(error);
    const stack = error && error.stack ? String(error.stack) : undefined;
    fetch(`${API_URL}/v1/debug/client-error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, message, stack, isFatal: true }),
    }).catch(() => {});
  } catch {
    // Reporting must never itself throw — that would replace one crash with another.
  }
}

function hideSplash() {
  try {
    requireOptionalNativeModule('ExpoSplashScreen')?.hide();
  } catch {
    // Best-effort — a stuck splash screen is a lesser problem than a crash.
  }
}

const globalErrorUtils = global.ErrorUtils;
if (globalErrorUtils && typeof globalErrorUtils.setGlobalHandler === 'function') {
  const previousHandler = globalErrorUtils.getGlobalHandler
    ? globalErrorUtils.getGlobalHandler()
    : null;
  globalErrorUtils.setGlobalHandler((error, isFatal) => {
    hideSplash();
    reportCrash(isFatal ? 'fatal' : 'error', error);
    if (previousHandler) previousHandler(error, isFatal);
  });
}

function CrashScreen({ label, error }) {
  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Startup crashed ({label})</Text>
      <Text style={styles.body}>{error && error.message ? error.message : String(error)}</Text>
      <Text style={styles.body}>{error && error.stack ? error.stack : ''}</Text>
    </ScrollView>
  );
}

class RenderErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    hideSplash();
    reportCrash('render', error);
  }

  render() {
    if (this.state.error) return <CrashScreen label="render" error={this.state.error} />;
    return this.props.children;
  }
}

let App;
try {
  ({ App } = require('expo-router/build/qualified-entry'));
} catch (error) {
  hideSplash();
  reportCrash('entry-import', error);
  App = () => <CrashScreen label="entry-import" error={error} />;
}

function Root() {
  return (
    <RenderErrorBoundary>
      <App />
    </RenderErrorBoundary>
  );
}

registerRootComponent(Root);
hideSplash();

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#1A1408' },
  container: { padding: 24, paddingTop: 80 },
  title: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 16 },
  body: { color: '#f88', fontSize: 13, marginBottom: 12 },
});
