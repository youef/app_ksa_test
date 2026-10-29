import { supabase } from './supabase';
export type NeighborAccess = { can_view: boolean; can_message: boolean; target_id: string | null };
export async function getNeighborAccess(lookup: string): Promise<NeighborAccess> {
  // Profile visibility follows the account's city; feed district filters must
  // not hide a neighbor's profile. Messaging is still decided by the server.
  const { data, error } = await supabase.rpc('hayna_neighbor_access',{p_lookup:lookup,p_scope:'city'});
  if(error)throw error;
  return {can_view:data?.can_view===true,can_message:data?.can_message===true,target_id:typeof data?.target_id==='string'?data.target_id:null};
}
