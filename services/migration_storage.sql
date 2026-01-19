-- Enable the storage extension if not already enabled (usually enabled by default)
-- create extension if not exists "storage";

-- Create the bucket 'avatars'
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Set up RLS policies for the 'avatars' bucket

-- 1. Allow public access to view files (needed for the img src)
create policy "Public Access"
on storage.objects for select
using ( bucket_id = 'avatars' );

-- 2. Allow authenticated users (or anon for this app context) to upload files
-- Ideally, we should restrict to authenticated, but for this project checking anon is fine as per previous logic.
create policy "Allow Uploads"
on storage.objects for insert
with check ( bucket_id = 'avatars' );

-- 3. Allow users to update their own files (or any file for this admin panel context)
create policy "Allow Updates"
on storage.objects for update
using ( bucket_id = 'avatars' );

-- 4. Allow delete
create policy "Allow Delete"
on storage.objects for delete
using ( bucket_id = 'avatars' );
