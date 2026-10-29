import { supabase } from '@/lib/supabase';
import { createAnalyticsQueue, analyticsSection } from '@/lib/analyticsMetrics';

function randomSessionId() {
  // Ephemeral analytics session; never used for authentication or retained between launches.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{
    const n=Math.floor(Math.random()*16); return (c==='x'?n:(n&3)|8).toString(16);
  });
}
const queue = createAnalyticsQueue(async payload=>{
  const {error}=await supabase.rpc('hayna_record_analytics',{
    p_event_name:payload.event_name,p_event_key:payload.event_key,p_properties:payload.properties,p_session_id:payload.session_id,
  });
  return !error;
},randomSessionId());

export function identifyAnalytics(userId: string | null) {queue.identify(userId);}
export function recordAnalyticsSession() {
  queue.enqueue('app_open');queue.enqueue('authenticated');queue.enqueue('app_return');
  void queue.flush();
}
export function recordAnalyticsRoute(path: string) {
  // Sensitive account/admin/messaging paths produce no section metadata.
  const section=analyticsSection(path);
  if(section==='other') return;
  if(section==='home') queue.enqueue('home_view');
  else queue.enqueue('section_open',section);
  void queue.flush();
}
export function retryAnalytics() {void queue.flush();}
