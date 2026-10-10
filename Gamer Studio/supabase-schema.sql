create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  username text not null,
  content text not null,
  created_at timestamptz not null default now(),
  likes_count integer not null default 0 check (likes_count >= 0)
);

alter table public.posts
  add column if not exists media_url text,
  add column if not exists media_type text,
  add column if not exists comments_count integer not null default 0;

create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  followed_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  check (follower_id <> followed_id)
);

create index if not exists follows_followed_idx
  on public.follows (followed_id, created_at desc);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  post_id uuid references public.posts(id) on delete set null,
  type text not null,
  message text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  drop constraint if exists notifications_type_allowed;
alter table public.notifications
  add constraint notifications_type_allowed
  check (type in ('login', 'new_member', 'like', 'comment', 'follow'));

create index if not exists notifications_recipient_created_idx
  on public.notifications (recipient_id, created_at desc);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'notifications'
    ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  username text not null,
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists comments_post_created_idx
  on public.comments (post_id, created_at asc);

update public.posts as posts
set comments_count = (
  select count(*)::integer
  from public.comments as comments
  where comments.post_id = posts.id
)
where posts.comments_count <> (
  select count(*)::integer
  from public.comments as comments
  where comments.post_id = posts.id
);

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.follows enable row level security;
alter table public.notifications enable row level security;
alter table public.comments enable row level security;

grant select on public.profiles to authenticated;
grant insert (id, username, avatar_url) on public.profiles to authenticated;
grant update (username, avatar_url) on public.profiles to authenticated;
grant select, insert, delete on public.posts to authenticated;
grant select on public.post_likes to authenticated;
grant select on public.follows to authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant select, insert on public.comments to authenticated;

drop policy if exists "Profiles are readable by authenticated users" on public.profiles;
create policy "Profiles are readable by authenticated users"
  on public.profiles for select to authenticated using (true);

drop policy if exists "Users can create their own profile" on public.profiles;
create policy "Users can create their own profile"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Posts are readable by authenticated users" on public.posts;
create policy "Posts are readable by authenticated users"
  on public.posts for select to authenticated using (true);

drop policy if exists "Users can create their own posts" on public.posts;
create policy "Users can create their own posts"
  on public.posts for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own posts" on public.posts;
create policy "Users can delete their own posts"
  on public.posts for delete to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can read their own likes" on public.post_likes;
create policy "Users can read their own likes"
  on public.post_likes for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can read follows they created" on public.follows;
create policy "Users can read follows they created"
  on public.follows for select to authenticated
  using (auth.uid() = follower_id);

drop policy if exists "Users can read their own notifications" on public.notifications;
create policy "Users can read their own notifications"
  on public.notifications for select to authenticated
  using (auth.uid() = recipient_id);

drop policy if exists "Users can mark their own notifications read" on public.notifications;
create policy "Users can mark their own notifications read"
  on public.notifications for update to authenticated
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

drop policy if exists "Comments are readable by authenticated users" on public.comments;
create policy "Comments are readable by authenticated users"
  on public.comments for select to authenticated using (true);

drop policy if exists "Users can create their own comments" on public.comments;
create policy "Users can create their own comments"
  on public.comments for insert to authenticated
  with check (auth.uid() = user_id);

create or replace function public.create_profile_for_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'name',
      split_part(coalesce(new.email, ''), '@', 1),
      'Gamer'
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
    set username = excluded.username,
        avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.create_profile_for_user();

drop trigger if exists on_auth_user_metadata_updated on auth.users;
create trigger on_auth_user_metadata_updated
  after update of raw_user_meta_data on auth.users
  for each row execute procedure public.create_profile_for_user();

update public.profiles as profiles
set username = coalesce(
      auth_users.raw_user_meta_data ->> 'display_name',
      auth_users.raw_user_meta_data ->> 'name',
      profiles.username
    ),
    avatar_url = coalesce(
      auth_users.raw_user_meta_data ->> 'avatar_url',
      profiles.avatar_url
    )
from auth.users as auth_users
where profiles.id = auth_users.id
  and (
    profiles.username is distinct from coalesce(
      auth_users.raw_user_meta_data ->> 'display_name',
      auth_users.raw_user_meta_data ->> 'name',
      profiles.username
    )
    or profiles.avatar_url is distinct from coalesce(
      auth_users.raw_user_meta_data ->> 'avatar_url',
      profiles.avatar_url
    )
  );

create or replace function public.notify_new_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (recipient_id, actor_id, type, message)
  select profiles.id, new.id, 'new_member', new.username || ' joined Gamer Studio'
  from public.profiles as profiles
  where profiles.id <> new.id;
  return new;
end;
$$;

drop trigger if exists on_profile_created_notify_members on public.profiles;
create trigger on_profile_created_notify_members
  after insert on public.profiles
  for each row execute procedure public.notify_new_member();

create or replace function public.record_login_notification()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Sign in to create a login notification';
  end if;

  insert into public.notifications (recipient_id, actor_id, type, message)
  values (current_user_id, current_user_id, 'login', 'You signed in to Gamer Studio');
end;
$$;

revoke all on function public.record_login_notification() from public;
grant execute on function public.record_login_notification() to authenticated;

