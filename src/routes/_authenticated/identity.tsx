import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { verifyIdentity, listMyIdentityChecks } from "@/lib/integrity.functions";
import { parseSaId } from "@/lib/sa-id";
import { ArrowLeft, ShieldCheck, ShieldAlert, Ban, Loader2, Fingerprint } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/identity")({
  component: IdentityPage,
});

function IdentityPage() {
  const qc = useQueryClient();
  const verifyFn = useServerFn(verifyIdentity);
  const listFn = useServerFn(listMyIdentityChecks);

  const [idNumber, setIdNumber] = useState("");
  const [name, setName] = useState("");

  const list = useQuery({ queryKey: ["id-checks"], queryFn: () => listFn() });

  const m = useMutation({
    mutationFn: (data: { idNumber: string; claimedName?: string }) => verifyFn({ data }),
    onSuccess: (res) => {
      const tone = res.outcome === "approved" ? toast.success : res.outcome === "review" ? toast.warning : toast.error;
      tone(`Identity ${res.outcome.toUpperCase()} — risk ${res.risk_score}/100`);
      qc.invalidateQueries({ queryKey: ["id-checks"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const preview = idNumber.length >= 6 ? parseSaId(idNumber) : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border p-4 flex items-center gap-3">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-semibold inline-flex items-center gap-2"><Fingerprint className="h-5 w-5 text-cyber" /> Identity Verification</span>
      </div>

      <div className="max-w-5xl mx-auto p-6 grid md:grid-cols-2 gap-6">
        <div className="glass rounded-xl p-5 space-y-4">
          <h2 className="text-lg font-semibold">Verify SA ID</h2>
          <p className="text-xs text-muted-foreground">Algorithmic check (Luhn + DOB + citizenship) + internal duplicate-ID and watchlist scan. Used before contracts, hires, and fund release.</p>
          <form onSubmit={(e) => { e.preventDefault(); m.mutate({ idNumber, claimedName: name || undefined }); }} className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">SA ID number (13 digits)</label>
              <input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} maxLength={13}
                className="w-full mt-1 bg-input rounded-md px-3 py-2 font-mono tracking-wider" placeholder="e.g. 9001015009087" required />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Claimed full name (optional)</label>
              <input value={name} onChange={(e) => setName(e.target.value)}
                className="w-full mt-1 bg-input rounded-md px-3 py-2" placeholder="As stated on application" />
            </div>
            {preview && (
              <div className="text-xs bg-muted/40 rounded-md p-2">
                {preview.valid ? (
                  <span className="text-success">✓ Structure valid · DOB {preview.dateOfBirth} · {preview.gender} · {preview.citizenship}</span>
                ) : (
                  <span className="text-destructive">✗ {preview.reasons.join("; ")}</span>
                )}
              </div>
            )}
            <button disabled={m.isPending} className="w-full bg-cyber text-cyber-foreground rounded-md py-2 font-medium inline-flex justify-center items-center gap-2 disabled:opacity-60">
              {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Run verification
            </button>
          </form>

          {m.data && (
            <div className={`rounded-lg p-3 text-sm border ${m.data.outcome === "approved" ? "border-success/30 bg-success/5" : m.data.outcome === "review" ? "border-warning/30 bg-warning/5" : "border-destructive/30 bg-destructive/5"}`}>
              <div className="flex items-center gap-2 font-semibold">
                {m.data.outcome === "blocked" ? <Ban className="h-4 w-4 text-destructive" /> : m.data.outcome === "review" ? <ShieldAlert className="h-4 w-4 text-warning" /> : <ShieldCheck className="h-4 w-4 text-success" />}
                {m.data.outcome.toUpperCase()} · risk {m.data.risk_score}/100 · duplicates {m.data.duplicate_count}
              </div>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground list-disc list-inside">
                {(m.data.reasons as string[]).length === 0 ? <li>All checks passed</li> : (m.data.reasons as string[]).map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          )}
        </div>

        <div className="glass rounded-xl p-5">
          <h2 className="text-lg font-semibold mb-3">Recent identity checks</h2>
          <div className="space-y-2 max-h-[28rem] overflow-y-auto">
            {list.data?.length === 0 && <div className="text-sm text-muted-foreground">No checks yet.</div>}
            {list.data?.map((row) => (
              <div key={row.id} className="rounded-md border border-border p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono">{"•".repeat(9)}{row.id_number.slice(-4)}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase ${row.outcome === "approved" ? "bg-success/20 text-success" : row.outcome === "review" ? "bg-warning/20 text-warning" : "bg-destructive/20 text-destructive"}`}>{row.outcome}</span>
                </div>
                <div className="text-muted-foreground mt-1">{row.claimed_name ?? "—"} · risk {row.risk_score} · {new Date(row.created_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
