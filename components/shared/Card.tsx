import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

type Props = { children: ReactNode; style?: ViewStyle };

export default function Card({ children, style }: Props) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card:{backgroundColor:'#fff',borderRadius:20,borderWidth:1,borderColor:'#E2ECE6',padding:16,shadowColor:'#0f172a',shadowOpacity:.035,shadowRadius:12,shadowOffset:{width:0,height:4},elevation:1},
});