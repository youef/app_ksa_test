import { Redirect } from 'expo-router';

// Keep old bookmarks working while support is managed inside the main admin command center.
export default function AdminSupportRedirect() {
  return <Redirect href="/admin" />;
}
