import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { addNetworkStateListener, getNetworkStateAsync, type NetworkState } from 'expo-network';
import RouteState from './RouteState';

function isOffline(state: NetworkState) {
  return state.isConnected === false || state.isInternetReachable === false;
}

export default function ConnectivityScreen() {
  const [offline, setOffline] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let active = true;
    let receivedUpdate = false;
    const subscription = addNetworkStateListener(state => {
      receivedUpdate = true;
      if (active) setOffline(isOffline(state));
    });
    void getNetworkStateAsync().then(state => {
      if (active && !receivedUpdate) setOffline(isOffline(state));
    }).catch(() => {});
    return () => { active = false; subscription.remove(); };
  }, []);

  async function retry() {
    setChecking(true);
    try {
      setOffline(isOffline(await getNetworkStateAsync()));
    } finally {
      setChecking(false);
    }
  }

  if (!offline) return null;
  return (
    <View accessibilityViewIsModal style={[StyleSheet.absoluteFillObject, { zIndex: 1200 }]}>
      <RouteState kind="offline" checking={checking} onRetry={() => { void retry().catch(() => {}); }} />
    </View>
  );
}
