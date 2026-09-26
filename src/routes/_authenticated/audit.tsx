import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listMyAudit } from "@/lib/integrity.functions";
import { ArrowLeft, ScrollText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/audit")({
  component: AuditPage,
});

function AuditPage() {
  const fn = useServerFn(listMyAudit);
  const { data } = useQuery({ queryKey: ["audit"], queryFn: () => fn() });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border p-4 flex items-center gap-3">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-semibold inline-flex items-center gap-2"><ScrollText className="h-5 w-5 text-cyber" /> Integrity audit log</span>
      </div>
      <div className="max-w-5xl mx-auto p-6">
        <div className="glass rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr><th className="text-left p-3">When</th><th className="text-left p-3">Action</th><th className="text-left p-3">Entity</th><th className="text-left p-3">Outcome</th></tr>
            </thead>
            <tbody>
              {data?.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-3 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="p-3">{r.action}</td>
                  <td className="p-3 font-mono text-xs">
                    {r.entity_type}:{r.entity_type === "identity" ? `${"•".repeat(9)}${r.entity_id.slice(-4)}` : r.entity_id}
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase ${r.outcome === "approved" ? "bg-success/20 text-success" : r.outcome === "review" ? "bg-warning/20 text-warning" : "bg-destructive/20 text-destructive"}`}>{r.outcome}</span>
                  </td>
                </tr>
              ))}
              {!data?.length && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground text-sm">No audit entries yet — run an Integrity Gate check to populate this log.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}