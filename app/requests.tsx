import { Redirect } from 'expo-router';

/** Legacy route kept for old links; requests now use the unified Ask flow. */
export default function LegacyRequestRedirect() {
  return <Redirect href="/ask" />;
}
