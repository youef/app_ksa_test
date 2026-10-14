import type { ComponentType } from 'react';

export type LiveMediaProps = {
  url: string;
  token: string;
  canPublish: boolean;
  showPublisherControls?: boolean;
  onReady?: () => void;
  onError?: (message: string) => void;
};

declare const LiveMedia: ComponentType<LiveMediaProps>;
export default LiveMedia;
