-- Create missing triggers and backfill data to show proper user names

-- 1) Trigger: Create a profile row for each new auth user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 2) Trigger: Ensure tasks.created_by is automatically set for new tasks
DROP TRIGGER IF EXISTS before_insert_set_created_by ON public.tasks;
CREATE TRIGGER before_insert_set_created_by
  BEFORE INSERT ON public.tasks
  FOR EACH ROW EXECUTE PROCEDURE public.set_task_created_by();

-- 3) Trigger: When a list is created, add owner membership automatically
DROP TRIGGER IF EXISTS after_insert_add_owner_membership ON public.lists;
CREATE TRIGGER after_insert_add_owner_membership
  AFTER INSERT ON public.lists
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_list_membership();

-- 4) Keep updated_at fresh on updates
DROP TRIGGER IF EXISTS set_tasks_updated_at ON public.tasks;
CREATE TRIGGER set_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_lists_updated_at ON public.lists;
CREATE TRIGGER set_lists_updated_at
  BEFORE UPDATE ON public.lists
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- 5) Backfill profiles for all existing users so names/emails show up
INSERT INTO public.profiles (id, display_name, avatar_url)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data ->> 'name', u.email),
  u.raw_user_meta_data ->> 'avatar_url'
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- 6) Backfill tasks.created_by where it's missing
-- Use the list owner as the creator when unknown (best-effort default)
UPDATE public.tasks t
SET created_by = l.owner_id
FROM public.lists l
WHERE t.list_id = l.id
  AND t.created_by IS NULL;