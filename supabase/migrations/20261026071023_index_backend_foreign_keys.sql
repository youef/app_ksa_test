set local lock_timeout='3s';
set local statement_timeout='60s';
do $indexes$ declare f record; begin
 for f in
  select c.conname,t.relname,n.nspname,
   (select string_agg(format('%I',a.attname),',' order by k.ordinality)
    from unnest(c.conkey) with ordinality k(attnum,ordinality)
    join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.attnum) as columns
  from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=c.connamespace
  where c.contype='f' and n.nspname='public' and not exists(
   select 1 from pg_index i where i.indrelid=c.conrelid and i.indisvalid and i.indpred is null
    and (i.indkey::smallint[])[0:cardinality(c.conkey)-1] @> c.conkey)
 loop
  execute format('create index if not exists %I on %I.%I (%s)',
   'idx_fk_'||left(f.relname,35)||'_'||left(md5(f.conname),8),f.nspname,f.relname,f.columns);
 end loop;
 if not exists(select 1 from pg_constraint where conrelid='public.analytics_funnel_daily'::regclass and contype='p') then
  alter table public.analytics_funnel_daily add constraint analytics_funnel_daily_pkey primary key(date,step);
 end if;
end $indexes$;
