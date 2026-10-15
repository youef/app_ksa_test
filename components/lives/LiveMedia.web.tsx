import { useEffect, useRef, useState } from 'react';
import { ConnectionQuality, ConnectionState, Room, RoomEvent, Track, type TrackPublication, type RemoteTrack } from 'livekit-client';
import { ActivityIndicator, Text, View } from 'react-native';

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

export default function LiveMedia({ url, token, canPublish, onConnectionChange, onQualityChange, onMediaStateChange, onApiReady, onReady, onError }: LiveMediaProps) {
  const roomRef = useRef<Room | null>(null);
  const videoHostRef = useRef<HTMLDivElement | null>(null);
  const callbacksRef = useRef({ onConnectionChange, onQualityChange, onMediaStateChange, onApiReady, onReady, onError });
  callbacksRef.current = { onConnectionChange, onQualityChange, onMediaStateChange, onApiReady, onReady, onError };

  const [connection, setConnection] = useState<LiveMediaConnection>('connecting');
  const [quality, setQuality] = useState<LiveMediaQuality>('unknown');
  const [media, setMedia] = useState<LiveMediaState>({ cameraEnabled: canPublish, microphoneEnabled: canPublish });

  useEffect(() => { callbacksRef.current.onConnectionChange?.(connection); }, [connection]);
  useEffect(() => { callbacksRef.current.onQualityChange?.(quality); }, [quality]);
  useEffect(() => { callbacksRef.current.onMediaStateChange?.(media); }, [media]);

  // Track attached media elements so we don't leak them or duplicate them.
  const attachedRef = useRef(new Map<string, HTMLMediaElement>());

  const attachTrack = (track: Track) => {
    const container = videoHostRef.current;
    if (!container || !track) return;

    const participantIdentity = track.sid || 'local';
    const key = `${participantIdentity}-${track.kind}`;

    // Track already attached — skip duplicates.
    if (attachedRef.current.has(key)) return;

    const element = track.attach() as HTMLMediaElement;
    element.setAttribute('playsinline', '');
    element.setAttribute('webkit-playsinline', '');
    element.setAttribute('autoplay', '');
    element.autoplay = true;
    element.playsInline = true;
    element.style.width = '100%';
    element.style.height = '100%';
    element.style.objectFit = 'cover';

    // Mute local audio to prevent echo; keep video unmuted.
    if (track.kind === Track.Kind.Audio) {
      element.muted = true;
    }

    // Store reference for cleanup.
    attachedRef.current.set(key, element);
    container.appendChild(element);

    // Try to play; if the browser blocks it, catch silently.
    void element.play().catch(() => {
      // Autoplay blocked — user interaction will trigger play via controls.
    });
  };

  const detachTrack = (track: Track) => {
    const participantIdentity = track.sid || 'local';
    const key = `${participantIdentity}-${track.kind}`;
    const element = attachedRef.current.get(key);
    if (element) {
      element.remove();
      attachedRef.current.delete(key);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;
    const syncMedia = () => {
      if (cancelled) return;
      setMedia({
        cameraEnabled: room.localParticipant.isCameraEnabled,
        microphoneEnabled: room.localParticipant.isMicrophoneEnabled,
      });
    };

    room.on(RoomEvent.TrackSubscribed, (_track: RemoteTrack, _publication: TrackPublication, participant) => {
      const tracks = participant.getTrackPublications();
      for (const pub of tracks) {
        if (pub.track) attachTrack(pub.track);
      }
      syncMedia();
    });

    room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
      detachTrack(track);
      syncMedia();
    });

    room.on(RoomEvent.LocalTrackPublished, (publication) => {
      if (publication.track) attachTrack(publication.track);
      syncMedia();
    });

    room.on(RoomEvent.LocalTrackUnpublished, (publication) => {
      if (publication.track) detachTrack(publication.track);
      syncMedia();
    });

    room.on(RoomEvent.ConnectionStateChanged, (state) => setConnection(connectionFromState(state)));
    room.on(RoomEvent.Reconnecting, () => setConnection('reconnecting'));
    room.on(RoomEvent.SignalReconnecting, () => setConnection('reconnecting'));
    room.on(RoomEvent.Reconnected, () => setConnection('connected'));
    room.on(RoomEvent.ConnectionQualityChanged, (nextQuality, participant) => {
      if (participant === room.localParticipant) setQuality(normalizeQuality(nextQuality));
    });
    room.on(RoomEvent.Disconnected, () => {
      setConnection('disconnected');
      if (!cancelled) callbacksRef.current.onError?.('انقطع الاتصال بالبث. حاول إعادة الدخول.');
    });

    void (async () => {
      try {
        await room.connect(url, token, { autoSubscribe: true });
        if (cancelled) return;
        if (canPublish) await room.localParticipant.enableCameraAndMicrophone();
        if (cancelled) return;
        syncMedia();
        setQuality(normalizeQuality(room.localParticipant.connectionQuality));
        setConnection('connected');
        callbacksRef.current.onApiReady?.({
          setCameraEnabled: (enabled) => {
            void roomRef.current?.localParticipant.setCameraEnabled(enabled).then(syncMedia).catch(() => {});
          },
          setMicrophoneEnabled: (enabled) => {
            void roomRef.current?.localParticipant.setMicrophoneEnabled(enabled).then(syncMedia).catch(() => {});
          },
        });
        callbacksRef.current.onReady?.();
      } catch (error) {
        if (!cancelled) callbacksRef.current.onError?.(error instanceof Error ? error.message : 'تعذر فتح الكاميرا أو الاتصال.');
      }
    })();

    return () => {
      cancelled = true;
      // Detach all tracks before disconnecting.
      for (const [, element] of attachedRef.current) {
        element.remove();
      }
      attachedRef.current.clear();
      room.removeAllListeners();
      void room.disconnect();
      roomRef.current = null;
    };
  }, [url, token, canPublish]);

  return (
    <View style={{ flex: 1, backgroundColor: '#020617', minHeight: 280 }}>
      {connection !== 'connected' && <View style={{ position: 'absolute', zIndex: 1, inset: 0, alignItems: 'center', justifyContent: 'center' } as any}><ActivityIndicator color="#fff" /><Text style={{ color: '#fff', marginTop: 10 }}>جارٍ الاتصال بالبث…</Text></View>}
      <div ref={videoHostRef} style={{ position: 'absolute', inset: 0, minHeight: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
    </View>
  );
}
