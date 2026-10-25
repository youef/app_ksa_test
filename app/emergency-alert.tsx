import React from 'react';
import { Redirect } from 'expo-router';

// Legacy route kept only to send old bookmarks and links to the unified posting flow.
export default function EmergencyAlertRedirect() {
  return <Redirect href="/ask" />;
}
