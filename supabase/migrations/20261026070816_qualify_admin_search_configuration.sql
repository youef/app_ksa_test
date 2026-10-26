create or replace function public.admin_global_search(p_query text,p_limit integer default 20)
returns table(type text,id uuid,title text,subtitle text,city text,district text,created_at timestamptz,rank real)
language plpgsql security definer set search_path='' as $search$
declare terms tsquery;
begin
 perform public.assert_is_admin();
 terms:=pg_catalog.websearch_to_tsquery('pg_catalog.arabic'::regconfig,coalesce(p_query,''));
 if pg_catalog.numnode(terms)=0 then return; end if;
 return query
 select combined.* from(
  select 'question'::text,q.id,q.title,q.body,q.city,q.district,q.created_at,pg_catalog.ts_rank_cd(q.search_vector,terms) as rank
   from public.questions q where q.search_vector @@ terms
  union all
  select 'service'::text,s.id,s.name,s.description,s.city,s.district,s.created_at,pg_catalog.ts_rank_cd(s.search_vector,terms)
   from public.services s where s.search_vector @@ terms
  union all
  select 'request'::text,r.id,r.title,r.description,r.city,r.district,r.created_at,pg_catalog.ts_rank_cd(r.search_vector,terms)
   from public.requests r where r.search_vector @@ terms
 ) combined order by combined.rank desc,combined.created_at desc limit greatest(1,least(coalesce(p_limit,20),100));
end $search$;
revoke execute on function public.admin_global_search(text,integer) from public,anon;
grant execute on function public.admin_global_search(text,integer) to authenticated;
