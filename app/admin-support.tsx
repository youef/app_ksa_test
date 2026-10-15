import { Redirect } from 'expo-router';

// Keep old bookmarks working while support now lives in a single unified page.
export default function AdminSupportRedirect() {
  return <Redirect href="/support" />;
}
