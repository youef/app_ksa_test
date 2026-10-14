import { useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, Track, type TrackPublication } from 'livekit-client';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Camera, CameraOff, Mic, MicOff } from 'lucide-react-native';

export type LiveMediaProps = {
  url: string;
  token: string;
  canPublish: boolean;
  showPublisherControls?: boolean;
  onReady?: () => void;
  onError?: (message: string) => void;
};

export default function LiveMedia({ url, token, canPublish, showPublisherControls = true, onReady, onError }: LiveMediaProps) {
  const roomRef = useRef<Room | null>(null);
  const videoHostRef = useRef<HTMLDivElement | null>(null);
  const [connected, setConnected] = useState(false);
  const [mediaRevision, setMediaRevision] = useState(0);
  const [cameraEnabled, setCameraEnabled] = useState(canPublish);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(canPublish);

  useEffect(() => {
    let cancelled = false;
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;
    const refresh = () => setMediaRevision((v) => v + 1);
    room.on(RoomEvent.TrackSubscribed, refresh);
    room.on(RoomEvent.TrackUnsubscribed, refresh);
    room.on(RoomEvent.TrackPublished, refresh);
    room.on(RoomEvent.TrackUnpublished, refresh);
    room.on(RoomEvent.Disconnected, () => {
      setConnected(false);
      if (!cancelled) onError?.('انقطع الاتصال بالبث. حاول إعادة الدخول.');
    });

    void (async () => {
      try {
        await room.connect(url, token, { autoSubscribe: true });
        if (cancelled) return;
        if (canPublish) {
          await room.localParticipant.enableCameraAndMicrophone();
          setCameraEnabled(true);
          setMicrophoneEnabled(true);
        }
        setConnected(true);
        onReady?.();
      } catch (error) {
        if (!cancelled) onError?.(error instanceof Error ? error.message : 'تعذر فتح الكاميرا أو الاتصال.');
      }
    })();
    return () => {
      cancelled = true;
      room.removeAllListeners();
      void room.disconnect();
      roomRef.current = null;
    };
  }, [url, token, canPublish]);

  useEffect(() => {
    const container = videoHostRef.current;
    const room = roomRef.current;
    if (!container || !room) return;
    container.replaceChildren();
    const publications: TrackPublication[] = [];
    for (const participant of [room.localParticipant, ...room.remoteParticipants.values()]) {
      for (const publication of participant.trackPublications.values()) {
        if (participant === room.localParticipant && publication.kind === Track.Kind.Audio) continue;
        if (publication.track && (publication.track.kind === Track.Kind.Video || publication.track.kind === Track.Kind.Audio)) {
          publications.push(publication);
        }
      }
    }
    for (const publication of publications) {
      const track = publication.track;
      if (!track) continue;
      const element = track.attach();
      element.style.width = '100%';
      element.style.height = '100%';
      element.style.objectFit = 'cover';
      container.appendChild(element);
    }
    return () => { for (const publication of publications) publication.track?.detach(); };
  }, [connected, mediaRevision]);

  return (
    <View style={{ flex: 1, backgroundColor: '#020617', minHeight: 280 }}>
      {!connected && <View style={{ position: 'absolute', zIndex: 1, inset: 0, alignItems: 'center', justifyContent: 'center' } as any}><ActivityIndicator color="#fff" /><Text style={{ color: '#fff', marginTop: 10 }}>جارٍ الاتصال بالبث…</Text></View>}
      <div ref={videoHostRef} style={{ width: '100%', height: '100%', minHeight: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
      {canPublish && showPublisherControls && connected && <View style={{ position: 'absolute', top: 88, left: 14, flexDirection: 'row', gap: 8 }}>
        <Pressable onPress={() => { const next = !cameraEnabled; setCameraEnabled(next); void roomRef.current?.localParticipant.setCameraEnabled(next); }} style={{ width: 38, height: 38, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(2,6,23,0.58)' }}>{cameraEnabled ? <Camera color="#fff" size={18} /> : <CameraOff color="#fb7185" size={18} />}</Pressable>
        <Pressable onPress={() => { const next = !microphoneEnabled; setMicrophoneEnabled(next); void roomRef.current?.localParticipant.setMicrophoneEnabled(next); }} style={{ width: 38, height: 38, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(2,6,23,0.58)' }}>{microphoneEnabled ? <Mic color="#fff" size={18} /> : <MicOff color="#fb7185" size={18} />}</Pressable>
      </View>}
    </View>
  );
}
