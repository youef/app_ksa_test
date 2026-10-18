import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import {
  AudioSession,
  LiveKitRoom,
  VideoTrack,
  useTracks,
  isTrackReference,
  registerGlobals,
  useLocalParticipant,
  useRoomContext,
  useConnectionState,
} from '@livekit/react-native';
import { ConnectionQuality, ConnectionState, RoomEvent, Track, type Participant } from 'livekit-client';

registerGlobals();

export type LiveMediaConnection = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
export type LiveMediaQuality = 'excellent' | 'good' | 'poor' | 'unknown';
export type LiveMediaState = { cameraEnabled: boolean; microphoneEnabled: boolean };

export type LiveMediaApi = {
  setCameraEnabled: (enabled: boolean) => void;
  setMicrophoneEnabled: (enabled: boolean) => void;
};

export type LiveMediaProps = {
  url: string;
  token: string;
  canPublish: boolean;
  participantOrder?: string[];
  onConnectionChange?: (state: LiveMediaConnection) => void;
  onQualityChange?: (quality: LiveMediaQuality) => void;
  onMediaStateChange?: (state: LiveMediaState) => void;
  onApiReady?: (api: LiveMediaApi) => void;
  onReady?: () => void;
  onError?: (message: string) => void;
};

function normalizeQuality(quality: ConnectionQuality): LiveMediaQuality {
  if (quality === ConnectionQuality.Excellent) return 'excellent';
  if (quality === ConnectionQuality.Good) return 'good';
  if (quality === ConnectionQuality.Poor) return 'poor';
  return 'unknown';
}

function connectionFromState(state: ConnectionState): LiveMediaConnection {
  if (state === ConnectionState.Connected) return 'connected';
  if (state === ConnectionState.Reconnecting || state === ConnectionState.SignalReconnecting) return 'reconnecting';
  if (state === ConnectionState.Connecting) return 'connecting';
  return 'disconnected';
}

function RoomTracks({ participantOrder = [] }: { participantOrder?: string[] }) {
  const tracks = useTracks([Track.Source.Camera, Track.Source.Microphone]);
  const videos = tracks.filter((track) => isTrackReference(track) && track.publication.kind === Track.Kind.Video);
  videos.sort((a, b) => {
    const aIndex = participantOrder.indexOf(a.participant.identity);
    const bIndex = participantOrder.indexOf(b.participant.identity);
    return (aIndex < 0 ? Number.MAX_SAFE_INTEGER : aIndex) - (bIndex < 0 ? Number.MAX_SAFE_INTEGER : bIndex);
  });
  if (!videos.length) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color="#fff" /><Text style={{ color: '#fff', marginTop: 10 }}>بانتظار صورة المشاركين…</Text></View>;
  }
  const columns = videos.length <= 1 ? 1 : videos.length <= 4 ? 2 : 3;
  const tileHeight = videos.length <= 2 ? '100%' : videos.length <= 4 ? '50%' : '33.333%';
  return (
    <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignContent: 'stretch', backgroundColor: '#020617' }}>
      {videos.map((track, index) => {
        const participantName = track.participant.name || track.participant.identity || 'مشارك';
        return (
          <View key={`${track.participant.identity}-${track.publication.trackSid || index}`} style={{ width: columns === 1 ? '100%' : `${100 / columns}%`, height: tileHeight, padding: 2, position: 'relative' }}>
            <VideoTrack trackRef={track} style={{ flex: 1, width: '100%', height: '100%', borderRadius: 12, overflow: 'hidden' }} />
            <View pointerEvents="none" style={{ position: 'absolute', left: 10, bottom: 10, maxWidth: '88%', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 14, backgroundColor: 'rgba(2,6,23,0.72)' }}>
              <Text numberOfLines={1} style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{participantName}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/**
 * Bridges LiveKit room events to the surrounding room UI so the host toolbar and
 * the status pills stay accurate without re-implementing media inside the screen.
 */
function RoomBridge({ onConnectionChange, onQualityChange, onMediaStateChange, onApiReady }: {
  onConnectionChange?: (state: LiveMediaConnection) => void;
  onQualityChange?: (quality: LiveMediaQuality) => void;
  onMediaStateChange?: (state: LiveMediaState) => void;
  onApiReady?: (api: LiveMediaApi) => void;
}) {
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const { localParticipant, isCameraEnabled, isMicrophoneEnabled } = useLocalParticipant();

  useEffect(() => {
    onConnectionChange?.(connectionFromState(connectionState));
  }, [connectionState, onConnectionChange]);

  useEffect(() => {
    onMediaStateChange?.({ cameraEnabled: isCameraEnabled, microphoneEnabled: isMicrophoneEnabled });
  }, [isCameraEnabled, isMicrophoneEnabled, onMediaStateChange]);

  useEffect(() => {
    onApiReady?.({
      setCameraEnabled: (enabled) => { void localParticipant.setCameraEnabled(enabled); },
      setMicrophoneEnabled: (enabled) => { void localParticipant.setMicrophoneEnabled(enabled); },
    });
  }, [localParticipant, onApiReady]);

  useEffect(() => {
    const onQuality = (quality: ConnectionQuality, participant: Participant) => {
      if (participant.identity !== localParticipant.identity) return;
      onQualityChange?.(normalizeQuality(quality));
    };
    const onReconnecting = () => onConnectionChange?.('reconnecting');
    const onReconnected = () => onConnectionChange?.('connected');
    onQualityChange?.(normalizeQuality(localParticipant.connectionQuality));
    room.on(RoomEvent.ConnectionQualityChanged, onQuality);
    room.on(RoomEvent.Reconnecting, onReconnecting);
    room.on(RoomEvent.SignalReconnecting, onReconnecting);
    room.on(RoomEvent.Reconnected, onReconnected);
    return () => {
      room.off(RoomEvent.ConnectionQualityChanged, onQuality);
      room.off(RoomEvent.Reconnecting, onReconnecting);
      room.off(RoomEvent.SignalReconnecting, onReconnecting);
      room.off(RoomEvent.Reconnected, onReconnected);
    };
  }, [room, localParticipant, onQualityChange, onConnectionChange]);

  return null;
}

export default function LiveMedia({ url, token, canPublish, participantOrder, onConnectionChange, onQualityChange, onMediaStateChange, onApiReady, onReady, onError }: LiveMediaProps) {
  useEffect(() => {
    void AudioSession.startAudioSession();
    return () => { void AudioSession.stopAudioSession(); };
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#020617', minHeight: 280 }}>
      <LiveKitRoom
        serverUrl={url}
        token={token}
        connect
        audio={canPublish}
        video={canPublish}
        options={{ adaptiveStream: { pixelDensity: 'screen' }, dynacast: true }}
        onConnected={onReady}
        onDisconnected={() => onError?.('انقطع الاتصال بالبث. أعد المحاولة.')}
        onError={(error) => onError?.(error.message || 'تعذر الاتصال بغرفة البث.')}
      >
        <RoomTracks participantOrder={participantOrder} />
        <RoomBridge
          onConnectionChange={onConnectionChange}
          onQualityChange={onQualityChange}
          onMediaStateChange={onMediaStateChange}
          onApiReady={onApiReady}
        />
      </LiveKitRoom>
    </View>
  );
}
