import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

import { Switch } from "@/components/ui/switch";

export function ThemeModeToggle({ label = "Dark mode" }: { label?: string }) {
  const { resolvedTheme, setTheme, theme } = useTheme();

  const isDark = resolvedTheme === "dark" || theme === "dark";

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        {isDark ? <Moon className="w-4 h-4 text-muted-foreground" /> : <Sun className="w-4 h-4 text-muted-foreground" />}
        <span className="text-sm text-foreground">{label}</span>
      </div>

      <Switch
        checked={isDark}
        onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
        aria-label={label}
      />
    </div>
  );
}

