import { Redirect } from 'expo-router';

export default function AccountTypeRedirect() {
  return <Redirect href="/profile?tab=profile&section=identity" />;
}
