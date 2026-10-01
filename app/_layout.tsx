import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { DynamicIslandProvider } from '@/context/DynamicIslandContext';
import { registerPushToken, syncDndWithNotifications } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';

export default function RootLayout() {
  useEffect(() => {
    void syncDndWithNotifications();

    const registerForUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) void registerPushToken();
    };

    void registerForUser();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) void registerPushToken();
    });

    const timer = setInterval(() => void syncDndWithNotifications(), 60_000);
    return () => {
      clearInterval(timer);
      listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <DynamicIslandProvider>
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
    </DynamicIslandProvider>
  );
}
