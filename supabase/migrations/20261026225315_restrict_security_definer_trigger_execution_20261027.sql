-- Hayna security hardening: trigger-only security-definer functions must not be exposed as client RPCs.
-- Applied to production as Supabase migration 20261026225315.
-- Does not change trigger bindings, owners, bodies, or row-level security rules.
do $hayna$
declare fn record;
begin
  for fn in
    select n.nspname as schema_name, p.proname as function_name,
           pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.prorettype = 'pg_catalog.trigger'::regtype
  loop
    execute format('revoke execute on function %I.%I(%s) from public, anon, authenticated',
                   fn.schema_name, fn.function_name, fn.args);
    execute format('grant execute on function %I.%I(%s) to service_role',
                   fn.schema_name, fn.function_name, fn.args);
  end loop;
end;
$hayna$;
