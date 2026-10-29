import React,{useEffect,useState} from 'react';
import {ActivityIndicator,Image,Modal,Pressable,ScrollView,StyleSheet,Text,View,useWindowDimensions} from 'react-native';
import {X,ZoomIn,ZoomOut,ImageOff} from 'lucide-react-native';
export function ImagePreviewModal({uri,title,onClose}:{uri:string|null;title:string;onClose:()=>void}){
 const {width,height}=useWindowDimensions();const [zoom,setZoom]=useState(1),[loading,setLoading]=useState(true),[failed,setFailed]=useState(false);
 useEffect(()=>{setZoom(1);setLoading(true);setFailed(false);},[uri]);
 return <Modal visible={!!uri} transparent animationType="fade" onRequestClose={onClose}><View style={s.backdrop} accessibilityViewIsModal>
  <View style={s.bar}><Pressable accessibilityRole="button" accessibilityLabel="إغلاق الصورة" onPress={onClose} style={s.button}><X size={23} color="#fff"/></Pressable><Text style={s.title}>{title}</Text><View style={s.zoom}><Pressable accessibilityRole="button" accessibilityLabel="تصغير الصورة" disabled={zoom<=1} onPress={()=>setZoom(Math.max(1,zoom-.5))} style={s.button}><ZoomOut size={21} color={zoom<=1?'#64748b':'#fff'}/></Pressable><Pressable accessibilityRole="button" accessibilityLabel="تكبير الصورة" disabled={zoom>=3} onPress={()=>setZoom(Math.min(3,zoom+.5))} style={s.button}><ZoomIn size={21} color={zoom>=3?'#64748b':'#fff'}/></Pressable></View></View>
  {failed?<View style={s.center}><ImageOff size={40} color="#cbd5e1"/><Text style={s.hint}>تعذر تحميل الصورة</Text></View>:<ScrollView contentContainerStyle={{flexGrow:1}}><ScrollView horizontal contentContainerStyle={{flexGrow:1,alignItems:'center',justifyContent:'center'}}>{uri&&<Image accessibilityLabel={title} source={{uri}} resizeMode="contain" style={{width:width*zoom,height:Math.max(250,height-150)*zoom}} onLoad={()=>setLoading(false)} onError={()=>{setLoading(false);setFailed(true);}}/>}</ScrollView></ScrollView>}
  {loading&&!failed&&<View pointerEvents="none" style={[StyleSheet.absoluteFillObject,s.center]}><ActivityIndicator color="#fff"/></View>}
  <Text style={s.hint}>كبّر الصورة بالأزرار، ثم اسحب لاستعراضها</Text>
 </View></Modal>;
}
const s=StyleSheet.create({backdrop:{flex:1,backgroundColor:'rgba(5,15,12,.98)',paddingTop:36,paddingBottom:18},bar:{flexDirection:'row-reverse',alignItems:'center',gap:8,paddingHorizontal:12,paddingBottom:12},button:{width:44,height:44,borderRadius:22,backgroundColor:'rgba(255,255,255,.1)',alignItems:'center',justifyContent:'center'},title:{color:'#fff',fontSize:14,fontWeight:'600',flex:1,textAlign:'right'},zoom:{flexDirection:'row',gap:8},hint:{color:'#cbd5e1',fontSize:12,textAlign:'center',padding:12},center:{flex:1,alignItems:'center',justifyContent:'center',gap:12}});
