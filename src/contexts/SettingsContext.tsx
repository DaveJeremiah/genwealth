import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "./CurrencyContext";
import { toast } from "sonner";

export type ProfileAccent = "#7C3AED" | "#4C8FC9" | "#4CC98F" | "#C94C4C" | "#C9A84C" | "#C94C8F";

export interface UserSettings {
  id?: string;
  user_id?: string;
  nickname: string;
  default_currency: string;
  greeting_style: "casual" | "formal";
  profile_accent: ProfileAccent | string;
  financial_year_start: number;
  default_account: string;
  show_wealth_score: boolean;
  fourth_stat_card: string;
  briefing_reminder: boolean;
  briefing_reminder_time: string;
  auto_generate_briefing: boolean;
}

const DEFAULT_SETTINGS: UserSettings = {
  nickname: "",
  default_currency: "UGX",
  greeting_style: "casual",
  profile_accent: "#7C3AED",
  financial_year_start: 1,
  default_account: "Bank",
  show_wealth_score: true,
  fourth_stat_card: "Total Assets",
  briefing_reminder: false,
  briefing_reminder_time: "08:00",
  auto_generate_briefing: false,
};

interface SettingsContextType {
  settings: UserSettings;
  updateSettings: (updates: Partial<UserSettings>) => Promise<boolean>;
  loading: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const ACCENT_HSL_MAP: Record<string, string> = {
  "#7C3AED": "263 83% 58%", // violet (default)
  "#4C8FC9": "208 55% 54%", // blue
  "#4CC98F": "152 55% 54%", // green
  "#C94C4C": "0 55% 54%",   // red
  "#C9A84C": "44 55% 54%",  // amber
  "#C94C8F": "328 55% 54%", // pink
};

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { setDisplayCurrency } = useCurrency();
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  // Apply accent color to document root
  useEffect(() => {
    const hsl = ACCENT_HSL_MAP[settings.profile_accent] || ACCENT_HSL_MAP["#7C3AED"];
    const root = document.documentElement;
    
    // Core Tailwind colors mapped in index.css
    root.style.setProperty("--primary", hsl);
    root.style.setProperty("--ring", hsl);
    root.style.setProperty("--violet", hsl);
    root.style.setProperty("--violet-glow", hsl);
    
    // Calculate a hover version (roughly slightly lighter/more saturated)
    // We can just rely on standard tailwind classes or do a manual adjustment if needed.
    // For simplicity, we just use the same HSL for primary but maybe higher lightness for hover if we wanted.
    // But since the CSS defines --violet-hover manually, we can set it to a slightly higher lightness.
    const [h, s, l] = hsl.split(" ").map(v => parseFloat(v));
    root.style.setProperty("--violet-hover", `${h} ${s}% ${Math.min(l + 8, 100)}%`);

  }, [settings.profile_accent]);

  useEffect(() => {
    const loadSettings = async () => {
      if (!user) {
        setSettings(DEFAULT_SETTINGS);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const key = `wealthos_settings_${user.id}`;
        const saved = localStorage.getItem(key);

        if (saved) {
          const parsed = JSON.parse(saved);
          const loadedSettings = {
            ...DEFAULT_SETTINGS,
            ...parsed,
          };
          setSettings(loadedSettings);
          setDisplayCurrency(loadedSettings.default_currency as "UGX" | "USD" | "EUR" | "GBP" | "KES");
        } else {
          // Create default row for user using email as base nickname default
          const baseNickname = user.email ? user.email.split("@")[0] : "there";
          const newSettings = {
            ...DEFAULT_SETTINGS,
            nickname: baseNickname.charAt(0).toUpperCase() + baseNickname.slice(1),
            user_id: user.id
          };
          
          localStorage.setItem(key, JSON.stringify(newSettings));
          setSettings(newSettings as unknown as UserSettings);
          setDisplayCurrency(newSettings.default_currency as "UGX" | "USD" | "EUR" | "GBP" | "KES");
        }
      } catch (e) {
        console.error("Failed to load settings:", e);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [user]); // We do NOT put setDisplayCurrency in dependency array

  const updateSettings = useCallback(async (updates: Partial<UserSettings>) => {
    if (!user) return false;
    
    // Optimistic update
    setSettings(prev => ({ ...prev, ...updates }));
    
    if (updates.default_currency) {
      setDisplayCurrency(updates.default_currency as "UGX" | "USD" | "EUR" | "GBP" | "KES");
    }
    
    try {
      const key = `wealthos_settings_${user.id}`;
      // Get latest state directly rather than assuming `settings` is fresh to avoid race condition
      const currentSavedStr = localStorage.getItem(key);
      const currentSaved = currentSavedStr ? JSON.parse(currentSavedStr) : DEFAULT_SETTINGS;
      const newSaved = { ...currentSaved, ...updates };

      localStorage.setItem(key, JSON.stringify(newSaved));
      return true;
    } catch (e) {
      console.error("Error updating settings:", e);
      toast.error("Failed to save settings locally");
      return false;
    }
  }, [user, setDisplayCurrency]);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, loading }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
};
