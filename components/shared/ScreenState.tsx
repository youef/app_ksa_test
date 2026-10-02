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
      {type === 'loading' ? <ActivityIndicator size="large" color="#059669" /> : <View style={[styles.dot, type === 'error' && styles.errorDot]} />}
      <Text style={styles.title}>{title || fallbackTitle}</Text>
      <Text style={styles.message}>{message || fallbackMessage}</Text>
    </View>
  );
}
const styles=StyleSheet.create({
  wrap:{flex:1,minHeight:220,alignItems:'center',justifyContent:'center',padding:24},
  dot:{width:12,height:12,borderRadius:6,backgroundColor:'#059669',marginBottom:12},
  errorDot:{backgroundColor:'#dc2626'},
  title:{fontSize:17,fontWeight:'800',color:'#0f172a',textAlign:'center',marginTop:8},
  message:{fontSize:13,color:'#64748b',textAlign:'center',marginTop:6},
});