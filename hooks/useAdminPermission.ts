import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { parseAdminPermissions, type AdminPermission } from '@/lib/adminPermissions';

export function useAdminPermission(permission: AdminPermission) {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [error, setError] = useState('');
  const sequence = useRef(0);
  useFocusEffect(useCallback(() => {
    const request = ++sequence.current;
    setLoading(true); setAllowed(false); setError('');
    void supabase.rpc('hayna_my_admin_permissions').then(({ data, error: cause }) => {
      if (sequence.current !== request) return;
      setAllowed(!cause && parseAdminPermissions(data)[permission]);
      setError(cause ? 'تعذر التحقق من الصلاحيات. أعد المحاولة بعد التحقق من الاتصال.' : '');
      setLoading(false);
    });
    return () => { ++sequence.current; };
  }, [permission]));
  return { loading, allowed, error };
}
