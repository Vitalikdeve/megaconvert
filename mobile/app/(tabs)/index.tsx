import { Redirect } from 'expo-router';

export default function DeprecatedTabOne() {
  return <Redirect href="/(tabs)/contacts" />;
}
