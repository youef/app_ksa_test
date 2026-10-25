import { Image } from 'react-native';
import { oasisAssets } from './assets';
type Kind = 'empty-feed' | 'empty-chat' | 'empty-notifications' | 'empty-market' | 'empty-search' | 'empty-live' | 'empty-map' | 'offline' | 'error' | 'success';
export function OasisEmptyIllustration({ kind = 'empty-feed', compact = false }: { kind?: Kind; compact?: boolean }) { return <Image accessible={false} source={oasisAssets[`empty-states/${kind}`]} resizeMode="contain" style={{ width: compact ? 72 : 96, height: compact ? 63 : 84 }} />; }
