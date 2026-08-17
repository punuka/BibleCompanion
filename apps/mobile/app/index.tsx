import { Redirect } from 'expo-router';

// The root layout's navigator decides where to go once auth has resolved.
export default function Index() {
  return <Redirect href="/(tabs)/chat" />;
}
