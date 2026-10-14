import type { ComponentType } from 'react';

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
  /** Reports connection lifecycle so the room can show truthful status. */
  onConnectionChange?: (state: LiveMediaConnection) => void;
  /** Reports the local participant network quality. */
  onQualityChange?: (quality: LiveMediaQuality) => void;
  /** Reports local camera/microphone state so the host bar stays accurate. */
  onMediaStateChange?: (state: LiveMediaState) => void;
  /** Hands the publisher controls to the room's own glass toolbar. */
  onApiReady?: (api: LiveMediaApi) => void;
  onReady?: () => void;
  onError?: (message: string) => void;
};

declare const LiveMedia: ComponentType<LiveMediaProps>;
export default LiveMedia;
