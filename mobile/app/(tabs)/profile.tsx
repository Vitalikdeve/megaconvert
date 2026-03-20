import { Redirect, type Href } from 'expo-router';

export default function ProfileTabScreen() {
  return <Redirect href={'/settings' as Href} />;
}
