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

export default function LiveMedia({ url, token, canPublish, participantOrder = [], onConnectionChange, onQualityChange, onMediaStateChange, onApiReady, onReady, onError }: LiveMediaProps) {
  const roomRef = useRef<Room | null>(null);
  const videoHostRef = useRef<HTMLDivElement | null>(null);
  const callbacksRef = useRef({ onConnectionChange, onQualityChange, onMediaStateChange, onApiReady, onReady, onError });
  callbacksRef.current = { onConnectionChange, onQualityChange, onMediaStateChange, onApiReady, onReady, onError };

  const [connection, setConnection] = useState<LiveMediaConnection>('connecting');
  const [quality, setQuality] = useState<LiveMediaQuality>('unknown');
  const [media, setMedia] = useState<LiveMediaState>({ cameraEnabled: canPublish, microphoneEnabled: canPublish });

  useEffect(() => { callbacksRef.current.onConnectionChange?.(connection); }, [connection]);
  useEffect(() => { orderTiles(); updateGridLayout(); }, [participantOrder.join('|')]);
  useEffect(() => { callbacksRef.current.onQualityChange?.(quality); }, [quality]);
  useEffect(() => { callbacksRef.current.onMediaStateChange?.(media); }, [media]);

  // One visual tile per participant. Remote audio stays audible; only local audio is muted.
  const attachedRef = useRef(new Map<string, { element: HTMLMediaElement; tile: HTMLDivElement }>());
  const participantOrderRef = useRef(participantOrder);
  participantOrderRef.current = participantOrder;

  const orderTiles = () => {
    const container = videoHostRef.current;
    if (!container) return;
    const tiles = Array.from(container.querySelectorAll<HTMLDivElement>('[data-live-participant-tile="true"]'));
    tiles.sort((a, b) => {
      const order = participantOrderRef.current;
      const ai = order.indexOf(a.dataset.participantId || '');
      const bi = order.indexOf(b.dataset.participantId || '');
      return (ai < 0 ? Number.MAX_SAFE_INTEGER : ai) - (bi < 0 ? Number.MAX_SAFE_INTEGER : bi);
    });
    for (const tile of tiles) container.appendChild(tile);
  };

  const updateGridLayout = () => {
    const container = videoHostRef.current;
    if (!container) return;
    const count = container.querySelectorAll('[data-live-participant-tile="true"]').length;
    const columns = count <= 1 ? 1 : count <= 4 ? 2 : 3;
    container.style.display = 'grid';
    container.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
    container.style.gridTemplateRows = count <= 2 ? 'minmax(0, 1fr)' : `repeat(${Math.ceil(count / columns)}, minmax(0, 1fr))`;
  };

  const attachTrack = (track: Track, participantIdentity: string, participantName: string, isLocal = false) => {
    const container = videoHostRef.current;
    if (!container || !track) return;
    const key = `${participantIdentity}-${track.kind}`;
    if (attachedRef.current.has(key)) return;

    let tile = container.querySelector<HTMLDivElement>(`[data-participant-id="${participantIdentity}"]`);
    if (!tile) {
      tile = document.createElement('div');
      tile.dataset.liveParticipantTile = 'true';
      tile.dataset.participantId = participantIdentity;
      Object.assign(tile.style, { position: 'relative', minWidth: '0', minHeight: '0', overflow: 'hidden', borderRadius: '12px', background: '#0f172a', border: '1px solid rgba(255,255,255,.12)' });
      const label = document.createElement('div');
      label.textContent = participantName || 'مشارك';
      Object.assign(label.style, { position: 'absolute', left: '8px', bottom: '8px', zIndex: '2', color: '#fff', fontSize: '12px', fontWeight: '700', background: 'rgba(2,6,23,.78)', padding: '5px 9px', borderRadius: '12px', maxWidth: '85%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
      tile.appendChild(label);
      container.appendChild(tile);
    }

    const element = track.attach() as HTMLMediaElement;
    element.setAttribute('playsinline', '');
    element.setAttribute('webkit-playsinline', '');
    element.setAttribute('autoplay', '');
    element.autoplay = true;
    element.playsInline = true;
    if (track.kind === Track.Kind.Video) {
      Object.assign(element.style, { width: '100%', height: '100%', objectFit: 'cover', display: 'block', position: 'absolute', inset: '0', zIndex: '0' });
    } else {
      element.muted = isLocal;
      Object.assign(element.style, { width: '1px', height: '1px', opacity: '0', position: 'absolute', pointerEvents: 'none' });
    }
    attachedRef.current.set(key, { element, tile });
    tile.appendChild(element);
    void element.play().catch(() => {
      // Browser autoplay policies may require a user gesture for audio.
    });
    orderTiles();
    updateGridLayout();
  };

  const detachTrack = (track: Track, participantIdentity: string) => {
    const key = `${participantIdentity}-${track.kind}`;
    const attached = attachedRef.current.get(key);
    if (!attached) return;
    attached.element.remove();
    attachedRef.current.delete(key);
    if (![...attachedRef.current.values()].some((item) => item.tile === attached.tile)) attached.tile.remove();
    orderTiles();
    updateGridLayout();
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

    room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _publication: TrackPublication, participant) => {
      attachTrack(track, participant.identity, participant.name || participant.identity, false);
      syncMedia();
    });

    room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, _publication: TrackPublication, participant) => {
      detachTrack(track, participant.identity);
      syncMedia();
    });

    room.on(RoomEvent.LocalTrackPublished, (publication) => {
      if (publication.track) attachTrack(publication.track, room.localParticipant.identity, room.localParticipant.name || room.localParticipant.identity, true);
      syncMedia();
    });

    room.on(RoomEvent.LocalTrackUnpublished, (publication) => {
      if (publication.track) detachTrack(publication.track, room.localParticipant.identity);
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
      for (const [, attached] of attachedRef.current) {
        attached.element.remove();
        attached.tile.remove();
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
      <div ref={videoHostRef} style={{ position: 'absolute', inset: 0, minHeight: 280, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gridTemplateRows: 'minmax(0, 1fr)', gap: '4px', padding: '3px', boxSizing: 'border-box' }} />
    </View>
  );
}
