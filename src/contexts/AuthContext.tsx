import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, nickname?: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Persists to Supabase user_metadata; empty string removes nickname (greeting falls back to email name). */
  updateNickname: (nickname: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      // Smart Sync: If we just signed in and have a pending nickname from the signup form
      if (event === "SIGNED_IN" && currentUser) {
        const pendingNickname = localStorage.getItem("wealthos_pending_nickname");
        if (pendingNickname) {
          console.log("Applying pending nickname from signup:", pendingNickname);
          
          // 1. Update User Metadata (Auth)
          await supabase.auth.updateUser({
            data: { nickname: pendingNickname }
          });

          // 2. Update/Upsert User Settings Table
          // Use upsert to handle both new and existing users
          await supabase.from("user_settings").upsert({
            user_id: currentUser.id,
            nickname: pendingNickname,
          }, { onConflict: 'user_id' });

          // 3. Clear the pending flag
          localStorage.removeItem("wealthos_pending_nickname");
          
          // 4. Force a refresh of settings if the provider is already loaded
          window.location.reload(); 
        }
      }
      
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, nickname?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: nickname ? { nickname: nickname.trim() } : undefined,
      },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const updateNickname = async (nickname: string) => {
    const trimmed = nickname.trim();
    const { data: { session: s } } = await supabase.auth.getSession();
    const prev = (s?.user?.user_metadata ?? {}) as Record<string, unknown>;
    const next: Record<string, unknown> = { ...prev, nickname: trimmed.length > 0 ? trimmed : null };
    const { error } = await supabase.auth.updateUser({ data: next });
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signIn, signUp, signOut, updateNickname }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
