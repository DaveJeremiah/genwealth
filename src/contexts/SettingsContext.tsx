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
        // 1. Try to fetch from Supabase
        const { data, error } = await supabase
          .from("user_settings")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          // Found in DB
          setSettings({ 
            ...DEFAULT_SETTINGS, 
            ...data,
            greeting_style: (data.greeting_style === "formal" ? "formal" : "casual") as "casual" | "formal"
          });
          if (data.default_currency) {
            setDisplayCurrency(data.default_currency as any);
          }
        } else {
          // Not in DB, check if we have local settings to migrate
          const localKey = `wealthos_settings_${user.id}`;
          const localSaved = localStorage.getItem(localKey);
          
          let initialSettings = DEFAULT_SETTINGS;
          
          if (localSaved) {
            try {
              const parsed = JSON.parse(localSaved);
              initialSettings = { ...DEFAULT_SETTINGS, ...parsed };
            } catch (e) {
              console.warn("Failed to parse local settings during migration:", e);
            }
          } else {
            // No local settings, use defaults
            const baseNickname = user.email ? user.email.split("@")[0] : "User";
            initialSettings = {
              ...DEFAULT_SETTINGS,
              nickname: baseNickname.charAt(0).toUpperCase() + baseNickname.slice(1),
            };
          }

          // Create row in Supabase
          const { error: insertError } = await supabase
            .from("user_settings")
            .insert([{ ...initialSettings, user_id: user.id }]);

          if (insertError) {
            console.error("Failed to initialize remote settings:", insertError);
          }

          setSettings(initialSettings);
          if (initialSettings.default_currency) {
            setDisplayCurrency(initialSettings.default_currency as any);
          }
        }
      } catch (e) {
        console.error("Failed to load settings from Supabase:", e);
        toast.error("Cloud settings unavailable, using defaults.");
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [user, setDisplayCurrency]);

  const updateSettings = useCallback(async (updates: Partial<UserSettings>) => {
    if (!user) return false;
    
    // Optimistic UI update
    setSettings(prev => ({ ...prev, ...updates }));
    
    if (updates.default_currency) {
      setDisplayCurrency(updates.default_currency as any);
    }
    
    try {
      const { error } = await supabase
        .from("user_settings")
        .update(updates)
        .eq("user_id", user.id);

      if (error) throw error;
      
      // Also update local cache for faster next load
      const localKey = `wealthos_settings_${user.id}`;
      localStorage.setItem(localKey, JSON.stringify({ ...settings, ...updates }));
      
      return true;
    } catch (e) {
      console.error("Error updating settings on Supabase:", e);
      toast.error("Failed to sync settings to cloud");
      return false;
    }
  }, [user, setDisplayCurrency, settings]);

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
