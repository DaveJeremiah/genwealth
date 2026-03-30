import { useState, useMemo } from "react";
import { MoreVertical, Check, Circle, CheckCircle2 } from "lucide-react";
import { useWishList, type WishListItem, type WishPriority } from "@/hooks/useWishList";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

const CURRENCIES = ["UGX", "USD", "EUR", "GBP", "ETH", "BTC"] as const;
const CATEGORIES = [
  "Housing",
  "Shopping",
  "Transport",
  "Health",
  "Electronics",
  "Entertainment",
  "Investments",
  "Other",
] as const;

const PRIORITIES: { value: WishPriority; label: string }[] = [
  { value: "need_it", label: "Need it" },
  { value: "want_it", label: "Want it" },
  { value: "nice_to_have", label: "Nice to have" },
];

const PRIORITY_ORDER: Record<WishPriority, number> = {
  need_it: 0,
  want_it: 1,
  nice_to_have: 2,
};

function priorityLabel(p: string) {
  return PRIORITIES.find((x) => x.value === p)?.label ?? p;
}

const WishListPanel = () => {
  const { formatUGX, formatOriginal } = useCurrency();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: items = [], isLoading, insertItem, updateItem, deleteItem, markPurchased, isOnline } = useWishList();

  const unmarkPurchased = async (id: string) => {
    await supabase
      .from("wish_list_items")
      .update({ purchased: false, actual_amount_paid: null, actual_currency: null, actual_ugx_amount: null, purchase_date: null, updated_at: new Date().toISOString() })
      .eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["wish-list", user?.id] });
  };

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<WishListItem | null>(null);
  const [purchaseItem, setPurchaseItem] = useState<WishListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WishListItem | null>(null);

  const [itemName, setItemName] = useState("");
  const [itemDesc, setItemDesc] = useState("");
  const [estPrice, setEstPrice] = useState("");
  const [currency, setCurrency] = useState<string>("UGX");
  const [category, setCategory] = useState<string>("Other");
  const [priority, setPriority] = useState<WishPriority>("want_it");
  const [targetDate, setTargetDate] = useState("");

  const [actualPaid, setActualPaid] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().split("T")[0]);

  const resetForm = () => {
    setItemName("");
    setItemDesc("");
    setEstPrice("");
    setCurrency("UGX");
    setCategory("Other");
    setPriority("want_it");
    setTargetDate("");
    setEditing(null);
  };

  const openAdd = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEdit = (item: WishListItem) => {
    setEditing(item);
    setItemName(item.item_name);
    setItemDesc(item.description ?? "");
    setEstPrice(String(item.estimated_price));
    setCurrency(item.currency);
    setCategory(item.category);
    setPriority(item.priority as WishPriority);
    setTargetDate(item.target_date ?? "");
    setFormOpen(true);
  };

  const submitForm = async () => {
    const price = parseFloat(estPrice);
    if (!itemName.trim() || isNaN(price) || price <= 0) return;
    const payload = {
      item_name: itemName.trim(),
      description: itemDesc.trim(),
      estimated_price: price,
      currency,
      category,
      priority,
      target_date: targetDate || null,
    };
    if (editing) {
      await updateItem.mutateAsync({ id: editing.id, ...payload });
    } else {
      await insertItem.mutateAsync(payload);
    }
    setFormOpen(false);
    resetForm();
  };

  const openPurchase = (item: WishListItem) => {
    setPurchaseItem(item);
    setActualPaid(String(item.estimated_price));
    setPurchaseDate(new Date().toISOString().split("T")[0]);
  };

  const confirmPurchase = async () => {
    if (!purchaseItem) return;
    const amt = parseFloat(actualPaid);
    if (isNaN(amt) || amt <= 0) return;
    await markPurchased.mutateAsync({
      id: purchaseItem.id,
      item_name: purchaseItem.item_name,
      category: purchaseItem.category,
      actual_amount_paid: amt,
      actual_currency: purchaseItem.currency,
      purchase_date: purchaseDate,
    });
    setPurchaseItem(null);
  };

  const { active, purchased } = useMemo(() => {
    const a: WishListItem[] = [];
    const p: WishListItem[] = [];
    for (const it of items) {
      if (it.purchased) p.push(it);
      else a.push(it);
    }
    a.sort((x, y) => PRIORITY_ORDER[x.priority as WishPriority] - PRIORITY_ORDER[y.priority as WishPriority]);
    p.sort((x, y) => (y.purchase_date ?? "").localeCompare(x.purchase_date ?? ""));
    return { active: a, purchased: p };
  }, [items]);

  if (!isOnline) {
    return (
      <p className="text-sm text-muted-foreground italic py-6 text-center">
        Connect to the internet to view and edit your wish list.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          type="button"
          onClick={openAdd}
          className="rounded-full bg-primary text-primary-foreground hover:bg-violet-hover px-5"
        >
          Add
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!isLoading && items.length === 0 && (
        <p className="text-sm text-muted-foreground italic text-center py-10">
          Nothing on the list yet. Add something you&apos;re working toward.
        </p>
      )}

      {active.length > 0 && (
        <div className="space-y-3">
          {active.map((item) => (
            <div
              key={item.id}
              className="glass-card rounded-2xl p-4 border border-border relative"
              style={{ borderWidth: "0.5px" }}
            >
              <div className="flex items-start gap-3">
                {/* Circular check button */}
                <button
                  type="button"
                  onClick={() => openPurchase(item)}
                  className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors"
                  aria-label="Mark as purchased"
                >
                  <Circle className="w-5 h-5" />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate text-foreground">
                    {item.item_name}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-card border border-border text-muted-foreground">
                      {item.category}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-violet-hover border border-primary/20">
                      {priorityLabel(item.priority)}
                    </span>
                  </div>
                  {item.target_date && (
                    <p className="text-[10px] text-muted-foreground mt-2">Target: {item.target_date}</p>
                  )}
                </div>
                <div className="text-right shrink-0 pr-6">
                  <p className="text-sm font-display font-semibold text-violet-hover">
                    {formatUGX(item.estimated_ugx_amount)}
                  </p>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="absolute top-3 right-3 p-1 rounded-md text-muted-foreground hover:text-foreground"
                    aria-label="Menu"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-popover border-border">
                  <DropdownMenuItem onClick={() => openEdit(item)}>Edit</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openPurchase(item)}>Mark as Purchased</DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteTarget(item)}>
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      )}

      {purchased.length > 0 && (
        <>
          {(active.length > 0 || items.length > 0) && (
            <div className="pt-2 pb-1">
              <div className="border-t border-border opacity-60" style={{ borderTopWidth: "0.5px" }} />
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mt-3">Purchased</p>
            </div>
          )}
          <div className="space-y-3 opacity-80">
            {purchased.map((item) => (
              <div
                key={item.id}
                className="glass-card rounded-2xl p-4 border border-border relative"
                style={{ borderWidth: "0.5px" }}
              >
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      // Unmark: update purchased back to false
                      updateItem.mutate({ id: item.id, purchased: false, actual_amount_paid: null, actual_currency: null, actual_ugx_amount: null, purchase_date: null });
                    }}
                    className="mt-0.5 shrink-0 text-primary hover:text-primary/70 transition-colors"
                    aria-label="Unmark as purchased"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate text-muted-foreground line-through">
                      {item.item_name}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      <span className="text-[10px]" style={{ color: "#444" }}>
                        {item.category}
                      </span>
                      <span className="text-[10px]" style={{ color: "#444" }}>
                        · {priorityLabel(item.priority)}
                      </span>
                    </div>
                    {item.purchase_date && (
                      <p className="text-[10px] mt-1" style={{ color: "#444" }}>
                        Bought {item.purchase_date}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0 pr-6">
                    <p className="text-sm font-display font-semibold text-muted-foreground">
                      {item.actual_ugx_amount != null ? formatUGX(item.actual_ugx_amount) : "—"}
                    </p>
                    {item.actual_amount_paid != null && (
                      <p className="text-[10px]" style={{ color: "#444" }}>
                        {formatOriginal(item.actual_amount_paid, item.actual_currency ?? item.currency)}
                      </p>
                    )}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="absolute top-3 right-3 p-1 rounded-md hover:opacity-80"
                      style={{ color: "#444" }}
                      aria-label="Menu"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-popover border-border">
                    <DropdownMenuItem onClick={() => openEdit(item)}>Edit</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteTarget(item)}>
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        </>
      )}

      <Sheet open={formOpen} onOpenChange={(o) => { if (!o) { setFormOpen(false); resetForm(); } }}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[90vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-display">{editing ? "Edit wish" : "Add to wish list"}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 pt-4 pb-8">
            <div className="space-y-2">
              <Label htmlFor="wl-name">Item name</Label>
              <Input id="wl-name" value={itemName} onChange={(e) => setItemName(e.target.value)} className="bg-card" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wl-desc">Description (optional)</Label>
              <Textarea id="wl-desc" value={itemDesc} onChange={(e) => setItemDesc(e.target.value)} className="bg-card min-h-[72px]" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="wl-price">Estimated price</Label>
                <Input
                  id="wl-price"
                  type="number"
                  min={0}
                  step="any"
                  value={estPrice}
                  onChange={(e) => setEstPrice(e.target.value)}
                  className="bg-card"
                />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="bg-card"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="bg-card"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <div className="flex flex-wrap gap-2">
                {PRIORITIES.map((pr) => (
                  <button
                    key={pr.value}
                    type="button"
                    onClick={() => setPriority(pr.value)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                      priority === pr.value
                        ? "bg-primary/20 border-primary text-violet-hover"
                        : "bg-card border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {pr.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wl-target">Target date (optional)</Label>
              <Input id="wl-target" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="bg-card" />
            </div>
            <Button
              type="button"
              className="w-full rounded-full bg-primary hover:bg-violet-hover"
              disabled={!itemName.trim() || !estPrice || updateItem.isPending || insertItem.isPending}
              onClick={submitForm}
            >
              {editing ? "Save changes" : "Add item"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={!!purchaseItem} onOpenChange={(o) => { if (!o) setPurchaseItem(null); }}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[90vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-display">Did you buy this?</SheetTitle>
          </SheetHeader>
          {purchaseItem && (
            <div className="space-y-4 pt-4 pb-8">
              <p className="text-sm text-foreground font-medium">{purchaseItem.item_name}</p>
              <p className="text-sm text-muted-foreground">
                Estimated: {formatUGX(purchaseItem.estimated_ugx_amount)} ({formatOriginal(purchaseItem.estimated_price, purchaseItem.currency)})
              </p>
              <div className="space-y-2">
                <Label htmlFor="wl-actual">Actual amount paid</Label>
                <Input
                  id="wl-actual"
                  type="number"
                  min={0}
                  step="any"
                  value={actualPaid}
                  onChange={(e) => setActualPaid(e.target.value)}
                  className="bg-card"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wl-pdate">Date</Label>
                <Input id="wl-pdate" type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className="bg-card" />
              </div>
              <Button
                type="button"
                className="w-full rounded-full bg-primary hover:bg-violet-hover"
                disabled={markPurchased.isPending}
                onClick={confirmPurchase}
              >
                Yes, I bought it
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this item?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.item_name} will be removed from your wish list. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) deleteItem.mutate(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default WishListPanel;
