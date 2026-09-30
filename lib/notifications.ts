import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

Notifications.setNotificationHandler({handleNotification: async()=>({shouldPlaySound:true,shouldSetBadge:true,shouldShowBanner:true,shouldShowList:true})});

export async function registerPushToken(){
  if(Platform.OS==='web') return null;
  const perms=await Notifications.getPermissionsAsync();
  let final=perms.status;
  if(final!=='granted') final=(await Notifications.requestPermissionsAsync()).status;
  if(final!=='granted') return null;
  const token=(await Notifications.getExpoPushTokenAsync()).data;
  const {data:u}=await supabase.auth.getUser();
  if(!u.user) return token;
  await supabase.from('push_tokens').upsert({user_id:u.user.id,token,platform:Platform.OS}, {onConflict:'token'});
  if(Platform.OS==='android') await Notifications.setNotificationChannelAsync('default',{name:'حيّنا',importance:Notifications.AndroidImportance.HIGH});
  return token;
}
