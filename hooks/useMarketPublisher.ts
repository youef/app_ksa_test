import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { getCurrentDeviceLocation, reverseGeocodeDeviceLocation } from '@/lib/deviceLocation';
import { savePermanentMyLocation, isAllKingdom } from '@/lib/locationSync';
import { isKnownSaudiCity } from '@/lib/saudiLocations';
import { NO_MARKET_ACCESS, parseMarketCapabilities, type MarketCapabilities } from '@/lib/marketPublishing';

export type PublishingProfile = { id: string; display_name: string | null; username: string | null; account_type: string; is_verified: boolean; is_verified_merchant: boolean; freelance_trade: string | null; role: string; region: string | null; city: string | null; district: string | null };
const FIELDS = 'id,display_name,username,account_type,is_verified,is_verified_merchant,freelance_trade,role,region,city,district' as const;
function exactLocation(profile: PublishingProfile | null) {
  return Boolean(profile?.city && isKnownSaudiCity(profile.city) && !isAllKingdom(profile.city) && profile.district?.trim() && !['كل الأحياء','كل أحياء المدينة','جميع الأحياء'].includes(profile.district.trim()));
}
async function readPublisher() {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) return { profile: null, capabilities: NO_MARKET_ACCESS };
  const [profile, permissions] = await Promise.all([
    supabase.from('profiles').select(FIELDS).eq('id', auth.user.id).single(),
    supabase.rpc('hayna_my_account_capabilities'),
  ]);
  if (profile.error) throw profile.error;
  if (permissions.error) throw permissions.error;
  return { profile: profile.data as PublishingProfile, capabilities: parseMarketCapabilities(permissions.data) };
}

export function useMarketPublisher() {
  const [profile, setProfile] = useState<PublishingProfile | null>(null);
  const [capabilities, setCapabilities] = useState(NO_MARKET_ACCESS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [locationError, setLocationError] = useState('');
  const active = useRef(false);
  const sequence = useRef(0);
  const reload = useCallback(async () => {
    const current = ++sequence.current;
    setLoading(true); setError(''); setLocationError('');
    try {
      let result = await readPublisher();
      if (!active.current || current !== sequence.current) return;
      setProfile(result.profile); setCapabilities(result.capabilities);
      if (result.profile && (result.capabilities.can_publish_products || result.capabilities.can_publish_services) && !exactLocation(result.profile)) {
        try {
          const coords = await getCurrentDeviceLocation();
          if (!coords) throw new Error('اسمح بإذن الموقع لتحديد مدينة وحي النشر تلقائيًا.');
          const place = await reverseGeocodeDeviceLocation(coords);
          if (!place?.city || !place.district || place.isOutsideKSA || !isKnownSaudiCity(place.city)) throw new Error('لم نتمكن من تحديد حيّك بدقة. أعد المحاولة بعد تفعيل الموقع.');
          if (!active.current || current !== sequence.current) return;
          await savePermanentMyLocation({ region: place.region || 'المملكة', city: place.city, district: place.district }, true);
          result = await readPublisher();
          if (!exactLocation(result.profile)) throw new Error('لم يُحفظ موقع الحساب بعد. راجع إعدادات موقعك ثم أعد المحاولة.');
          if (active.current && current === sequence.current) { setProfile(result.profile); setCapabilities(result.capabilities); }
        } catch (cause) { if (active.current && current === sequence.current) setLocationError((cause as Error)?.message || 'تعذر تحديد موقع النشر تلقائيًا.'); }
      }
    } catch (cause) {
      if (active.current && current === sequence.current) { setCapabilities(NO_MARKET_ACCESS); setError((cause as Error)?.message || 'تعذر التحقق من صلاحيات الحساب.'); }
    } finally { if (active.current && current === sequence.current) setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => {
    active.current = true; void reload();
    return () => { active.current = false; ++sequence.current; };
  }, [reload]));

  const requireAccess = useCallback(async (kind: 'products' | 'services') => {
    const result = await readPublisher();
    if (!result.profile || !result.capabilities[`can_publish_${kind}`]) throw new Error('verified_market_account_required');
    if (!exactLocation(result.profile)) throw new Error('verified_profile_location_required');
    let businessId: string | null = null;
    if (result.capabilities.can_manage_business) {
      const { data, error } = await supabase.rpc('hayna_ensure_my_business');
      if (error) throw error;
      businessId = data;
    }
    return { ...result, profile: result.profile, businessId };
  }, []);
  return { profile, capabilities, loading, error, locationError, locationReady: exactLocation(profile) && !locationError, reload, requireAccess };
}
