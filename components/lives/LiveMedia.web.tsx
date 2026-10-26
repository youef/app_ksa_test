import { OASIS } from '@/lib/oasis';
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
  const [media, setMedia] = useState<LiveMediaState>({ cameraEnabled: false, microphoneEnabled: false });
  const [playbackBlocked, setPlaybackBlocked] = useState(false);
  const [cameraMessage, setCameraMessage] = useState('');
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [hasLocalVideo, setHasLocalVideo] = useState(false);

  useEffect(() => { callbacksRef.current.onConnectionChange?.(connection); }, [connection]);
  useEffect(() => { orderTiles(); updateGridLayout(); }, [participantOrder.join('|')]);
  useEffect(() => { callbacksRef.current.onQualityChange?.(quality); }, [quality]);
  useEffect(() => { callbacksRef.current.onMediaStateChange?.(media); }, [media]);

  // One visual tile per participant. Remote audio stays audible; only local audio is muted.
  const attachedRef = useRef(new Map<string, { element: HTMLMediaElement; tile: HTMLDivElement | null; track: Track }>());
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

  const syncVideoStatus = () => {
    const all = Array.from(attachedRef.current.entries());
    setHasRemoteVideo(all.some(([key, item]) => !key.startsWith('local:') && item.track.kind === Track.Kind.Video));
    setHasLocalVideo(all.some(([key, item]) => key.startsWith('local:') && item.track.kind === Track.Kind.Video));
  };

  const attachTrack = (track: Track, participantIdentity: string, participantName: string, isLocal = false) => {
    const container = videoHostRef.current;
    if (!container || !track) return;
    // Keep distinct source publications, including a replaced camera or screen share.
    const key = (isLocal ? 'local:' : 'remote:') + participantIdentity + ':' + (track.sid || track.kind);
    if (attachedRef.current.has(key)) return;
    const element = track.attach() as HTMLMediaElement;
    element.autoplay = true;
    element.setAttribute('autoplay', '');
    element.setAttribute('playsinline', '');
    element.setAttribute('webkit-playsinline', '');
    if (element instanceof HTMLVideoElement) element.playsInline = true;
    element.muted = isLocal;

    let tile: HTMLDivElement | null = null;
    if (track.kind === Track.Kind.Video) {
      tile = document.createElement('div');
      tile.dataset.liveParticipantTile = 'true';
      tile.dataset.participantId = participantIdentity;
      Object.assign(tile.style, {
        position: 'relative', minWidth: '0', minHeight: '0', overflow: 'hidden',
        borderRadius: '14px', background: '#081b17', border: '1px solid rgba(255,255,255,.12)',
      });
      const label = document.createElement('div');
      label.textContent = participantName || 'مشارك';
      Object.assign(label.style, {
        position: 'absolute', right: '10px', bottom: '10px', zIndex: '2',
        color: '#fff', fontSize: '12px', fontWeight: '700',
        background: 'rgba(2,6,23,.72)', padding: '5px 10px', borderRadius: '999px',
        maxWidth: '85%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      });
      Object.assign(element.style, {
        width: '100%', height: '100%', objectFit: 'cover', display: 'block',
        position: 'absolute', inset: '0', zIndex: '0',
      });
      tile.appendChild(element);
      tile.appendChild(label);
      container.appendChild(tile);
    } else {
      // Audio tracks are NEVER grid tiles. A hidden audio element must not take
      // a cell away from the presenter's video.
      Object.assign(element.style, { position: 'absolute', width: '1px', height: '1px', opacity: '0', pointerEvents: 'none' });
      container.appendChild(element);
    }

    attachedRef.current.set(key, { element, tile, track });
    void element.play().catch(() => {
      if (!isLocal) setPlaybackBlocked(true);
    });
    orderTiles();
    updateGridLayout();
    syncVideoStatus();
  };

  const detachTrack = (track: Track, participantIdentity: string, isLocal = false) => {
    const key = (isLocal ? 'local:' : 'remote:') + participantIdentity + ':' + (track.sid || track.kind);
    const attached = attachedRef.current.get(key);
    if (!attached) return;
    track.detach(attached.element);
    attached.element.remove();
    attached.tile?.remove();
    attachedRef.current.delete(key);
    updateGridLayout();
    syncVideoStatus();
  };

  const retryPlayback = () => {
    const room = roomRef.current;
    if (!room) return;
    void room.startAudio().then(() => setPlaybackBlocked(false)).catch(() => setPlaybackBlocked(true));
    for (const attached of attachedRef.current.values()) {
      void attached.element.play().catch(() => setPlaybackBlocked(true));
    }
  };

  const retryCamera = () => {
    const room = roomRef.current;
    if (!room || !canPublish) return;
    setCameraMessage('');
    void room.localParticipant.setCameraEnabled(true).then(() => {
      setCameraMessage('');
    }).catch(() => {
      setCameraMessage('تعذر تشغيل الكاميرا. امنح الإذن من إعدادات المتصفح ثم حاول مرة أخرى.');
    });
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
      detachTrack(track, participant.identity, false);
      syncMedia();
    });

    room.on(RoomEvent.LocalTrackPublished, (publication) => {
      if (publication.track) attachTrack(publication.track, room.localParticipant.identity, room.localParticipant.name || room.localParticipant.identity, true);
      syncMedia();
    });

    room.on(RoomEvent.LocalTrackUnpublished, (publication) => {
      if (publication.track) detachTrack(publication.track, room.localParticipant.identity, true);
      syncMedia();
    });

    room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      for (const item of Array.from(attachedRef.current.values())) {
        if (!item.element.parentNode) continue;
      }
      // A participant may disconnect without individual TrackUnsubscribed callbacks.
      for (const [key, item] of Array.from(attachedRef.current.entries())) {
        if (key.startsWith('remote:' + participant.identity + ':')) detachTrack(item.track, participant.identity);
      }
    });
    room.on(RoomEvent.TrackMuted, () => syncMedia());
    room.on(RoomEvent.TrackUnmuted, () => syncMedia());
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
        // Reconcile tracks already present when subscribing to an ongoing stream.
        // This is particularly important when joining after the host goes live.
        for (const participant of room.remoteParticipants.values()) {
          for (const publication of participant.trackPublications.values()) {
            if (publication.track && publication.isSubscribed)
              attachTrack(publication.track, participant.identity, participant.name || participant.identity, false);
          }
        }
        if (canPublish) {
          const camera = await room.localParticipant.setCameraEnabled(true).then(() => true).catch(() => false);
          if (!camera) setCameraMessage('الكاميرا لم تبدأ. تحقق من الأذونات ثم اضغط تشغيل الكاميرا.');
          const microphone = await room.localParticipant.setMicrophoneEnabled(true).then(() => true).catch(() => false);
          if (!microphone && camera) setCameraMessage('الميكروفون غير متاح. يمكن متابعة بث الصورة بدون صوت.');
          for (const publication of room.localParticipant.trackPublications.values()) {
            if (publication.track) attachTrack(publication.track, room.localParticipant.identity, room.localParticipant.name || room.localParticipant.identity, true);
          }
        }
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
        if (!cancelled) {
          setConnection('disconnected');
          callbacksRef.current.onError?.(error instanceof Error ? error.message : 'تعذر الاتصال بغرفة البث.');
        }
      }
    })();

    return () => {
      cancelled = true;
      // Detach all tracks before disconnecting.
      for (const [, attached] of attachedRef.current) {
        attached.track.detach(attached.element);
        attached.element.remove();
        attached.tile?.remove();
      }
      attachedRef.current.clear();
      room.removeAllListeners();
      void room.disconnect();
      roomRef.current = null;
    };
  }, [url, token, canPublish]);

  return (
    <View style={{ flex: 1, backgroundColor: OASIS.colors.live, minHeight: 280 }}>
      <div ref={videoHostRef} style={{ position: 'absolute', inset: 0, minHeight: 280, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gridTemplateRows: 'minmax(0, 1fr)', gap: '4px', padding: '3px', boxSizing: 'border-box' }} />
      {connection !== 'connected' ? (
        <View pointerEvents="none" style={{ position: 'absolute', zIndex: 3, left: 0, right: 0, top: '44%', alignItems: 'center' }}>
          <ActivityIndicator color="#6ee7b7" />
          <Text style={{ color: '#fff', marginTop: 10 }}>{connection === 'reconnecting' ? 'جارٍ استعادة الاتصال…' : 'جارٍ الاتصال بالبث…'}</Text>
        </View>
      ) : null}
      {connection === 'connected' && !(canPublish ? hasLocalVideo : hasRemoteVideo) ? (
        <View pointerEvents="none" style={{ position: 'absolute', zIndex: 3, top: '38%', left: 22, right: 22, alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', textAlign: 'center' }}>{canPublish ? 'لم تبدأ صورة الكاميرا بعد' : 'بانتظار صورة المضيف'}</Text>
          <Text style={{ color: '#b6d6c9', fontSize: 12, marginTop: 6, textAlign: 'center' }}>{canPublish ? 'اسمح بالكاميرا وتأكد أنها غير مستخدمة في تطبيق آخر' : 'أنت متصل بغرفة البث. ستظهر الصورة تلقائيًا عند تشغيل الكاميرا.'}</Text>
        </View>
      ) : null}
      {canPublish && cameraMessage && (
        <View style={{ position: 'absolute', bottom: 125, left: 12, right: 12, zIndex: 5, alignItems: 'center' }}>
          <Text style={{ color: '#ffe4e6', textAlign: 'center', marginBottom: 8, fontSize: 12 }}>{cameraMessage}</Text>
          <Text onPress={retryCamera} accessibilityRole="button" style={{ color: '#fff', backgroundColor: '#047857', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, overflow: 'hidden', fontWeight: '700' }}>إعادة تشغيل الكاميرا</Text>
        </View>
      )}
      {playbackBlocked && !canPublish && (
        <View style={{ position: 'absolute', bottom: 134, left: 12, right: 12, zIndex: 6, alignItems: 'center' }}>
          <Text onPress={retryPlayback} accessibilityRole="button" style={{ color: '#fff', backgroundColor: '#047857', paddingHorizontal: 20, paddingVertical: 11, borderRadius: 22, overflow: 'hidden', fontWeight: '700' }}>اضغط لتشغيل الصوت والصورة</Text>
        </View>
      )}
    </View>
  );
}
