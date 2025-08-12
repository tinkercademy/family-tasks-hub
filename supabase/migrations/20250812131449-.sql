-- 1) Create a simple public profiles table and auto-populate it on user signup
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Ensure clean slate for profiles policies
drop policy if exists "Profiles are viewable by everyone" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;

-- Profiles policies: readable by everyone, users can update their own profile
create policy "Profiles are viewable by everyone"
  on public.profiles for select to authenticated using (true);

create policy "Users can update their own profile"
  on public.profiles for update to authenticated using (auth.uid() = id);

-- Function + trigger to insert a profile when a new auth user is created
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', new.email),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Create trigger only if it doesn't already exist
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2) Add created_by to tasks and backfill
alter table public.tasks add column if not exists created_by uuid;

-- Backfill existing rows using list owner as creator when possible
update public.tasks t
set created_by = l.owner_id
from public.lists l
where t.list_id = l.id and t.created_by is null;

-- Ensure new inserts have created_by set automatically
create or replace function public.set_task_created_by()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.created_by is null then
    new.created_by = auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists set_task_created_by on public.tasks;
create trigger set_task_created_by
  before insert on public.tasks
  for each row execute procedure public.set_task_created_by();

-- Make the column not null after backfill
alter table public.tasks alter column created_by set not null;

-- 3) Update RLS to make lists and tasks globally shared among authenticated users
-- Drop existing restrictive policies on lists
drop policy if exists "Members can view lists" on public.lists;
drop policy if exists "Owners can delete their lists" on public.lists;
drop policy if exists "Owners can update their lists" on public.lists;
drop policy if exists "Users can create their own lists" on public.lists;

-- Create permissive policies for authenticated users
create policy "All authenticated can view lists"
  on public.lists for select to authenticated using (true);

create policy "All authenticated can create lists"
  on public.lists for insert to authenticated with check (true);

create policy "All authenticated can update lists"
  on public.lists for update to authenticated using (true);

create policy "All authenticated can delete lists"
  on public.lists for delete to authenticated using (true);

-- Drop existing restrictive policies on tasks
drop policy if exists "Members can create tasks in their lists" on public.tasks;
drop policy if exists "Members can delete tasks in their lists" on public.tasks;
drop policy if exists "Members can update tasks in their lists" on public.tasks;
drop policy if exists "Members can view tasks in their lists" on public.tasks;

-- Create permissive policies for authenticated users on tasks
create policy "All authenticated can view tasks"
  on public.tasks for select to authenticated using (true);

create policy "All authenticated can create tasks"
  on public.tasks for insert to authenticated with check (true);

create policy "All authenticated can update tasks"
  on public.tasks for update to authenticated using (true);

create policy "All authenticated can delete tasks"
  on public.tasks for delete to authenticated using (true);