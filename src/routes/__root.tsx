import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  Outlet, Link, createRootRouteWithContext, useRouter, useRouterState,
  HeadContent, Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { Shield, Fingerprint, ScrollText, LogIn, LogOut, LayoutDashboard } from "lucide-react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Go home</Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "tanstack_root_error_component" }); }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button onClick={() => { router.invalidate(); reset(); }} className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Try again</button>
          <a href="/" className="inline-flex items-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent">Go home</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "CyberSage Municipal Integrity Platform" },
      { name: "description", content: "Governance, anti-corruption, identity verification and cyber-resilience operating system for South African municipalities." },
      { property: "og:title", content: "CyberSage MIP" },
      { property: "og:description", content: "Detect corruption, fraud and cyber threats before they happen." },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AppShell />
      <Toaster theme="dark" position="top-right" richColors />
    </QueryClientProvider>
  );
}

function AppShell() {
  const router = useRouter();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      setEmail(session?.user.email ?? null);
      router.invalidate();
      if (event !== "SIGNED_OUT") qc.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, qc]);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  const hideNav = pathname === "/auth";

  return (
    <>
      {!hideNav && (
        <nav className="sticky top-0 z-40 bg-background/80 backdrop-blur border-b border-border">
          <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link to="/" className="inline-flex items-center gap-2 font-semibold">
              <Shield className="h-5 w-5 text-cyber" /> CyberSage MIP
            </Link>
            <div className="hidden md:flex items-center gap-1 text-sm">
              <NavLink to="/" icon={LayoutDashboard} label="Dashboard" active={pathname === "/"} />
              <NavLink to="/identity" icon={Fingerprint} label="Identity" active={pathname.startsWith("/identity")} />
              <NavLink to="/audit" icon={ScrollText} label="Audit" active={pathname.startsWith("/audit")} />
            </div>
            <div className="flex items-center gap-3 text-sm">
              {email ? (
                <>
                  <span className="hidden sm:inline text-muted-foreground text-xs">{email}</span>
                  <button onClick={signOut} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-border hover:bg-accent text-xs">
                    <LogOut className="h-3.5 w-3.5" /> Sign out
                  </button>
                </>
              ) : (
                <Link to="/auth" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-cyber text-cyber-foreground text-xs font-medium">
                  <LogIn className="h-3.5 w-3.5" /> Sign in
                </Link>
              )}
            </div>
          </div>
        </nav>
      )}
      <Outlet />
    </>
  );
}

function NavLink({ to, icon: Icon, label, active }: any) {
  return (
    <Link to={to} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md ${active ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent/40"}`}>
      <Icon className="h-4 w-4" /> {label}
    </Link>
  );
}
