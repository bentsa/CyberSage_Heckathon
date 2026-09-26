import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Shield } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — CyberSage MIP" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            data: { full_name: name },
            emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
          },
        });
        if (error) throw error;
        toast.success("Account created. You're signed in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Signed in.");
      }
      navigate({ to: "/", replace: true });
    } catch (err: any) {
      toast.error(err.message ?? "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  async function google() {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
      navigate({ to: "/", replace: true });
    } catch (err: any) {
      toast.error(err.message ?? "Google sign-in failed");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-6">
          <Shield className="h-7 w-7 text-cyber" />
          <span className="text-xl font-semibold tracking-tight">CyberSage MIP</span>
        </div>
        <div className="glass rounded-2xl p-6">
          <div className="flex gap-2 mb-6 bg-muted rounded-lg p-1">
            <button onClick={() => setMode("signin")} className={`flex-1 py-2 rounded-md text-sm font-medium ${mode === "signin" ? "bg-background shadow" : "text-muted-foreground"}`}>Sign in</button>
            <button onClick={() => setMode("signup")} className={`flex-1 py-2 rounded-md text-sm font-medium ${mode === "signup" ? "bg-background shadow" : "text-muted-foreground"}`}>Create account</button>
          </div>
          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" && (
              <input className="w-full bg-input rounded-md px-3 py-2 text-sm" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required />
            )}
            <input className="w-full bg-input rounded-md px-3 py-2 text-sm" placeholder="you@municipality.gov.za" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input className="w-full bg-input rounded-md px-3 py-2 text-sm" placeholder="Password (min 8 chars)" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button disabled={loading} className="w-full bg-cyber text-cyber-foreground font-medium rounded-md py-2 text-sm disabled:opacity-60">
              {loading ? "Working..." : mode === "signup" ? "Create account" : "Sign in"}
            </button>
          </form>
          <div className="my-4 text-center text-xs text-muted-foreground">or</div>
          <button onClick={google} disabled={loading} className="w-full border border-border rounded-md py-2 text-sm font-medium hover:bg-accent disabled:opacity-60">
            Continue with Google
          </button>
        </div>
        <div className="text-center mt-4 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">← Back to dashboard</Link>
        </div>
      </div>
    </div>
  );
}
