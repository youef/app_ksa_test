import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { DynamicIslandProvider } from '@/context/DynamicIslandContext';
import { syncDndWithNotifications } from '@/lib/notifications';

export default function RootLayout() {
  // Keep the notification handler in sync with the user's DND schedule
  // so a sound never plays during a quiet window.
  useEffect(() => {
    void syncDndWithNotifications();
    const timer = setInterval(() => void syncDndWithNotifications(), 60_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <DynamicIslandProvider>
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
    </DynamicIslandProvider>
  );
}
