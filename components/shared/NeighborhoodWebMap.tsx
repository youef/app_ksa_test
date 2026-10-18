import React from 'react';
import { View } from 'react-native';
type NeighborhoodWebMapProps = {
  pins: any[]; places: any[]; center: any; city: string | null;
  onSelectPin: (pin: any) => void; onSelectPlace: (place: any) => void;
  onLocate: () => void | Promise<void>;
};

export default function NeighborhoodWebMap(_props: NeighborhoodWebMapProps) { return <View />; }
