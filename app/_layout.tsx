import { Stack } from 'expo-router';
import { DynamicIslandProvider } from '@/context/DynamicIslandContext';

export default function RootLayout() {
  return (
    <DynamicIslandProvider>
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
    </DynamicIslandProvider>
  );
}