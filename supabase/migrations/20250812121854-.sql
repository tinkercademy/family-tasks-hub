-- Helper functions to avoid recursive RLS
create or replace function public.is_member(_list_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.list_memberships
    where list_id = _list_id and user_id = _user_id
  );
$$;

create or replace function public.is_owner(_list_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.lists
    where id = _list_id and owner_id = _user_id
  );
$$;

-- Update policies to use helper functions and avoid self-reference
-- lists
DROP POLICY IF EXISTS "Members can view lists" ON public.lists;
CREATE POLICY "Members can view lists"
  ON public.lists
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = owner_id OR public.is_member(id, auth.uid())
  );

-- list_memberships
DROP POLICY IF EXISTS "Members can view memberships of their lists" ON public.list_memberships;
CREATE POLICY "Members can view memberships of their lists"
  ON public.list_memberships
  FOR SELECT
  TO authenticated
  USING (
    public.is_member(list_memberships.list_id, auth.uid())
    OR public.is_owner(list_memberships.list_id, auth.uid())
  );

DROP POLICY IF EXISTS "Owners can add members" ON public.list_memberships;
CREATE POLICY "Owners can add members"
  ON public.list_memberships
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_owner(list_id, auth.uid())
  );

DROP POLICY IF EXISTS "Owners can update memberships" ON public.list_memberships;
CREATE POLICY "Owners can update memberships"
  ON public.list_memberships
  FOR UPDATE
  TO authenticated
  USING (
    public.is_owner(list_memberships.list_id, auth.uid())
  );

DROP POLICY IF EXISTS "Owners can remove members" ON public.list_memberships;
CREATE POLICY "Owners can remove members"
  ON public.list_memberships
  FOR DELETE
  TO authenticated
  USING (
    public.is_owner(list_memberships.list_id, auth.uid())
  );

-- tasks
DROP POLICY IF EXISTS "Members can view tasks in their lists" ON public.tasks;
CREATE POLICY "Members can view tasks in their lists"
  ON public.tasks
  FOR SELECT
  TO authenticated
  USING (
    public.is_member(tasks.list_id, auth.uid())
    OR public.is_owner(tasks.list_id, auth.uid())
  );

DROP POLICY IF EXISTS "Members can create tasks in their lists" ON public.tasks;
CREATE POLICY "Members can create tasks in their lists"
  ON public.tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_member(tasks.list_id, auth.uid())
    OR public.is_owner(tasks.list_id, auth.uid())
  );

DROP POLICY IF EXISTS "Members can update tasks in their lists" ON public.tasks;
CREATE POLICY "Members can update tasks in their lists"
  ON public.tasks
  FOR UPDATE
  TO authenticated
  USING (
    public.is_member(tasks.list_id, auth.uid())
    OR public.is_owner(tasks.list_id, auth.uid())
  );

DROP POLICY IF EXISTS "Members can delete tasks in their lists" ON public.tasks;
CREATE POLICY "Members can delete tasks in their lists"
  ON public.tasks
  FOR DELETE
  TO authenticated
  USING (
    public.is_member(tasks.list_id, auth.uid())
    OR public.is_owner(tasks.list_id, auth.uid())
  );