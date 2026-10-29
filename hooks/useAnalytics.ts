import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { identifyAnalytics, recordAnalyticsRoute, recordAnalyticsSession, retryAnalytics } from '@/lib/analytics';

/** Mount once at the router root; safe on iOS, Android and web. */
export function useAnalytics(pathname: string) {
  const path = useRef(pathname);
  path.current=pathname;
  const signedIn=useRef(false);
  useEffect(()=>{
    let active=true;
    let pending: ReturnType<typeof setTimeout> | undefined;
    const start=(userId: string | null)=>{
      if(!active)return;
      signedIn.current=Boolean(userId);
      identifyAnalytics(userId);
      if(userId){recordAnalyticsSession();recordAnalyticsRoute(path.current);}
    };
    // Defer SDK requests out of Supabase's auth callback to avoid its session lock.
    const {data:listener}=supabase.auth.onAuthStateChange((_event,session)=>{
      if(pending)clearTimeout(pending);
      pending=setTimeout(()=>start(session?.user?.id||null),0);
    });
    void supabase.auth.getSession().then(({data})=>start(data.session?.user?.id||null)).catch(()=>{});
    const state=AppState.addEventListener('change',next=>{
      if(next==='active' && signedIn.current){recordAnalyticsSession();recordAnalyticsRoute(path.current);retryAnalytics();}
    });
    const retry=()=>{if(signedIn.current){recordAnalyticsSession();recordAnalyticsRoute(path.current);retryAnalytics();}};
    if(Platform.OS==='web' && typeof window!=='undefined')window.addEventListener('online',retry);
    return ()=>{active=false;if(pending)clearTimeout(pending);listener.subscription.unsubscribe();state.remove();if(Platform.OS==='web' && typeof window!=='undefined')window.removeEventListener('online',retry);};
  },[]);
  useEffect(()=>{if(signedIn.current)recordAnalyticsRoute(pathname);},[pathname]);
}
