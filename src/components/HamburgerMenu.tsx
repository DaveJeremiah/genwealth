import { useState } from "react";
import { Activity, Home, Menu } from "lucide-react";
import { NavLink } from "react-router-dom";

import { ThemeModeToggle } from "@/components/ThemeModeToggle";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

type HamburgerMenuProps = {
  className?: string;
};

export function HamburgerMenu({ className }: HamburgerMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("md:hidden", className)}
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </Button>
      </SheetTrigger>

      <SheetContent side="left" className="w-[320px]">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between">
            <div className="text-sm font-display font-semibold text-foreground">Jenwealthy</div>
          </div>

          <nav className="mt-6 space-y-2">
            <NavLink
              to="/"
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  isActive && "bg-accent text-accent-foreground",
                )
              }
            >
              <Home className="w-4 h-4" />
              Home
            </NavLink>

            <NavLink
              to="/entries"
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  isActive && "bg-accent text-accent-foreground",
                )
              }
            >
              <Activity className="w-4 h-4" />
              Entries
            </NavLink>
          </nav>

          <div className="mt-6 pt-4 border-t border-border">
            <ThemeModeToggle label="Dark mode" />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

