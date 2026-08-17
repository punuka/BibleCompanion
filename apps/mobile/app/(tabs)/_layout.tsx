import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/state/auth';
import { theme } from '../../src/theme';

export default function TabsLayout() {
  const { t } = useAuth();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.bg },
        headerTintColor: theme.colors.text,
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '600' },
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
        },
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textFaint,
        sceneStyle: { backgroundColor: theme.colors.bg },
      }}
    >
      <Tabs.Screen
        name="chat"
        options={{
          title: t.chat,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="comfort"
        options={{
          title: t.comfort,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="heart-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="counselors"
        options={{
          title: t.counselors,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t.profile,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