create or replace function public.toggle_follow(p_followed_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  did_follow boolean;
  followed_username text;
begin
  if current_user_id is null then
    raise exception 'Sign in to follow gamers';
  end if;
  if p_followed_id = current_user_id then
    raise exception 'You cannot follow yourself';
  end if;

  select profiles.username into followed_username
  from public.profiles as profiles
  where profiles.id = p_followed_id
  for update;
  if not found then
    raise exception 'Gamer not found';
  end if;

  if exists (
    select 1 from public.follows
    where follower_id = current_user_id and followed_id = p_followed_id
  ) then
    delete from public.follows
    where follower_id = current_user_id and followed_id = p_followed_id;
    did_follow := false;
  else
    insert into public.follows (follower_id, followed_id)
    values (current_user_id, p_followed_id);
    did_follow := true;
    insert into public.notifications (recipient_id, actor_id, type, message)
    values (
      p_followed_id,
      current_user_id,
      'follow',
      coalesce(
        (select profiles.username from public.profiles as profiles where profiles.id = current_user_id),
        'A gamer'
      ) || ' started following you'
    );
  end if;

  return jsonb_build_object('following', did_follow);
end;
$$;

revoke all on function public.toggle_follow(uuid) from public;
grant execute on function public.toggle_follow(uuid) to authenticated;

create or replace function public.notify_comment_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.username := coalesce(
    (select profiles.username from public.profiles as profiles where profiles.id = new.user_id),
    'Gamer'
  );

  insert into public.notifications (recipient_id, actor_id, post_id, type, message)
  select posts.user_id, new.user_id, new.post_id, 'comment',
         new.username || ' commented on your post'
  from public.posts as posts
  where posts.id = new.post_id
    and posts.user_id <> new.user_id;
  return new;
end;
$$;

drop trigger if exists on_comment_created_notify_post_owner on public.comments;
create trigger on_comment_created_notify_post_owner
  before insert on public.comments
  for each row execute procedure public.notify_comment_created();

create or replace function public.increment_post_comment_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.posts
  set comments_count = comments_count + 1
  where id = new.post_id;
  return new;
end;
$$;

drop trigger if exists on_comment_created_increment_post_count on public.comments;
create trigger on_comment_created_increment_post_count
  after insert on public.comments
  for each row execute procedure public.increment_post_comment_count();

create or replace function public.toggle_post_like(p_post_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  did_like boolean;
  updated_count integer;
begin
  if current_user_id is null then
    raise exception 'Sign in to like posts';
  end if;

  perform 1 from public.posts where id = p_post_id for update;
  if not found then
    raise exception 'Post not found';
  end if;

  if exists (
    select 1 from public.post_likes
    where post_id = p_post_id and user_id = current_user_id
  ) then
    delete from public.post_likes
    where post_id = p_post_id and user_id = current_user_id;
    did_like := false;
    update public.posts
      set likes_count = greatest(likes_count - 1, 0)
      where id = p_post_id
      returning likes_count into updated_count;
  else
    insert into public.post_likes (post_id, user_id)
    values (p_post_id, current_user_id);
    did_like := true;
    update public.posts
      set likes_count = likes_count + 1
      where id = p_post_id
      returning likes_count into updated_count;
    insert into public.notifications (recipient_id, actor_id, post_id, type, message)
    select posts.user_id, current_user_id, posts.id, 'like',
           coalesce(
             (select profiles.username from public.profiles as profiles where profiles.id = current_user_id),
             'Someone'
           ) || ' liked your post'
    from public.posts as posts
    where posts.id = p_post_id
      and posts.user_id <> current_user_id;
  end if;

  return jsonb_build_object('liked', did_like, 'likesCount', updated_count);
end;
$$;

revoke all on function public.toggle_post_like(uuid) from public;
grant execute on function public.toggle_post_like(uuid) to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'game assets',
  'game assets',
  true,
  5242880,
  array['image/*', 'video/*']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can view game asset images" on storage.objects;
create policy "Anyone can view game asset images"
  on storage.objects for select
  using (bucket_id = 'game assets');

drop policy if exists "Users can upload their own profile images" on storage.objects;
create policy "Users can upload their own profile images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'game assets'
    and (
      (
        (storage.foldername(name))[1] = 'profile-pictures'
        and (storage.foldername(name))[2] = (select auth.uid())::text
      )
      or (
        (storage.foldername(name))[1] = 'posts'
        and (storage.foldername(name))[2] = (select auth.uid())::text
      )
    )
  );

drop policy if exists "Users can update their own profile images" on storage.objects;
create policy "Users can update their own profile images"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'game assets'
    and (
      (
        (storage.foldername(name))[1] = 'profile-pictures'
        and (storage.foldername(name))[2] = (select auth.uid())::text
      )
      or (
        (storage.foldername(name))[1] = 'posts'
        and (storage.foldername(name))[2] = (select auth.uid())::text
      )
    )
  )
  with check (
    bucket_id = 'game assets'
    and (
      (
        (storage.foldername(name))[1] = 'profile-pictures'
        and (storage.foldername(name))[2] = (select auth.uid())::text
      )
      or (
        (storage.foldername(name))[1] = 'posts'
        and (storage.foldername(name))[2] = (select auth.uid())::text
      )
    )
  );

drop policy if exists "Users can delete their own profile images" on storage.objects;
create policy "Users can delete their own profile images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'game assets'
    and (
      (
        (storage.foldername(name))[1] = 'profile-pictures'
        and (storage.foldername(name))[2] = (select auth.uid())::text
      )
      or (
        (storage.foldername(name))[1] = 'posts'
        and (storage.foldername(name))[2] = (select auth.uid())::text
      )
    )
  );
