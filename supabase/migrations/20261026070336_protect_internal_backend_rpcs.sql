do $acl$ declare f record; begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('compute_dau','compute_funnel_daily','compute_heatmap_daily','compute_retention_weekly','compute_revenue_daily','generate_weekly_report','get_requests_revenue','get_verification_pending_count')
 loop
  execute format('revoke execute on function %s from public,anon,authenticated',f.signature);
  execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $acl$;
