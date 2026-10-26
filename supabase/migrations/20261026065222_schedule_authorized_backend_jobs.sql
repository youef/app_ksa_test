create extension if not exists pg_cron;
select cron.schedule('hayna-scheduled-broadcast-dispatch','* * * * *',$cron$select app_private.run_backend_job('scheduled-broadcast-dispatch');$cron$);
select cron.schedule('hayna-refresh-counters','*/5 * * * *',$cron$select app_private.run_backend_job('refresh-counters');$cron$);
select cron.schedule('hayna-notifications-cleanup','0 3 * * 0',$cron$select app_private.run_backend_job('notifications-cleanup');$cron$);
select cron.schedule('hayna-weekly-admin-report','0 9 * * 0',$cron$select app_private.run_backend_job('weekly-admin-report');$cron$);
