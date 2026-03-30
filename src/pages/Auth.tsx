import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { lovable } from "@/integrations/lovable/index";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp } from "lucide-react";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (error) throw error;
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setGoogleLoading(false);
    }
  };
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        await signIn(email, password);
      } else {
        await signUp(email, password);
        toast({ title: "Account created", description: "Check your email to confirm your account." });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-svh flex items-center justify-center bg-background px-4 font-body">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-3">
            <div className="w-10 h-10 rounded-2xl violet-gradient flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-display font-bold violet-text">Jenwealthy</h1>
          </div>
          <p className="text-sm" style={{ color: '#999' }}>
            Income is not wealth. Ownership is.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-6 space-y-5">
          <h2 className="text-xl font-display font-semibold text-foreground text-center">
            {isLogin ? "Welcome back" : "Create your account"}
          </h2>
          <div className="space-y-3">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-card border-border text-foreground placeholder:text-muted-foreground rounded-xl"
              required
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-card border-border text-foreground placeholder:text-muted-foreground rounded-xl"
              required
              minLength={6}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-full bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-50 transition-all hover:bg-violet-hover"
          >
            {loading ? "Loading..." : isLogin ? "Sign In" : "Sign Up"}
          </button>
          <p className="text-center text-sm text-muted-foreground">
            {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
            <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-primary hover:underline">
              {isLogin ? "Sign up" : "Sign in"}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Auth;
