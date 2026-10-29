import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { productPositionError, type ProductPosition } from './productLocationRules';

export async function readCurrentProductPosition(): Promise<ProductPosition> {
  let result: ProductPosition;
  if (Platform.OS === 'web') {
    if (typeof navigator === 'undefined' || !navigator.geolocation) throw new Error('الموقع غير مدعوم في هذا المتصفح. استخدم متصفحًا يدعم الموقع واتصال HTTPS.');
    result = await new Promise((resolve,reject) => navigator.geolocation.getCurrentPosition(
      p => resolve({latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy,timestamp:p.timestamp}),
      e => reject(new Error(e.code === 1 ? 'اسمح بالوصول إلى موقعك الحالي من إعدادات المتصفح.' : e.code === 3 ? 'انتهت مهلة تحديد الموقع. فعّل GPS ثم أعد المحاولة.' : 'تعذر تحديد موقع الجهاز. تحقق من تشغيل الموقع.')),
      {enableHighAccuracy:true,maximumAge:0,timeout:20000},
    ));
  } else {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) throw new Error('اسمح باستخدام الموقع أثناء فتح التطبيق، مع تفعيل الموقع الدقيق.');
    if (!await Location.hasServicesEnabledAsync()) throw new Error('خدمة الموقع مغلقة. فعّل GPS ثم أعد المحاولة.');
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const p = await Promise.race([
        Location.getCurrentPositionAsync({accuracy:Location.Accuracy.High,mayShowUserSettingsDialog:true}),
        new Promise<never>((_,reject) => {timer=setTimeout(()=>reject(new Error('انتهت مهلة تحديد الموقع. أعد المحاولة في مكان مفتوح.')),25000);}),
      ]);
      result={latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy ?? Infinity,timestamp:p.timestamp,mocked:p.mocked};
    } finally {if(timer)clearTimeout(timer);}
  }
  const error=productPositionError(result);
  if(error)throw new Error(error);
  return result;
}
