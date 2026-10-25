-- Run the admin review RPC with the caller's RLS permissions.
alter function public.admin_review_verification(uuid, text) security invoker;

revoke all on function public.admin_review_verification(uuid, text) from public;
revoke all on function public.admin_review_verification(uuid, text) from anon;
grant execute on function public.admin_review_verification(uuid, text) to authenticated;
