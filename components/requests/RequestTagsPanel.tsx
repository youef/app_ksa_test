import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { RequestTagEditor, RequestTags } from './RequestTags';
import { CommunityButton, CommunityCard, CommunityError, CommunityText } from '@/components/community/CommunityUI';
export default function RequestTagsPanel({ requestId, isOwner, text }: { requestId: string; isOwner: boolean; text: string }) {
  const [tags, setTags] = useState<string[]>([]), [draft, setDraft] = useState<string[]>([]);
  const [editing, setEditing] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => { let active = true; supabase.rpc('hayna_request_tags', { p_request_ids: [requestId] }).then(({ data, error: failure }) => { if (!active) return; if (failure) { setError('تعذر تحميل وسوم الفزعة.'); return; } const list = (data || []).map((item: { tag: string }) => item.tag); setTags(list); setDraft(list); }); return () => { active = false; }; }, [requestId]);
  const save = async () => { setBusy(true); setError(''); try { const { error: failure } = await supabase.rpc('hayna_set_request_tags', { p_request_id: requestId, p_tags: draft }); if (failure) throw failure; setTags(draft); setEditing(false); } catch (e) { setError((e as Error).message || 'تعذر حفظ الوسوم.'); } finally { setBusy(false); } };
  if (!isOwner && !tags.length && !error) return null;
  return <CommunityCard><CommunityText heading>وسوم الفزعة</CommunityText>{error ? <CommunityError message={error} /> : null}{editing ? <><RequestTagEditor value={draft} onChange={setDraft} text={text} disabled={busy} /><CommunityButton title="حفظ الوسوم" busy={busy} onPress={() => void save()} /><CommunityButton title="إلغاء التعديل" secondary disabled={busy} onPress={() => { setDraft(tags); setEditing(false); }} /></> : <><RequestTags tags={tags} />{isOwner ? <CommunityButton title={tags.length ? 'تعديل الوسوم' : 'إضافة وسوم للفزعة'} secondary onPress={() => setEditing(true)} /> : null}</>}</CommunityCard>;
}
