import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export interface EditableTaskFields {
  title: string;
  description: string | null;
  due_date: string | null; // ISO date (YYYY-MM-DD) or null
}

interface EditTaskDialogProps {
  task: (EditableTaskFields & { id: string }) | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updates: EditableTaskFields) => Promise<void> | void;
}

const EditTaskDialog = ({ task, open, onOpenChange, onSave }: EditTaskDialogProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState<string>("");
  const [due, setDue] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(task?.title ?? "");
    setDescription(task?.description ?? "");
    setDue(task?.due_date ?? "");
  }, [task, open]);

  const handleSave = async () => {
    if (!task || !title.trim()) return;
    try {
      setSaving(true);
      await onSave({
        title: title.trim(),
        description: description.trim() ? description : null,
        due_date: due || null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm">Title</label>
            <Input
              autoFocus
              placeholder="Task title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm">Description</label>
            <Textarea
              placeholder="Add details..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm">Due date</label>
            <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!title.trim() || !task || saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditTaskDialog;
