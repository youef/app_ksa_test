import { supabase } from './supabase';
import { getActiveLocation } from './locationSync';
export type NeighborAccess = { can_view: boolean; can_message: boolean; target_id: string | null };
export async function getNeighborAccess(lookup: string): Promise<NeighborAccess> {
  const location = await getActiveLocation();
  const scope = !location?.district || ['كل الأحياء','كل أحياء المدينة','جميع الأحياء'].includes(location.district) ? 'city' : 'district';
  const { data, error } = await supabase.rpc('hayna_neighbor_access',{p_lookup:lookup,p_scope:scope});
  if(error)throw error;
  return {can_view:data?.can_view===true,can_message:data?.can_message===true,target_id:typeof data?.target_id==='string'?data.target_id:null};
}
