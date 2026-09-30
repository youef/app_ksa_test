import { StyleSheet } from 'react-native';
export const C={bg:'#F9FAFB',card:'#fff',ink:'#111827',muted:'#6b7280',line:'#f3f4f6',accent:'#0891b2',accentSoft:'#cffafe',success:'#10b981',danger:'#dc2626',warning:'#f59e0b'};
export const S=StyleSheet.create({
  page:{flexGrow:1,padding:18,paddingTop:58,backgroundColor:C.bg},
  title:{fontSize:30,fontWeight:'900',color:C.ink,textAlign:'right'},
  subtitle:{fontSize:15,color:C.muted,textAlign:'right',lineHeight:23,marginTop:5},
  card:{backgroundColor:C.card,borderRadius:20,borderWidth:1,borderColor:C.line,padding:16,marginBottom:12},
  input:{backgroundColor:C.card,borderWidth:1,borderColor:C.line,borderRadius:15,padding:14,textAlign:'right',fontSize:16,marginBottom:10,color:C.ink},
  button:{backgroundColor:C.accent,borderRadius:15,padding:15,alignItems:'center',marginTop:4},
  buttonText:{color:'#fff',fontWeight:'800',fontSize:16},
  ghost:{borderWidth:1,borderColor:C.line,borderRadius:15,padding:13,alignItems:'center',backgroundColor:C.card},
  row:{flexDirection:'row-reverse',alignItems:'center',justifyContent:'space-between'},
  label:{fontWeight:'800',color:C.ink,textAlign:'right',marginBottom:7},
  meta:{color:C.muted,textAlign:'right',fontSize:12},
  body:{color:'#34413b',textAlign:'right',fontSize:15,lineHeight:23},
});