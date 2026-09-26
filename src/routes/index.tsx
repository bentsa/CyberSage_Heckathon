import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Shield, ShieldCheck, ShieldAlert, AlertTriangle, Activity, Network, Users, Building2,
  FileSearch, Banknote, Lock, Eye, Radar,
  TrendingUp, TrendingDown, CircleDot, Globe2, KeyRound,
  Gauge, ScanLine, Server, ChevronRight, Power, Filter, Search, ListChecks, Workflow,
  Loader2, ScrollText,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line, BarChart, Bar,
  RadialBarChart, RadialBar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { toast } from "sonner";
import { IntegrityGate } from "@/components/IntegrityGate";
import { logInsiderCase, logCyberEvent, getOverviewMetrics } from "@/lib/integrity.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CyberSage MIP — Municipal Integrity Platform" },
      { name: "description", content: "Governance, anti-corruption and cyber-resilience operating system for South African municipalities." },
      { property: "og:title", content: "CyberSage Municipal Integrity Platform" },
      { property: "og:description", content: "Detect corruption, fraud and cyber threats before they happen." },
    ],
  }),
  component: Dashboard,
});

/* ---------------- Mock data ---------------- */

const riskTrend = Array.from({ length: 24 }, (_, i) => ({
  h: `${i}:00`,
  integrity: 70 + Math.round(Math.sin(i / 3) * 8 + (i % 5)),
  threats: 20 + Math.round(Math.abs(Math.cos(i / 2)) * 30 + (i % 7) * 2),
  procurement: 40 + Math.round(Math.sin(i / 4) * 12 + (i % 3) * 3),
}));

const corruptionRisks = [
  { name: "Tender MM-2031 — Roadworks", dept: "Infrastructure", score: 92, signals: ["Single-bidder", "Director-supplier link", "Price anomaly"] },
  { name: "Payroll cycle Nov-W4", dept: "HR / Finance", score: 78, signals: ["3 ghost-employee patterns", "Banking overlap"] },
  { name: "Tender MM-1987 — Sanitation", dept: "Community Services", score: 71, signals: ["Split-PO pattern", "Late scope change"] },
  { name: "Fleet fuel cards (Region 4)", dept: "Operations", score: 64, signals: ["After-hours usage", "Geo mismatch"] },
  { name: "IT consulting SOW-220", dept: "ICT", score: 58, signals: ["Vendor newly registered", "No SLA"] },
];

const insiderEvents = [
  { user: "t.mokoena@mun.gov.za", action: "Bulk-exported payroll CSV", risk: "High", time: "2m" },
  { user: "n.dlamini@mun.gov.za", action: "Accessed sealed-tender vault", risk: "Critical", time: "6m" },
  { user: "svc-backup", action: "Login from new ASN (Lagos)", risk: "High", time: "12m" },
  { user: "k.naidoo@mun.gov.za", action: "Privilege escalation requested", risk: "Medium", time: "21m" },
  { user: "a.vanwyk@mun.gov.za", action: "Approved own invoice", risk: "Critical", time: "34m" },
];

const cyberFeed = [
  { kind: "BLOCK", target: "tracker.adnxs-cybersage-spoof.io", rule: "cybershield/anomaly-12", t: "now" },
  { kind: "BLOCK", target: "exfil-c2.dyn.example.cn", rule: "DNS-tunnel heuristic", t: "1s" },
  { kind: "ALLOW", target: "sars.gov.za", rule: "Trust-allowlist", t: "2s" },
  { kind: "QUARANTINE", target: "invoice_oct.xlsm", rule: "Macro+exfil pattern", t: "4s" },
  { kind: "BLOCK", target: "ads.malv-net.click", rule: "Reputation -97", t: "5s" },
  { kind: "BLOCK", target: "phish-municipality-sa.top", rule: "Lookalike domain", t: "7s" },
  { kind: "BLOCK", target: "miner.coinhive.alt", rule: "Cryptojacking sig", t: "9s" },
];

const departments = [
  { name: "Infrastructure", integrity: 62, fill: "var(--destructive)" },
  { name: "Finance", integrity: 74, fill: "var(--warning)" },
  { name: "HR", integrity: 81, fill: "var(--cyber)" },
  { name: "ICT", integrity: 88, fill: "var(--success)" },
  { name: "Community Svc", integrity: 69, fill: "var(--warning)" },
];

