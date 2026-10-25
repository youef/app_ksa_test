import { Redirect } from 'expo-router';

export default function ProfileCustomizationRedirect() {
  return <Redirect href="/profile?tab=settings&section=design" />;
}
