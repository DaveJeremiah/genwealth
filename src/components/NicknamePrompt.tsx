import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

/**
 * Shows a dialog prompting the user to set a nickname
 * when they sign in via OAuth and have no nickname set.
 */
const NicknamePrompt = () => {
  const { user, updateNickname } = useAuth();
  const { toast } = useToast();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const hasNickname =
    user?.user_metadata?.nickname != null &&
    String(user.user_metadata.nickname).trim() !== "";

  // Show only for authenticated users without a nickname
  const open = !!user && !hasNickname && !dismissed;

  const handleSave = async () => {
    if (!value.trim()) {
      toast({ title: "Please enter a nickname", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await updateNickname(value);
      toast({ title: "Nickname saved!" });
      setDismissed(true);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setDismissed(true); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">What should we call you?</DialogTitle>
          <DialogDescription>
            Pick a nickname — it'll be used in your greeting every time you open the app.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <Input
            placeholder="e.g. Jenny, Boss, Big G"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={30}
            className="bg-card border-border rounded-xl"
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 rounded-full bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-50 transition-all hover:bg-violet-hover"
          >
            {saving ? "Saving..." : "Save nickname"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NicknamePrompt;
