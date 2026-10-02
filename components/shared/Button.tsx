import { Pressable, StyleSheet, Text, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = {
  children: ReactNode;
  onPress?: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
};

export default function Button({ children, onPress, variant = 'primary', loading = false, disabled = false, style, textStyle }: Props) {
  const solid = variant === 'primary';
  const danger = variant === 'danger';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        solid && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && styles.ghost,
        danger && styles.danger,
        (disabled || loading) && styles.disabled,
        pressed && !disabled && !loading && styles.pressed,
        style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={solid || danger ? '#fff' : '#059669'} /> : <Text style={[styles.text, !solid && !danger && styles.darkText, textStyle]}>{children}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base:{minHeight:46,borderRadius:15,paddingHorizontal:18,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:8},
  primary:{backgroundColor:'#059669'},
  secondary:{backgroundColor:'#ecfdf5',borderWidth:1,borderColor:'#a7f3d0'},
  ghost:{backgroundColor:'transparent'},
  danger:{backgroundColor:'#dc2626'},
  disabled:{opacity:.5},
  pressed:{transform:[{scale:.985}]},
  text:{color:'#fff',fontSize:15,fontWeight:'800'},
  darkText:{color:'#047857'},
});