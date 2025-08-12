import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export interface SimpleList {
  id: string;
  title: string;
}

interface RenameListDialogProps {
  list: SimpleList | null | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (newTitle: string) => Promise<void> | void;
}

const RenameListDialog = ({ list, open, onOpenChange, onSave }: RenameListDialogProps) => {
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(list?.title ?? "");
  }, [list, open]);

  const handleSave = async () => {
    if (!list || !title.trim()) return;
    try {
      setSaving(true);
      await onSave(title.trim());
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename List</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Input
            autoFocus
            placeholder="List title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
            }}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!title.trim() || !list || saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RenameListDialog;
