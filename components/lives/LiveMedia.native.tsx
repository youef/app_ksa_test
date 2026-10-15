import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import {
  AudioSession,
  LiveKitRoom,
  VideoTrack,
  AudioTrack,
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

function RoomTracks() {
  const tracks = useTracks([Track.Source.Camera, Track.Source.Microphone]);
  const videos = tracks.filter((track) => isTrackReference(track) && track.publication.kind === Track.Kind.Video);
  if (!videos.length) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color="#fff" /><Text style={{ color: '#fff', marginTop: 10 }}>بانتظار صورة المضيف…</Text></View>;
  }
  return <View style={{ flex: 1 }}>{videos.map((track, index) => <VideoTrack key={`${track.participant.identity}-${index}`} trackRef={track} style={{ flex: index === 0 ? 1 : undefined, width: index === 0 ? '100%' : 96, height: index === 0 ? undefined : 140, position: index === 0 ? 'relative' : 'absolute', top: index === 0 ? 0 : 170, right: index === 0 ? 0 : 12, zIndex: index === 0 ? 0 : 1, borderRadius: index === 0 ? 0 : 12 }} />)}</View>;
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

export default function LiveMedia({ url, token, canPublish, onConnectionChange, onQualityChange, onMediaStateChange, onApiReady, onReady, onError }: LiveMediaProps) {
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
        <RoomTracks />
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
