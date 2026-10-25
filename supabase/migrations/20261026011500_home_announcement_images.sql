-- Support text-only, image-only and mixed home announcements.
alter table public.home_announcements add column if not exists image_url text;
alter table public.home_announcements drop constraint if exists home_announcements_title_check;
alter table public.home_announcements drop constraint if exists home_announcements_message_check;
alter table public.home_announcements alter column title drop not null;
alter table public.home_announcements alter column message drop not null;
alter table public.home_announcements add constraint home_announcement_content_valid check (
 (title is null or char_length(btrim(title)) between 1 and 120)
 and (message is null or char_length(btrim(message)) between 1 and 1000)
 and (image_url is null or image_url ~ '^https://[^[:space:]]+$')
 and (nullif(btrim(coalesce(title,'')),'') is not null or nullif(btrim(coalesce(message,'')),'') is not null or image_url is not null)
);
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('home-announcements','home-announcements',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp'];
create policy "public reads announcement images" on storage.objects for select to anon,authenticated using (bucket_id='home-announcements');
create policy "admin uploads announcement images" on storage.objects for insert to authenticated with check (bucket_id='home-announcements' and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
create policy "admin deletes announcement images" on storage.objects for delete to authenticated using (bucket_id='home-announcements' and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));