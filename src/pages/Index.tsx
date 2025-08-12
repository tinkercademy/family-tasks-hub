import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import RenameListDialog from "@/components/lists/RenameListDialog";
import EditTaskDialog from "@/components/tasks/EditTaskDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, Pencil, Trash } from "lucide-react";
interface List { id: string; owner_id: string; title: string; created_at: string }
interface Task { id: string; list_id: string; title: string; description: string | null; completed: boolean; due_date: string | null; created_at: string; created_by: string }

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const db = supabase as any;
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [lists, setLists] = useState<List[]>([]);
  const [newListTitle, setNewListTitle] = useState("");
  const [selectedList, setSelectedList] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [listForRename, setListForRename] = useState<List | null>(null);
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskForEdit, setTaskForEdit] = useState<Task | null>(null);
  const [profiles, setProfiles] = useState<Record<string, { display_name: string | null; avatar_url: string | null }>>({});
  useEffect(() => {
    document.title = "Family To‑Do Lists";
    const meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      const m = document.createElement("meta");
      m.name = "description";
      m.content = "Shared family to‑do lists with tasks, powered by Supabase.";
      document.head.appendChild(m);
    } else {
      meta.setAttribute("content", "Shared family to‑do lists with tasks, powered by Supabase.");
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
      setUserEmail(session?.user?.email ?? null);
      if (!session) navigate("/auth", { replace: true });
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
      setUserEmail(session?.user?.email ?? null);
      if (!session) navigate("/auth", { replace: true });
      else setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (!userId) return;
    const loadLists = async () => {
      const { data, error } = await db
        .from('lists')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) {
        toast({ title: 'Failed to load lists', description: error.message, variant: 'destructive' as any });
        return;
      }
      setLists(data || []);
      if (!selectedList && data && data.length > 0) setSelectedList(data[0].id);
    };
    loadLists();
  }, [userId]);

  useEffect(() => {
    if (!selectedList) { setTasks([]); return; }
    const loadTasks = async () => {
      const { data, error } = await db
        .from('tasks')
        .select('*')
        .eq('list_id', selectedList)
        .order('created_at', { ascending: true });
      if (error) {
        toast({ title: 'Failed to load tasks', description: error.message, variant: 'destructive' as any });
        return;
      }
      setTasks(data || []);
    };
    loadTasks();
  }, [selectedList]);

  useEffect(() => {
    const userIds = new Set<string>();
    lists.forEach((l) => userIds.add(l.owner_id));
    tasks.forEach((t) => t.created_by && userIds.add(t.created_by));
    const ids = Array.from(userIds).filter((id) => !(id in profiles));
    if (ids.length === 0) return;
    const loadProfiles = async () => {
      const { data, error } = await db
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', ids);
      if (!error && data) {
        setProfiles((prev) => ({
          ...prev,
          ...Object.fromEntries(
            data.map((p: any) => [p.id, { display_name: p.display_name, avatar_url: p.avatar_url }])
          ),
        }));
      }
    };
    loadProfiles();
  }, [lists, tasks]);

  const addList = async () => {
    if (!newListTitle.trim() || !userId) return;
    const { data, error } = await db
      .from('lists')
      .insert({ title: newListTitle.trim(), owner_id: userId })
      .select()
      .single();
    if (error) {
      toast({ title: 'Could not create list', description: error.message, variant: 'destructive' as any });
      return;
    }
    setLists((prev) => [...prev, data as any]);
    setNewListTitle("");
    setSelectedList((data as any).id);
  };

  const deleteList = async (id: string) => {
    const { error } = await db.from('lists').delete().eq('id', id);
    if (error) {
      toast({ title: 'Could not delete list', description: error.message, variant: 'destructive' as any });
      return;
    }
    setLists((prev) => prev.filter((l) => l.id !== id));
    if (selectedList === id) setSelectedList(null);
  };

  const openRename = (list: List) => {
    setListForRename(list);
    setRenameOpen(true);
  };

  const saveRename = async (newTitle: string) => {
    if (!listForRename) return;
    const { error } = await db.from('lists').update({ title: newTitle }).eq('id', listForRename.id);
    if (error) {
      toast({ title: 'Could not rename list', description: error.message, variant: 'destructive' as any });
      return;
    }
    setLists((prev) => prev.map((l) => (l.id === listForRename.id ? { ...l, title: newTitle } : l)));
    setRenameOpen(false);
  };

  const openEditTask = (task: Task) => {
    setTaskForEdit(task);
    setTaskOpen(true);
  };

  const saveTaskEdit = async (updates: { title: string; description: string | null; due_date: string | null }) => {
    if (!taskForEdit) return;
    const { error } = await db
      .from('tasks')
      .update(updates)
      .eq('id', taskForEdit.id)
      .select()
      .maybeSingle();
    if (error) {
      toast({ title: 'Could not update task', description: error.message, variant: 'destructive' as any });
      return;
    }
    setTasks((prev) => prev.map((t) => (t.id === taskForEdit.id ? { ...t, ...updates } : t)));
    setTaskOpen(false);
  };

  const addTask = async () => {
    if (!newTaskTitle.trim() || !selectedList) return;
    const { data, error } = await db
      .from('tasks')
      .insert({ title: newTaskTitle.trim(), list_id: selectedList })
      .select()
      .single();
    if (error) {
      toast({ title: 'Could not add task', description: error.message, variant: 'destructive' as any });
      return;
    }
    setTasks((prev) => [...prev, data as any]);
    setNewTaskTitle("");
  };

  const toggleTask = async (task: Task) => {
    const { data, error } = await db
      .from('tasks')
      .update({ completed: !task.completed })
      .eq('id', task.id)
      .select()
      .maybeSingle();
    if (error) {
      toast({ title: 'Could not update task', description: error.message, variant: 'destructive' as any });
      return;
    }
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, completed: !t.completed } : t));
  };

  const deleteTask = async (id: string) => {
    const { error } = await db.from('tasks').delete().eq('id', id);
    if (error) {
      toast({ title: 'Could not delete task', description: error.message, variant: 'destructive' as any });
      return;
    }
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const logout = async () => {
    await supabase.auth.signOut();
    navigate('/auth', { replace: true });
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Card>
          <CardHeader>
            <CardTitle>Loading...</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">If this takes long, go to <Link to="/auth" className="underline">Login</Link>.</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!userId) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Card>
          <CardHeader>
            <CardTitle>Family To‑Do</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4">Please <Link to="/auth" className="underline">sign in</Link> to continue.</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  const selected = lists.find((l) => l.id === selectedList) || null;
  const nameFor = (id?: string | null) => profiles[id ?? '']?.display_name ?? 'Unknown user';

  return (
    <main className="min-h-screen">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between py-4">
          <h1 className="text-xl font-semibold">Family To‑Do Lists</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{userEmail}</span>
            <Button onClick={logout}>Logout</Button>
          </div>
        </div>
      </header>

      <section className="container mx-auto py-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        <aside className="md:col-span-1">
          <Card className="border-0 shadow-none">
            <CardHeader>
              <CardTitle>Your Lists</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4">
                <Input placeholder="New list title" value={newListTitle} onChange={(e) => setNewListTitle(e.target.value)} onKeyDown={(e) => e.key==='Enter' && addList()} />
                <Button onClick={addList}>Add</Button>
              </div>
              <ul className="space-y-2">
                {lists.map((l) => (
                  <li key={l.id} className={`flex items-center justify-between rounded-md p-2 ${selectedList===l.id ? 'bg-accent' : ''}`}>
                    <button className="text-left flex-1" onClick={() => setSelectedList(l.id)}>
                      <div className="text-sm font-medium">{l.title}</div>
                      <div className="text-xs text-muted-foreground">by {nameFor(l.owner_id)}</div>
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="List actions">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openRename(l)}>
                          <Pencil className="mr-2 h-4 w-4" /> Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => deleteList(l.id)}>
                          <Trash className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </li>
                ))}
                {lists.length === 0 && <p className="text-sm text-muted-foreground">No lists yet. Create one above.</p>}
              </ul>
            </CardContent>
          </Card>
        </aside>

        <section className="md:col-span-2">
          <Card className="border-0 shadow-none">
            <CardHeader>
              <CardTitle className="flex flex-col">
                <span>{selected ? selected.title : 'Select a list'}</span>
                {selected && (
                  <span className="text-sm font-normal text-muted-foreground">by {nameFor(selected.owner_id)}</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selected ? (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input placeholder="Add a task" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} onKeyDown={(e) => e.key==='Enter' && addTask()} />
                    <Button onClick={addTask}>Add</Button>
                  </div>
                  <ul className="space-y-2">
                    {tasks.map((t) => (
                      <li key={t.id} className="flex items-center justify-between rounded-md p-2">
                        <label className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <input type="checkbox" checked={t.completed} onChange={() => toggleTask(t)} />
                            <span className={t.completed ? 'line-through text-muted-foreground' : ''}>{t.title}</span>
                          </div>
                          <span className="text-xs text-muted-foreground ml-6">by {nameFor(t.created_by)}</span>
                        </label>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Task actions">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditTask(t)}>
                              <Pencil className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => deleteTask(t.id)}>
                              <Trash className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </li>
                    ))}
                    {tasks.length === 0 && <p className="text-sm text-muted-foreground">No tasks yet. Add one above.</p>}
                  </ul>
                </div>
              ) : (
                <p className="text-muted-foreground">Choose a list on the left or create one.</p>
              )}
            </CardContent>
          </Card>
        </section>
      </section>
      <RenameListDialog
        list={listForRename}
        open={renameOpen}
        onOpenChange={setRenameOpen}
        onSave={saveRename}
      />
      <EditTaskDialog
        task={taskForEdit ? { id: taskForEdit.id, title: taskForEdit.title, description: taskForEdit.description, due_date: taskForEdit.due_date ?? null } : null}
        open={taskOpen}
        onOpenChange={setTaskOpen}
        onSave={saveTaskEdit}
      />
    </main>
  );
};

export default Index;