const procurementFlow = [
  { stage: "Bid Open", count: 142 },
  { stage: "Evaluation", count: 96 },
  { stage: "Flagged", count: 23 },
  { stage: "Awarded", count: 71 },
  { stage: "Contracted", count: 64 },
  { stage: "Audited", count: 58 },
];

const relationshipNodes = [
  { id: "Dept: Infrastructure", x: 18, y: 30, type: "dept" },
  { id: "Supplier: Khanya Civils", x: 48, y: 18, type: "supplier", risk: true },
  { id: "Employee: T. Mokoena", x: 78, y: 28, type: "emp", risk: true },
  { id: "Tender: MM-2031", x: 32, y: 58, type: "tender", risk: true },
  { id: "Bank: A/C 60****12", x: 64, y: 70, type: "bank" },
  { id: "Director: J. Sibeko", x: 86, y: 60, type: "person" },
  { id: "Project: N12 Resurface", x: 20, y: 80, type: "project" },
];
const relationshipEdges: [number, number, boolean?][] = [
  [0, 3], [3, 1, true], [1, 5, true], [5, 2, true], [2, 4, true], [3, 6], [1, 4, true],
];

/* ---------------- Helpers ---------------- */

function Stat({
  icon: Icon, label, value, delta, tone = "cyber",
}: { icon: any; label: string; value: string; delta?: string; tone?: "cyber" | "warning" | "success" | "destructive" }) {
  const toneClass =
    tone === "warning" ? "text-warning" : tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "text-cyber";
  return (
    <div className="glass rounded-xl p-4 relative overflow-hidden">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${toneClass}`} />
      </div>
      <div className="mt-2 flex items-end justify-between">
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
        {delta && (
          <div className={`text-xs ${delta.startsWith("-") ? "text-success" : "text-warning"} flex items-center gap-1`}>
            {delta.startsWith("-") ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
            {delta}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, sub }: { icon: any; title: string; sub?: string }) {
  return (
    <div className="flex items-start justify-between mb-3">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-md grid place-items-center bg-cyber/10 text-cyber border border-cyber/30">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

function RiskBadge({ score }: { score: number }) {
  const tone = score >= 80 ? "destructive" : score >= 65 ? "warning" : "success";
  const map = { destructive: "bg-destructive/15 text-destructive border-destructive/40", warning: "bg-warning/10 text-warning border-warning/40", success: "bg-success/10 text-success border-success/40" } as const;
  return <span className={`text-[10px] px-2 py-0.5 rounded-full border font-mono ${map[tone as keyof typeof map]}`}>{score}</span>;
}

/* ---------------- Modules ---------------- */

const MODULES = [
  { id: "overview", label: "Operations", icon: null },
  { id: "verify", label: "Integrity Gate", icon: null },
  { id: "corruption", label: "Corruption Prediction", icon: null },
  { id: "procurement", label: "Procurement", icon: null },
  { id: "cyber", label: "CyberShield", icon: null },
  { id: "network", label: "Relationship Network", icon: null },
  { id: "transparency", label: "Public Transparency", icon: null },
] as const;
type ModuleId = typeof MODULES[number]["id"];

function useAuthEmail() {
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setEmail(s?.user.email ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);
  return email;
}

function Dashboard() {
  const [active, setActive] = useState<ModuleId>("overview");
  const [shieldOn, setShieldOn] = useState(true);
  const [blocked, setBlocked] = useState(48213);

  useEffect(() => {
    if (!shieldOn) return;
    const t = setInterval(() => setBlocked((b) => b + Math.floor(Math.random() * 5) + 1), 1400);
    return () => clearInterval(t);
  }, [shieldOn]);

  return (
    <div className="min-h-screen text-foreground">
      <TopBar shieldOn={shieldOn} setShieldOn={setShieldOn} blocked={blocked} />
      <div className="mx-auto max-w-[1480px] grid grid-cols-12 gap-4 p-4">
        <SideNav active={active} setActive={setActive} />
        <main className="col-span-12 lg:col-span-10 space-y-4">
          <Header active={active} />
          {active === "overview" && <Overview setActive={setActive} />}
          {active === "verify" && <IntegrityGate />}
          {active === "corruption" && <CorruptionEngine />}
          {active === "procurement" && <Procurement />}
          {active === "cyber" && (
            <div className="space-y-4">
              <CyberShield shieldOn={shieldOn} setShieldOn={setShieldOn} blocked={blocked} />
              <Insider />
            </div>
          )}
          {active === "network" && <RelationshipNetwork />}
          {active === "transparency" && <Transparency />}
        </main>
      </div>
      <footer className="mx-auto max-w-[1480px] px-4 pb-6 text-[11px] text-muted-foreground flex items-center justify-between">
        <span className="font-mono">v1.0.0 · region: ZA-GP · node: mip-edge-03</span>
      </footer>
    </div>
  );
}

/* --------------- Top bar / Sidebar / Header --------------- */

function TopBar({ shieldOn, setShieldOn, blocked }: { shieldOn: boolean; setShieldOn: (v: boolean) => void; blocked: number }) {
  return (
    <div className="sticky top-0 z-30 backdrop-blur-md bg-background/70 border-b border-border">
      <div className="mx-auto max-w-[1480px] px-4 h-14 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="relative h-8 w-8 rounded-md bg-gradient-to-br from-cyber to-accent grid place-items-center">
            <ShieldCheck className="h-4 w-4 text-background" />
            <span className="absolute -right-1 -top-1 h-2 w-2 bg-success rounded-full pulse-dot" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">CyberSage <span className="text-cyber">MIP</span></div>
            <div className="text-[10px] text-muted-foreground">Municipal Integrity Operating System</div>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2 ml-4 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-success pulse-dot" />
          All sensors online
          <span className="opacity-40">·</span>
          <span className="font-mono">SOC-ZA · 14 municipalities</span>
        </div>

        <div className="flex-1" />

        <div className="hidden md:flex items-center gap-2 px-3 h-9 rounded-md glass w-72">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input className="bg-transparent outline-none text-sm flex-1 placeholder:text-muted-foreground" placeholder="Search tenders, employees, IOCs…" />
          <kbd className="text-[10px] font-mono text-muted-foreground border border-border rounded px-1.5 py-0.5">⌘K</kbd>
        </div>

        <button
          onClick={() => setShieldOn(!shieldOn)}
          className={`h-9 px-3 rounded-md text-xs font-medium flex items-center gap-2 border transition ${
            shieldOn ? "bg-cyber/15 text-cyber border-cyber/40 glow-cyber" : "bg-muted text-muted-foreground border-border"
          }`}
        >
          <Power className="h-3.5 w-3.5" /> CyberShield {shieldOn ? "ON" : "OFF"}
          <span className="font-mono text-[10px] opacity-80">· {blocked.toLocaleString()} blocked</span>
        </button>
      </div>
    </div>
  );
}

function SideNav({ active, setActive }: { active: ModuleId; setActive: (m: ModuleId) => void }) {
  return (
    <aside className="hidden lg:block col-span-2">
      <nav className="glass rounded-xl p-2 sticky top-[72px]">
        {MODULES.map((m) => {
          const Icon = m.icon;
          const on = active === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setActive(m.id)}
              className={`w-full text-left px-3 py-2 rounded-md flex items-center gap-2 text-sm transition mb-0.5 ${
                on ? "bg-cyber/15 text-cyber border border-cyber/30" : "text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-transparent"
              }`}
            >
              {Icon && <Icon className="h-4 w-4" />}
              <span className="flex-1">{m.label}</span>
              {on && <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

function Header({ active }: { active: ModuleId }) {
  const mod = MODULES.find((m) => m.id === active)!;
  const Icon = mod.icon;
  return (
    <div className="glass rounded-xl p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="h-10 w-10 rounded-md grid place-items-center bg-cyber/15 text-cyber border border-cyber/30">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div>
          <h1 className="text-lg font-semibold">{mod.label}</h1>
          <p className="text-xs text-muted-foreground">
            Live telemetry · Integrity, anti-corruption and cyber-resilience signals
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className="px-2 py-1 rounded-md bg-success/10 text-success border border-success/30 flex items-center gap-1"><CircleDot className="h-3 w-3" /> Healthy</span>
        <span className="px-2 py-1 rounded-md bg-muted text-muted-foreground border border-border font-mono">SLA 99.97%</span>
      </div>
    </div>
  );
}

/* --------------- Overview --------------- */

function Overview({ setActive }: { setActive: (m: ModuleId) => void }) {
  const email = useAuthEmail();
  const metricsFn = useServerFn(getOverviewMetrics);
  const { data: live } = useQuery({
    queryKey: ["overview-metrics", email],
    queryFn: () => metricsFn(),
    enabled: !!email,
    refetchInterval: 15000,
  });

  const integrity = live ? live.integrityIndex.toFixed(1) : "74.2";
  const activeRisks = live ? String(live.counts.review + live.counts.blocked) : "38";
  const blockedCount = live ? String(live.counts.blocked + live.counts.tenderBlocked) : "12";
  const safeguarded = live
    ? `R ${(live.safeguarded / 1_000_000).toFixed(1)}`
    : "R 184.6";

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={Gauge} label="Integrity Index" value={integrity} delta={live ? undefined : "+1.3"} tone="cyber" />
        <Stat icon={AlertTriangle} label="Active Risks" value={activeRisks} delta={live ? undefined : "-4"} tone="warning" />
        <Stat icon={ShieldAlert} label="Blocked / DLP" value={blockedCount} delta={live ? undefined : "+2"} tone="destructive" />
        <Stat icon={Banknote} label="Funds Safeguarded (M)" value={safeguarded} delta={live ? undefined : "-2.1"} tone="success" />
      </div>

      <div className="glass rounded-xl p-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground mr-1">Quick gates:</span>
        <button onClick={() => setActive("verify")} className="px-2.5 py-1 rounded-md border border-cyber/40 bg-cyber/10 text-cyber hover:bg-cyber/15">Verify invoice</button>
        <button onClick={() => setActive("verify")} className="px-2.5 py-1 rounded-md border border-cyber/40 bg-cyber/10 text-cyber hover:bg-cyber/15">Check appointment</button>
        <button onClick={() => setActive("verify")} className="px-2.5 py-1 rounded-md border border-cyber/40 bg-cyber/10 text-cyber hover:bg-cyber/15">Tender leak guard</button>
        <button onClick={() => setActive("verify")} className="px-2.5 py-1 rounded-md border border-cyber/40 bg-cyber/10 text-cyber hover:bg-cyber/15">Vendor & funds gate</button>
      </div>

      {live && live.recent.length > 0 && (
        <div className="glass rounded-xl p-4">
          <SectionTitle icon={ScrollText} title="Recent Integrity Activity" sub="Live audit stream from your tenant" />
          <ul className="text-xs space-y-1 max-h-56 overflow-auto">
            {live.recent.map((r: any, i: number) => (
              <li key={i} className="flex items-center justify-between border-b border-border py-1.5">
                <span className="font-mono text-muted-foreground">{new Date(r.created_at).toLocaleTimeString()}</span>
                <span className="flex-1 px-2 truncate">{r.action} · <span className="text-foreground">{r.entity_id}</span></span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] border ${
                  r.outcome === "blocked" ? "bg-destructive/15 text-destructive border-destructive/40" :
                  r.outcome === "review" ? "bg-warning/15 text-warning border-warning/40" :
                  "bg-success/15 text-success border-success/40"
                }`}>{r.outcome}</span>
              </li>
            ))}
          </ul>
        </div>
      )}



      <div className="grid grid-cols-12 gap-3">
        <div className="glass rounded-xl p-4 col-span-12 lg:col-span-8">
          <SectionTitle icon={Activity} title="24h Integrity & Threat Telemetry" sub="Composite signals across procurement, payroll, identity, and network" />
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={riskTrend}>
                <defs>
                  <linearGradient id="g1" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--cyber)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--cyber)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="g2" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--destructive)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--destructive)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="g3" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--panel-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="h" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--panel-border)", borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="integrity" stroke="var(--cyber)" fill="url(#g1)" strokeWidth={2} />
                <Area type="monotone" dataKey="threats" stroke="var(--destructive)" fill="url(#g2)" strokeWidth={2} />
                <Area type="monotone" dataKey="procurement" stroke="var(--accent)" fill="url(#g3)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass rounded-xl p-4 col-span-12 lg:col-span-4">
          <SectionTitle icon={Building2} title="Department Integrity" sub="Lower = higher corruption risk" />
          <div className="h-64">
            <ResponsiveContainer>
              <RadialBarChart innerRadius="30%" outerRadius="100%" data={departments} startAngle={90} endAngle={-270}>
                <RadialBar dataKey="integrity" cornerRadius={6} background={{ fill: "var(--muted)" }} />
                <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--panel-border)", borderRadius: 8, fontSize: 12 }} />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-1 text-[11px]">
            {departments.map((d) => (
              <div key={d.name} className="flex items-center justify-between">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: d.fill }} /> {d.name}</span>
                <span className="font-mono">{d.integrity}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-3">
        <div className="glass rounded-xl p-4 col-span-12 lg:col-span-7">
          <SectionTitle icon={TrendingUp} title="Corruption Prediction — Top Risks" sub="Predicted before losses occur" />
          <RiskList />
        </div>
        <div className="glass rounded-xl p-4 col-span-12 lg:col-span-5">
          <SectionTitle icon={Shield} title="CyberShield Live Feed" sub="Automated blocking of trackers, exfil & malicious calls" />
          <Ticker />
        </div>
      </div>
    </>
  );
}

