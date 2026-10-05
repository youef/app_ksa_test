import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

type Props = { children: ReactNode; style?: ViewStyle };

export default function Card({ children, style }: Props) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card:{backgroundColor:'#fff',borderRadius:22,borderWidth:1,borderColor:'#e2e8f0',padding:16,shadowColor:'#0f172a',shadowOpacity:.06,shadowRadius:18,shadowOffset:{width:0,height:8},elevation:3},
});