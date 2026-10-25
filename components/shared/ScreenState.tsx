import { OasisEmptyIllustration } from '@/components/oasis/OasisEmptyIllustration';
import { OASIS } from '@/lib/oasis';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

type Props = { type:'loading'|'empty'|'error'; title?:string; message?:string };

export default function ScreenState({ type, title, message }: Props) {
  const defaults = {
    loading: ['جاري التحميل…','لحظات ونجهز لك الصفحة'],
    empty: ['لا يوجد محتوى بعد','سيظهر هنا عندما يتوفر شيء جديد'],
    error: ['حدث خطأ','حاول مرة أخرى'],
  } as const;
  const [fallbackTitle, fallbackMessage] = defaults[type];
  return (
    <View style={styles.wrap}>
      {type === 'loading' ? <ActivityIndicator size="large" color={OASIS.colors.primary} /> : <OasisEmptyIllustration kind={type === 'error' ? 'error' : 'empty-feed'} />}
      <Text style={styles.title}>{title || fallbackTitle}</Text>
      <Text style={styles.message}>{message || fallbackMessage}</Text>
    </View>
  );
}
const styles=StyleSheet.create({
  wrap:{flex:1,minHeight:220,alignItems:'center',justifyContent:'center',padding:16},
  dot:{width:12,height:12,borderRadius:6,backgroundColor:OASIS.colors.primary,marginBottom:12},
  errorDot:{backgroundColor:OASIS.colors.danger},
  title:{fontSize:17,fontWeight:'600',color:OASIS.colors.ink,textAlign:'center',marginTop:8},
  message:{fontSize:13,color:OASIS.colors.muted,textAlign:'center',marginTop:6},
});
