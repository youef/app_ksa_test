import { router } from 'expo-router';
import { showDialog } from '@/lib/dialog';

export function requireAccount(message = 'أنشئ حساباً أو سجّل الدخول لاستخدام هذه الميزة.') {
  showDialog({
    title: 'الميزة للمستخدمين',
    message,
    buttons: [
      { text: 'لاحقاً', style: 'cancel' },
      { text: 'تسجيل الدخول أو إنشاء حساب', onPress: () => router.push('/auth') },
    ],
  });
}