function RiskList() {
  return (
    <div className="space-y-2">
      {corruptionRisks.map((r) => (
        <div key={r.name} className="rounded-lg border border-border p-3 hover:border-cyber/40 transition">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">{r.name}</div>
              <div className="text-[11px] text-muted-foreground">{r.dept}</div>
            </div>
            <RiskBadge score={r.score} />
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {r.signals.map((s) => (
              <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border font-mono">{s}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Ticker() {
  const [items, setItems] = useState(cyberFeed);
  useEffect(() => {
    const t = setInterval(() => {
      setItems((arr) => {
        const next = [...arr];
        const moved = next.pop()!;
        next.unshift({ ...moved, t: "now" });
        return next;
      });
    }, 1200);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="space-y-1.5 max-h-72 overflow-hidden">
      {items.map((e, i) => (
        <div key={i} className="flex items-center gap-2 text-xs font-mono border border-border rounded-md px-2 py-1.5 bg-background/40">
          <span className={`px-1.5 py-0.5 rounded text-[10px] ${
            e.kind === "BLOCK" ? "bg-destructive/15 text-destructive" :
            e.kind === "QUARANTINE" ? "bg-warning/15 text-warning" :
            "bg-success/15 text-success"
          }`}>{e.kind}</span>
          <span className="truncate flex-1">{e.target}</span>
          <span className="text-muted-foreground hidden md:inline">{e.rule}</span>
          <span className="text-muted-foreground">{e.t}</span>
        </div>
      ))}
    </div>
  );
}

/* --------------- Corruption Prediction Engine --------------- */

function CorruptionEngine() {
  return (
    <div className="grid grid-cols-12 gap-3">
      <div className="glass rounded-xl p-4 col-span-12 lg:col-span-8">
        <SectionTitle icon={TrendingUp} title="Corruption Prediction Engine" sub="ML scores tenders, payroll cycles, fleet ops, and SOWs before losses occur" />
        <RiskList />
      </div>
      <div className="space-y-3 col-span-12 lg:col-span-4">
        <div className="glass rounded-xl p-4">
          <SectionTitle icon={ListChecks} title="Model Signals" />
          <ul className="text-xs space-y-1.5">
            {[
              ["Single-bidder anomaly", 0.93],
              ["Director ↔ supplier graph hop", 0.88],
              ["Price deviation from corridor", 0.81],
              ["Split-PO under threshold", 0.77],
              ["After-hours approval", 0.62],
              ["Late scope change", 0.58],
            ].map(([k, v]) => (
              <li key={k as string}>
                <div className="flex justify-between"><span>{k}</span><span className="font-mono text-muted-foreground">{(v as number).toFixed(2)}</span></div>
                <div className="h-1.5 mt-1 rounded bg-muted overflow-hidden"><div className="h-full bg-cyber" style={{ width: `${(v as number) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* --------------- Procurement --------------- */

function Procurement() {
  return (
    <div className="grid grid-cols-12 gap-3">
      <div className="glass rounded-xl p-4 col-span-12 lg:col-span-7">
        <SectionTitle icon={Workflow} title="Procurement Pipeline" sub="Real-time stage counts with anomaly flags" />
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={procurementFlow}>
              <CartesianGrid stroke="var(--panel-border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="stage" stroke="var(--muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} />
              <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--panel-border)", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="count" fill="var(--cyber)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="glass rounded-xl p-4 col-span-12 lg:col-span-5">
        <SectionTitle icon={FileSearch} title="Flagged Tenders" />
        <div className="space-y-2">
          {corruptionRisks.slice(0, 3).map((r) => (
            <div key={r.name} className="rounded-lg border border-border p-3">
              <div className="flex justify-between text-sm"><span className="font-medium">{r.name}</span><RiskBadge score={r.score} /></div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{r.dept}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="glass rounded-xl p-4 col-span-12">
        <SectionTitle icon={Filter} title="Supplier Risk Matrix" sub="Behavioural clustering across 1,284 vendors" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          {[
            ["Verified", 642, "success"], ["Watchlist", 318, "warning"],
            ["High Risk", 211, "destructive"], ["Conflict-of-Interest", 113, "accent"],
          ].map(([label, n, tone]) => (
            <div key={label as string} className={`rounded-lg border p-3 bg-${tone}/5 border-${tone}/30`}>
              <div className="text-muted-foreground">{label}</div>
              <div className="text-xl font-semibold mt-1">{n as number}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* --------------- Insider --------------- */

function Insider() {
  const email = useAuthEmail();
  const navigate = useNavigate();
  const openCase = useServerFn(logInsiderCase);
  const m = useMutation({
    mutationFn: (vars: { subject: string; action: string; risk: "Low" | "Medium" | "High" | "Critical" }) =>
      openCase({ data: vars }),
    onSuccess: (row, vars) => {
      toast.success(`Case opened: ${vars.subject}`, {
        description: `Logged to audit trail · outcome: ${row.outcome} · ref ${row.id.slice(0, 8)}`,
      });
    },
    onError: (e: any) => toast.error(`Could not open case: ${e?.message ?? "unknown error"}`),
  });

  return (
    <div className="grid grid-cols-12 gap-3">
      <div className="glass rounded-xl p-4 col-span-12 lg:col-span-8">
        <SectionTitle icon={Eye} title="Insider Threat Analytics" />
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr><th className="text-left p-2">User</th><th className="text-left p-2">Action</th><th className="text-left p-2">Risk</th><th className="text-left p-2">Age</th><th className="text-left p-2">Action</th></tr>
            </thead>
            <tbody>
              {insiderEvents.map((e, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="p-2 font-mono">{e.user}</td>
                  <td className="p-2">{e.action}</td>
                  <td className="p-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] border ${
                      e.risk === "Critical" ? "bg-destructive/15 text-destructive border-destructive/40" :
                      e.risk === "High" ? "bg-warning/15 text-warning border-warning/40" :
                      "bg-info/15 text-info border-info/40"
                    }`}>{e.risk}</span>
                  </td>
                  <td className="p-2 text-muted-foreground">{e.time}</td>
                  <td className="p-2">
                    <button
                      disabled={m.isPending}
                      onClick={() => {
                        if (!email) {
                          toast.warning("Sign in required to open a case");
                          navigate({ to: "/auth" });
                          return;
                        }
                        m.mutate({ subject: e.user, action: e.action, risk: e.risk as any });
                      }}
                      className="px-2 py-1 rounded bg-cyber/15 text-cyber border border-cyber/30 text-[10px] hover:bg-cyber/25 disabled:opacity-50 inline-flex items-center gap-1"
                    >
                      {m.isPending && m.variables?.subject === e.user ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                      Investigate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="glass rounded-xl p-4 col-span-12 lg:col-span-4">
        <SectionTitle icon={KeyRound} title="Identity & Access" />
        <div className="space-y-3 text-xs">
          {[
            ["Privileged accounts", "284 / 312 monitored"],
            ["MFA coverage", "97.4%"],
            ["Dormant accounts", "41 awaiting review"],
            ["Conflict roles (SoD)", "7 detected"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-border pb-2">
              <span className="text-muted-foreground">{k}</span><span className="font-medium">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* --------------- CyberShield (uBlock-style) --------------- */

function CyberShield({ shieldOn, setShieldOn, blocked }: { shieldOn: boolean; setShieldOn: (v: boolean) => void; blocked: number }) {
  const ratio = useMemo(() => Math.min(100, Math.round((blocked % 500) / 5 + 60)), [blocked]);
  const pie = [
    { name: "Trackers", value: 38, fill: "var(--cyber)" },
    { name: "Malware C2", value: 22, fill: "var(--destructive)" },
    { name: "Phishing", value: 18, fill: "var(--warning)" },
    { name: "Cryptojack", value: 9, fill: "var(--accent)" },
    { name: "DNS Tunnel", value: 13, fill: "var(--info)" },
  ];
  return (
    <div className="grid grid-cols-12 gap-3">
      <div className="glass rounded-xl p-4 col-span-12 lg:col-span-5 relative overflow-hidden">
        <SectionTitle icon={Shield} title="CyberShield — Network Defense" sub="uBlock-style network firewall, trained on CyberSage traffic patterns" />
        <div className="relative rounded-lg p-5 border border-cyber/30 bg-cyber/5 grid-bg">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShieldOn(!shieldOn)}
              className={`h-16 w-16 rounded-full grid place-items-center border-2 transition ${
                shieldOn ? "border-cyber bg-cyber/15 glow-cyber" : "border-border bg-muted"
              }`}
            >
              <Power className={`h-7 w-7 ${shieldOn ? "text-cyber" : "text-muted-foreground"}`} />
            </button>
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Status</div>
              <div className="text-2xl font-semibold">{shieldOn ? "Protecting" : "Disabled"}</div>
              <div className="text-[11px] text-muted-foreground font-mono">model: cs-ssl-v4.2 · drift: 0.4%</div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            <div className="rounded border border-border p-2"><div className="text-[10px] text-muted-foreground">Requests Blocked</div><div className="text-lg font-semibold text-cyber font-mono">{blocked.toLocaleString()}</div></div>
            <div className="rounded border border-border p-2"><div className="text-[10px] text-muted-foreground">Domains on List</div><div className="text-lg font-semibold font-mono">312,489</div></div>
            <div className="rounded border border-border p-2"><div className="text-[10px] text-muted-foreground">False Positives</div><div className="text-lg font-semibold text-success font-mono">0.07%</div></div>
          </div>

          <div className="mt-4">
            <div className="text-[11px] text-muted-foreground mb-1 flex justify-between"><span>Page integrity</span><span className="font-mono">{ratio}%</span></div>
            <div className="h-2 rounded bg-muted overflow-hidden">
              <div className="h-full bg-gradient-to-r from-cyber to-success transition-all" style={{ width: `${ratio}%` }} />
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          {[
            { k: "Trackers", on: true }, { k: "Malicious scripts", on: true },
            { k: "Phishing domains", on: true }, { k: "Cryptojacking", on: true },
            { k: "DNS exfiltration", on: true }, { k: "Lookalike SA gov domains", on: true },
          ].map(({ k, on }) => (
            <label key={k} className="flex items-center justify-between border border-border rounded px-2 py-1.5">
              <span>{k}</span>
              <span className={`h-2 w-2 rounded-full ${on ? "bg-success pulse-dot" : "bg-muted-foreground"}`} />
            </label>
          ))}
        </div>
      </div>

      <div className="glass rounded-xl p-4 col-span-12 lg:col-span-4">
        <SectionTitle icon={Radar} title="Live Block Feed" />
        <Ticker />
      </div>

      <div className="glass rounded-xl p-4 col-span-12 lg:col-span-3">
        <SectionTitle icon={ScanLine} title="Threat Mix (24h)" />
        <div className="h-56">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={pie} dataKey="value" innerRadius={45} outerRadius={75} paddingAngle={2}>
                {pie.map((p, i) => <Cell key={i} fill={p.fill} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--panel-border)", borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="text-[11px] space-y-1">
          {pie.map((p) => (
            <li key={p.name} className="flex justify-between"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: p.fill }} />{p.name}</span><span className="font-mono">{p.value}%</span></li>
          ))}
        </ul>
      </div>

    </div>
  );
}

/* --------------- Relationship Network --------------- */

function RelationshipNetwork() {
  return (
    <div className="grid grid-cols-12 gap-3">
      <div className="glass rounded-xl p-4 col-span-12 lg:col-span-8">
        <SectionTitle icon={Network} title="Relationship Intelligence Network" sub="Graph of employees, suppliers, projects, banks — red = conflict-of-interest paths" />
        <div className="relative h-[420px] rounded-lg border border-border bg-background/40 grid-bg overflow-hidden">
          <svg className="absolute inset-0 w-full h-full">
            {relationshipEdges.map(([a, b, danger], i) => {
              const A = relationshipNodes[a]; const B = relationshipNodes[b];
              return (
                <line key={i} x1={`${A.x}%`} y1={`${A.y}%`} x2={`${B.x}%`} y2={`${B.y}%`}
                  stroke={danger ? "var(--destructive)" : "var(--cyber)"} strokeOpacity={danger ? 0.85 : 0.45} strokeWidth={danger ? 2 : 1} strokeDasharray={danger ? "0" : "4 4"} />
              );
            })}
          </svg>
          {relationshipNodes.map((n, i) => (
            <div key={i} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${n.x}%`, top: `${n.y}%` }}>
              <div className={`px-2.5 py-1.5 rounded-md text-[11px] border font-medium backdrop-blur ${
                n.risk ? "bg-destructive/15 text-destructive border-destructive/50 glow-accent" : "bg-panel text-foreground border-panel-border"
              }`}>
                {n.id}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="glass rounded-xl p-4 col-span-12 lg:col-span-4">
        <SectionTitle icon={Users} title="Detected Conflict-of-Interest Path" />
        <ol className="text-xs space-y-2">
          {["Tender MM-2031", "→ Supplier: Khanya Civils", "→ Director: J. Sibeko", "→ Employee: T. Mokoena (Procurement)", "Cycle complete · risk 92"].map((s, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="h-5 w-5 rounded-full bg-cyber/15 text-cyber border border-cyber/30 grid place-items-center font-mono text-[10px]">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
        <div className="mt-3 p-3 rounded-md border border-destructive/40 bg-destructive/5 text-xs text-destructive">
          Auto-recommendation: <span className="text-foreground">Disqualify supplier, escalate to MPAC, freeze related POs.</span>
        </div>
      </div>
    </div>
  );
}

/* --------------- Public Transparency --------------- */

function Transparency() {
  return (
    <div className="grid grid-cols-12 gap-3">
      <div className="glass rounded-xl p-4 col-span-12 lg:col-span-8">
        <SectionTitle icon={Globe2} title="Public Transparency Dashboard" sub="Read-only citizen view — published with privacy filters" />
        <div className="h-64">
          <ResponsiveContainer>
            <LineChart data={riskTrend}>
              <CartesianGrid stroke="var(--panel-border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="h" stroke="var(--muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} />
              <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--panel-border)", borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="integrity" stroke="var(--cyber)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="procurement" stroke="var(--accent)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
          {[["Tenders Published", "284"], ["Awards Disclosed", "211"], ["Citizen Reports", "1,026"]].map(([k, v]) => (
            <div key={k} className="rounded-md border border-border p-3"><div className="text-muted-foreground">{k}</div><div className="text-lg font-semibold mt-1">{v}</div></div>
          ))}
        </div>
      </div>
      <div className="glass rounded-xl p-4 col-span-12 lg:col-span-4">
        <SectionTitle icon={Lock} title="Privacy & Compliance" />
        <ul className="space-y-2 text-xs">
          {[
            ["POPIA", "Compliant", "success"],
            ["MFMA reporting", "Auto-generated", "success"],
            ["AGSA audit trail", "Tamper-evident log", "cyber"],
            ["Whistle-blower channel", "End-to-end encrypted", "cyber"],
          ].map(([k, v, t]) => (
            <li key={k as string} className={`flex justify-between border border-${t}/30 bg-${t}/5 rounded-md px-3 py-2`}>
              <span className="text-muted-foreground">{k}</span><span className="font-medium">{v}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
