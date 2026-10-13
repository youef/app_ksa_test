import { useEffect } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { AudioSession, LiveKitRoom, VideoTrack, useTracks, isTrackReference, registerGlobals, useLocalParticipant } from '@livekit/react-native';
import { Track } from 'livekit-client';
import { Camera, CameraOff, Mic, MicOff } from 'lucide-react-native';

registerGlobals();

export type LiveMediaProps = {
  url: string;
  token: string;
  canPublish: boolean;
  onReady?: () => void;
  onError?: (message: string) => void;
};

function RoomTracks() {
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: true });
  const videos = tracks.filter((track) => isTrackReference(track) && track.publication.kind === Track.Kind.Video);
  if (!videos.length) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color="#fff" /><Text style={{ color: '#fff', marginTop: 10 }}>بانتظار صورة المضيف…</Text></View>;
  }
  return <View style={{ flex: 1 }}>{videos.map((track, index) => <VideoTrack key={`${track.participant.identity}-${index}`} trackRef={track} style={{ flex: index === 0 ? 1 : undefined, width: index === 0 ? '100%' : 96, height: index === 0 ? undefined : 140, position: index === 0 ? 'relative' : 'absolute', top: index === 0 ? 0 : 170, right: index === 0 ? 0 : 12, zIndex: index === 0 ? 0 : 1, borderRadius: index === 0 ? 0 : 12 }} />)}</View>;
}

function RoomControls() {
  const { localParticipant, isCameraEnabled, isMicrophoneEnabled } = useLocalParticipant();
  return <View style={{ position: 'absolute', top: 88, left: 14, zIndex: 4, flexDirection: 'row', gap: 8 }}>
    <Pressable onPress={() => void localParticipant.setCameraEnabled(!isCameraEnabled)} style={{ width: 38, height: 38, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(2,6,23,0.58)' }}>{isCameraEnabled ? <Camera color="#fff" size={18} /> : <CameraOff color="#fb7185" size={18} />}</Pressable>
    <Pressable onPress={() => void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)} style={{ width: 38, height: 38, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(2,6,23,0.58)' }}>{isMicrophoneEnabled ? <Mic color="#fff" size={18} /> : <MicOff color="#fb7185" size={18} />}</Pressable>
  </View>;
}

export default function LiveMedia({ url, token, canPublish, onReady, onError }: LiveMediaProps) {
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
        {canPublish && <RoomControls />}
      </LiveKitRoom>
    </View>
  );
}
