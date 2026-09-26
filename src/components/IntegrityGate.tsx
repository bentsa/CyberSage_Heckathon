import { useMemo, useState } from "react";
import {
  FileCheck2, UserCheck, Lock, Building, ShieldCheck, ShieldX, Ban,
  CheckCircle2, AlertTriangle, ScanSearch,
} from "lucide-react";
import { toast } from "sonner";

/* ============================================================
 * Verification logic — deterministic mock "rules engines"
 * ============================================================ */

// --- Invoice registry (the "truth") ---
const PO_REGISTRY: Record<string, { vendor: string; cipc: string; maxAmount: number; description: string }> = {
  "PO-44021": { vendor: "Khanya Civils (Pty) Ltd", cipc: "2011/123456/07", maxAmount: 450_000, description: "N12 resurfacing — Phase 2" },
  "PO-44890": { vendor: "Bokamoso ICT Services", cipc: "2018/441229/07", maxAmount: 180_000, description: "Endpoint security renewal" },
  "PO-45112": { vendor: "Imbali Sanitation Co-op", cipc: "2014/887334/23", maxAmount: 95_000, description: "Refuse collection Ward 12" },
};
const PAID_INVOICES = new Set(["INV-2031-A", "INV-44890-Q3"]);
const VENDOR_REGISTRY = new Set(Object.values(PO_REGISTRY).map(p => p.vendor.toLowerCase()));

type InvoiceInput = { invoiceNo: string; vendor: string; po: string; amount: number };

function verifyInvoice(i: InvoiceInput) {
  const reasons: string[] = [];
  const po = PO_REGISTRY[i.po.toUpperCase()];
  if (!po) reasons.push(`PO ${i.po} not found in municipal procurement registry`);
  if (!VENDOR_REGISTRY.has(i.vendor.trim().toLowerCase())) reasons.push("Vendor not on approved supplier registry");
  if (po && po.vendor.toLowerCase() !== i.vendor.trim().toLowerCase()) reasons.push(`Vendor mismatch — PO is owned by ${po.vendor}`);
  if (po && i.amount > po.maxAmount) reasons.push(`Amount R${i.amount.toLocaleString()} exceeds PO ceiling R${po.maxAmount.toLocaleString()}`);
  if (i.amount <= 0) reasons.push("Invoice amount must be greater than zero");
  if (PAID_INVOICES.has(i.invoiceNo.toUpperCase())) reasons.push(`Duplicate — invoice ${i.invoiceNo} was already paid`);
  return { ok: reasons.length === 0, reasons, po };
}

// --- Hiring qualifications ---
const POSITION_REQUIREMENTS: Record<string, { minQual: string; minYears: number; mustHave: string[] }> = {
  "CFO": { minQual: "CA(SA)", minYears: 8, mustHave: ["MFMA Competency", "Clear credit record"] },
  "Municipal Manager": { minQual: "Postgraduate (Public Admin)", minYears: 10, mustHave: ["MFMA Competency", "Clear criminal record"] },
  "Procurement Officer": { minQual: "B.Com / Supply Chain Diploma", minYears: 3, mustHave: ["CIPS certification", "Clear criminal record"] },
  "ICT Security Lead": { minQual: "B.Sc / IT Degree", minYears: 5, mustHave: ["CISSP or equivalent", "Clear criminal record"] },
};
const QUAL_RANK: Record<string, number> = {
  "Matric": 1, "Diploma": 2, "B.Com / Supply Chain Diploma": 2, "B.Sc / IT Degree": 3,
  "B.Com": 3, "Honours": 4, "Postgraduate (Public Admin)": 5, "CA(SA)": 6,
};

type CandidateInput = {
  fullName: string; idNumber: string; position: string; qualification: string;
  years: number; certifications: string; criminalRecord: boolean; relatedToStaff: boolean;
};

function verifyCandidate(c: CandidateInput) {
  const reasons: string[] = [];
  const req = POSITION_REQUIREMENTS[c.position];
  if (!req) reasons.push("Position not defined in HR establishment");
  if (!/^\d{13}$/.test(c.idNumber)) reasons.push("ID number must be 13 digits (SA format)");
  if (req) {
    if ((QUAL_RANK[c.qualification] ?? 0) < (QUAL_RANK[req.minQual] ?? 0))
      reasons.push(`Qualification "${c.qualification}" below required "${req.minQual}"`);
    if (c.years < req.minYears) reasons.push(`Only ${c.years} yrs experience — ${req.minYears} required`);
    const certs = c.certifications.toLowerCase();
    for (const m of req.mustHave) {
      const key = m.split(" ")[0].toLowerCase();
      if (!certs.includes(key) && !(m.includes("criminal") || m.includes("credit")))
        reasons.push(`Missing required credential: ${m}`);
    }
  }
  if (c.criminalRecord) reasons.push("Criminal record flag — fails fit-and-proper test");
  if (c.relatedToStaff) reasons.push("Declared relationship with serving staff — nepotism risk");
  return { ok: reasons.length === 0, reasons, req };
}

// --- Tender leak guard ---
type TenderAccess = {
  tenderId: string; status: "Draft" | "Sealed" | "Published" | "Awarded";
  requester: string; clearance: "L1" | "L2" | "L3" | "Public";
  channel: "Internal-Secure" | "Email" | "USB" | "External-Share";
  hoursToPublish: number;
};

function verifyTenderAccess(t: TenderAccess) {
  const reasons: string[] = [];
  if (t.status === "Sealed" && t.clearance !== "L3") reasons.push("Sealed tender — requires L3 clearance");
  if (t.status === "Draft" && t.clearance === "Public") reasons.push("Draft documents cannot leave the SCM enclave");
  if (t.status !== "Published" && t.status !== "Awarded" && t.channel !== "Internal-Secure")
    reasons.push(`Pre-publication transfer via ${t.channel} is blocked by DLP policy`);
  if (t.status === "Sealed" && t.hoursToPublish > 0 && t.channel === "Email")
    reasons.push(`Email distribution ${t.hoursToPublish}h before publication — leak risk`);
  if (t.channel === "USB") reasons.push("USB exfiltration channel disabled on all SCM endpoints");
  if (t.requester.toLowerCase().includes("contractor")) reasons.push("External contractor cannot access pre-published tender data");
  return { ok: reasons.length === 0, reasons };
}

// --- Company / fund release ---
const COMPANY_REGISTRY: Record<string, {
  name: string; status: "Active" | "Deregistered" | "In Business Rescue";
  taxClearance: boolean; bbbee: string; established: number; director: string; bankVerified: boolean;
}> = {
  "2011/123456/07": { name: "Khanya Civils (Pty) Ltd", status: "Active", taxClearance: true, bbbee: "Level 2", established: 2011, director: "J. Sibeko", bankVerified: true },
  "2018/441229/07": { name: "Bokamoso ICT Services", status: "Active", taxClearance: true, bbbee: "Level 1", established: 2018, director: "P. Ndlovu", bankVerified: true },
  "2014/887334/23": { name: "Imbali Sanitation Co-op", status: "Active", taxClearance: false, bbbee: "Level 4", established: 2014, director: "N. Khumalo", bankVerified: true },
  "2024/999111/07": { name: "Shelf Co Holdings", status: "Active", taxClearance: false, bbbee: "Non-compliant", established: 2024, director: "Unknown", bankVerified: false },
};

type FundReleaseInput = { cipc: string; companyName: string; amount: number; bankAccount: string };

function verifyFundRelease(f: FundReleaseInput) {
  const reasons: string[] = [];
  const c = COMPANY_REGISTRY[f.cipc.trim()];
  if (!c) {
    reasons.push(`CIPC ${f.cipc} not found — company does not exist on official registry`);
    return { ok: false, reasons, company: undefined };
  }
  if (c.name.toLowerCase() !== f.companyName.trim().toLowerCase())
    reasons.push(`Name mismatch — CIPC registered as "${c.name}"`);
  if (c.status !== "Active") reasons.push(`Company status: ${c.status} — not eligible for awards`);
  if (!c.taxClearance) reasons.push("No valid SARS tax clearance on file");
  if (!c.bankVerified) reasons.push("Bank account not verified by Account Verification Service");
  if (new Date().getFullYear() - c.established < 1) reasons.push("Company established less than 12 months ago — additional due diligence required");
  if (f.amount <= 0) reasons.push("Release amount must be greater than zero");
  if (!/^\d{8,12}$/.test(f.bankAccount)) reasons.push("Bank account number is invalid");
  return { ok: reasons.length === 0, reasons, company: c };
}

/* ============================================================
 * UI primitives
 * ============================================================ */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="text-xs text-muted-foreground flex flex-col gap-1">
      <span className="uppercase tracking-wider text-[10px]">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "bg-background/60 border border-border rounded-md px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-cyber/60 focus:ring-1 focus:ring-cyber/30";

function ResultPanel({ ok, reasons, extra }: { ok: boolean | null; reasons: string[]; extra?: React.ReactNode }) {
  if (ok === null) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground flex items-center gap-2">
        <ScanSearch className="h-4 w-4" /> Awaiting verification — fill the form and run a check.
      </div>
    );
  }
  return (
    <div
      className={`rounded-lg border p-4 ${
        ok ? "border-success/40 bg-success/5" : "border-destructive/40 bg-destructive/5"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        {ok ? <CheckCircle2 className="h-5 w-5 text-success" /> : <Ban className="h-5 w-5 text-destructive" />}
        <span className={`font-semibold ${ok ? "text-success" : "text-destructive"}`}>
          {ok ? "APPROVED — process may continue" : "BLOCKED — process halted by CyberSage"}
        </span>
      </div>
      {reasons.length > 0 && (
        <ul className="text-xs space-y-1">
          {reasons.map((r, i) => (
            <li key={i} className="flex gap-2 text-destructive">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {r}
            </li>
          ))}
        </ul>
      )}
      {extra}
    </div>
  );
}

/* ============================================================
 * Sub-verifiers
 * ============================================================ */

function InvoiceVerifier() {
  const samples: Record<string, InvoiceInput> = {
    "✓ Valid (Bokamoso ICT)":   { invoiceNo: "INV-99012", vendor: "Bokamoso ICT Services", po: "PO-44890", amount: 175_000 },
    "✗ Over-billed (Khanya)":   { invoiceNo: "INV-99201", vendor: "Khanya Civils (Pty) Ltd", po: "PO-44021", amount: 612_000 },
    "✗ Ghost vendor":           { invoiceNo: "INV-99300", vendor: "Phantom Trading 88", po: "PO-44021", amount: 120_000 },
    "✗ Duplicate":              { invoiceNo: "INV-2031-A", vendor: "Khanya Civils (Pty) Ltd", po: "PO-44021", amount: 200_000 },
    "✗ Unknown PO":             { invoiceNo: "INV-99410", vendor: "Bokamoso ICT Services", po: "PO-00000", amount: 50_000 },
  };
  const [form, setForm] = useState<InvoiceInput>(samples["✓ Valid (Bokamoso ICT)"]);
  const [result, setResult] = useState<{ ok: boolean; reasons: string[]; po?: any } | null>(null);

  const run = () => {
    const r = verifyInvoice(form);
    setResult(r);
    toast[r.ok ? "success" : "error"](r.ok ? "Invoice approved" : "Invoice blocked", {
      description: r.ok ? `${form.invoiceNo} matched PO ${form.po}` : r.reasons[0],
    });
  };

  return (
    <div className="grid grid-cols-12 gap-3">
      <div className="glass rounded-xl p-4 col-span-12 lg:col-span-6 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold"><FileCheck2 className="h-4 w-4 text-cyber" /> Invoice Authenticity Check</div>
        <div className="flex flex-wrap gap-1.5">
          {Object.keys(samples).map((k) => (
            <button key={k} onClick={() => { setForm(samples[k]); setResult(null); }}
              className="text-[10px] px-2 py-1 rounded border border-border hover:border-cyber/40 hover:bg-cyber/5">
              {k}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Invoice No"><input className={inputCls} value={form.invoiceNo} onChange={(e) => setForm({ ...form, invoiceNo: e.target.value })} /></Field>
          <Field label="Linked PO"><input className={inputCls} value={form.po} onChange={(e) => setForm({ ...form, po: e.target.value })} /></Field>
          <Field label="Vendor name"><input className={inputCls} value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} /></Field>
          <Field label="Amount (R)"><input type="number" className={inputCls} value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></Field>
        </div>
        <button onClick={run} className="w-full h-9 rounded-md bg-cyber text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90">
          <ShieldCheck className="h-4 w-4" /> Verify invoice
        </button>
      </div>
      <div className="glass rounded-xl p-4 col-span-12 lg:col-span-6 space-y-3">
        <div className="text-sm font-semibold">Verification result</div>
        <ResultPanel ok={result ? result.ok : null} reasons={result?.reasons ?? []}
          extra={result?.po && (
            <div className="mt-3 text-[11px] text-muted-foreground font-mono">
              Registry PO: {form.po.toUpperCase()} · ceiling R{result.po.maxAmount.toLocaleString()} · owner {result.po.vendor}
            </div>
          )} />
        <div className="text-[11px] text-muted-foreground">
          Cross-checks: PO registry · approved supplier list · CIPC ownership · paid-invoice ledger · ceiling rules.
        </div>
      </div>
    </div>
  );
}

function HireVerifier() {
  const samples: Record<string, CandidateInput> = {
    "✓ Qualified Procurement Officer": { fullName: "Lerato Mahlangu", idNumber: "9203145012089", position: "Procurement Officer", qualification: "B.Com / Supply Chain Diploma", years: 5, certifications: "CIPS Level 4", criminalRecord: false, relatedToStaff: false },
    "✗ Underqualified CFO":            { fullName: "Sipho Ndaba", idNumber: "8506110456082", position: "CFO", qualification: "Diploma", years: 4, certifications: "None", criminalRecord: false, relatedToStaff: false },
    "✗ Criminal record":               { fullName: "T. Mokoena", idNumber: "8801015009087", position: "ICT Security Lead", qualification: "B.Sc / IT Degree", years: 6, certifications: "CISSP", criminalRecord: true, relatedToStaff: false },
    "✗ Nepotism risk":                 { fullName: "K. Sibeko", idNumber: "9512205002086", position: "Procurement Officer", qualification: "B.Com / Supply Chain Diploma", years: 4, certifications: "CIPS", criminalRecord: false, relatedToStaff: true },
  };
  const [form, setForm] = useState<CandidateInput>(samples["✓ Qualified Procurement Officer"]);
  const [result, setResult] = useState<{ ok: boolean; reasons: string[]; req?: any } | null>(null);
  const run = () => {
    const r = verifyCandidate(form);
    setResult(r);
    toast[r.ok ? "success" : "error"](r.ok ? "Candidate cleared" : "Appointment blocked",
      { description: r.ok ? `${form.fullName} qualifies for ${form.position}` : r.reasons[0] });
  };
  return (
    <div className="grid grid-cols-12 gap-3">
      <div className="glass rounded-xl p-4 col-span-12 lg:col-span-7 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold"><UserCheck className="h-4 w-4 text-cyber" /> Appointment Eligibility Check</div>
        <div className="flex flex-wrap gap-1.5">
          {Object.keys(samples).map((k) => (
            <button key={k} onClick={() => { setForm(samples[k]); setResult(null); }}
              className="text-[10px] px-2 py-1 rounded border border-border hover:border-cyber/40 hover:bg-cyber/5">{k}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Full name"><input className={inputCls} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></Field>
          <Field label="SA ID number"><input className={inputCls} value={form.idNumber} onChange={(e) => setForm({ ...form, idNumber: e.target.value })} /></Field>
          <Field label="Position">
            <select className={inputCls} value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })}>
              {Object.keys(POSITION_REQUIREMENTS).map((p) => <option key={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Highest qualification">
            <select className={inputCls} value={form.qualification} onChange={(e) => setForm({ ...form, qualification: e.target.value })}>
              {Object.keys(QUAL_RANK).map((q) => <option key={q}>{q}</option>)}
            </select>
          </Field>
          <Field label="Years experience"><input type="number" className={inputCls} value={form.years} onChange={(e) => setForm({ ...form, years: Number(e.target.value) })} /></Field>
          <Field label="Certifications"><input className={inputCls} value={form.certifications} onChange={(e) => setForm({ ...form, certifications: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={form.criminalRecord} onChange={(e) => setForm({ ...form, criminalRecord: e.target.checked })} /> Criminal record on file
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={form.relatedToStaff} onChange={(e) => setForm({ ...form, relatedToStaff: e.target.checked })} /> Related to serving staff
          </label>
        </div>
        <button onClick={run} className="w-full h-9 rounded-md bg-cyber text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90">
          <ShieldCheck className="h-4 w-4" /> Verify candidate
        </button>
      </div>
      <div className="glass rounded-xl p-4 col-span-12 lg:col-span-5 space-y-3">
        <div className="text-sm font-semibold">Decision</div>
        <ResultPanel ok={result ? result.ok : null} reasons={result?.reasons ?? []}
          extra={result?.req && (
            <div className="mt-3 text-[11px] text-muted-foreground">
              Position requires <span className="text-foreground">{result.req.minQual}</span>, {result.req.minYears}+ yrs, {result.req.mustHave.join(" · ")}.
            </div>
          )} />
        <div className="text-[11px] text-muted-foreground">
          Cross-checks: Home Affairs ID format · HR establishment · qualification rank · SAPS / credit · relationships register.
        </div>
      </div>
    </div>
  );
}

function TenderLeakGuard() {
  const samples: Record<string, TenderAccess> = {
    "✓ Authorised SCM officer":     { tenderId: "MM-2031", status: "Sealed", requester: "scm.officer@mun.gov.za", clearance: "L3", channel: "Internal-Secure", hoursToPublish: 48 },
    "✗ Pre-release email leak":     { tenderId: "MM-2031", status: "Sealed", requester: "a.vanwyk@mun.gov.za", clearance: "L2", channel: "Email", hoursToPublish: 12 },
    "✗ USB exfiltration":           { tenderId: "MM-1987", status: "Draft",  requester: "intern@mun.gov.za", clearance: "L1", channel: "USB", hoursToPublish: 96 },
    "✗ External contractor":        { tenderId: "MM-2031", status: "Sealed", requester: "contractor@khanya.co.za", clearance: "L2", channel: "External-Share", hoursToPublish: 24 },
  };
  const [form, setForm] = useState<TenderAccess>(samples["✓ Authorised SCM officer"]);
  const [result, setResult] = useState<{ ok: boolean; reasons: string[] } | null>(null);
  const run = () => {
    const r = verifyTenderAccess(form);
    setResult(r);
    toast[r.ok ? "success" : "error"](r.ok ? "Access permitted" : "Leak blocked",
      { description: r.ok ? `Tender ${form.tenderId} access logged` : r.reasons[0] });
  };
  return (
    <div className="grid grid-cols-12 gap-3">
      <div className="glass rounded-xl p-4 col-span-12 lg:col-span-6 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold"><Lock className="h-4 w-4 text-cyber" /> Tender Leak Guard (DLP)</div>
        <div className="flex flex-wrap gap-1.5">
          {Object.keys(samples).map((k) => (
            <button key={k} onClick={() => { setForm(samples[k]); setResult(null); }}
              className="text-[10px] px-2 py-1 rounded border border-border hover:border-cyber/40 hover:bg-cyber/5">{k}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Tender ID"><input className={inputCls} value={form.tenderId} onChange={(e) => setForm({ ...form, tenderId: e.target.value })} /></Field>
          <Field label="Status">
            <select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as TenderAccess["status"] })}>
              {["Draft", "Sealed", "Published", "Awarded"].map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Requester"><input className={inputCls} value={form.requester} onChange={(e) => setForm({ ...form, requester: e.target.value })} /></Field>
          <Field label="Clearance">
            <select className={inputCls} value={form.clearance} onChange={(e) => setForm({ ...form, clearance: e.target.value as TenderAccess["clearance"] })}>
              {["Public", "L1", "L2", "L3"].map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Channel">
            <select className={inputCls} value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value as TenderAccess["channel"] })}>
              {["Internal-Secure", "Email", "USB", "External-Share"].map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Hours until publication"><input type="number" className={inputCls} value={form.hoursToPublish} onChange={(e) => setForm({ ...form, hoursToPublish: Number(e.target.value) })} /></Field>
        </div>
        <button onClick={run} className="w-full h-9 rounded-md bg-cyber text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90">
          <ShieldX className="h-4 w-4" /> Evaluate access request
        </button>
      </div>
      <div className="glass rounded-xl p-4 col-span-12 lg:col-span-6 space-y-3">
        <div className="text-sm font-semibold">Policy decision</div>
        <ResultPanel ok={result ? result.ok : null} reasons={result?.reasons ?? []} />
        <div className="text-[11px] text-muted-foreground">
          DLP rules: clearance ↔ status, channel restrictions, pre-publication embargo, external party blocks, USB lockdown.
          Tender contents are sealed in an encrypted vault until the official publication timestamp.
        </div>
      </div>
    </div>
  );
}

function VendorFundsGate() {
  const samples: Record<string, FundReleaseInput> = {
    "✓ Khanya Civils — R 250k":  { cipc: "2011/123456/07", companyName: "Khanya Civils (Pty) Ltd", amount: 250_000, bankAccount: "60412233" },
    "✗ Ghost company":           { cipc: "9999/000000/07", companyName: "Bright Future Trading", amount: 480_000, bankAccount: "11223344" },
    "✗ Shelf co (new, no tax)":  { cipc: "2024/999111/07", companyName: "Shelf Co Holdings", amount: 1_200_000, bankAccount: "70011223" },
    "✗ Tax non-compliant":       { cipc: "2014/887334/23", companyName: "Imbali Sanitation Co-op", amount: 80_000, bankAccount: "55667788" },
  };
  const [form, setForm] = useState<FundReleaseInput>(samples["✓ Khanya Civils — R 250k"]);
  const [result, setResult] = useState<{ ok: boolean; reasons: string[]; company?: any } | null>(null);
  const run = () => {
    const r = verifyFundRelease(form);
    setResult(r);
    toast[r.ok ? "success" : "error"](r.ok ? "Funds released" : "Disbursement blocked",
      { description: r.ok ? `R${form.amount.toLocaleString()} approved to ${form.companyName}` : r.reasons[0] });
  };
  return (
    <div className="grid grid-cols-12 gap-3">
      <div className="glass rounded-xl p-4 col-span-12 lg:col-span-6 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold"><Building className="h-4 w-4 text-cyber" /> Vendor Existence & Funds Gate</div>
        <div className="flex flex-wrap gap-1.5">
          {Object.keys(samples).map((k) => (
            <button key={k} onClick={() => { setForm(samples[k]); setResult(null); }}
              className="text-[10px] px-2 py-1 rounded border border-border hover:border-cyber/40 hover:bg-cyber/5">{k}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="CIPC reg no."><input className={inputCls} value={form.cipc} onChange={(e) => setForm({ ...form, cipc: e.target.value })} /></Field>
          <Field label="Company name"><input className={inputCls} value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} /></Field>
          <Field label="Amount (R)"><input type="number" className={inputCls} value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></Field>
          <Field label="Bank account"><input className={inputCls} value={form.bankAccount} onChange={(e) => setForm({ ...form, bankAccount: e.target.value })} /></Field>
        </div>
        <button onClick={run} className="w-full h-9 rounded-md bg-cyber text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90">
          <ShieldCheck className="h-4 w-4" /> Verify & release
        </button>
      </div>
      <div className="glass rounded-xl p-4 col-span-12 lg:col-span-6 space-y-3">
        <div className="text-sm font-semibold">Disbursement decision</div>
        <ResultPanel ok={result ? result.ok : null} reasons={result?.reasons ?? []}
          extra={result?.company && (
            <div className="mt-3 text-[11px] text-muted-foreground font-mono">
              CIPC: {form.cipc} · {result.company.status} · est. {result.company.established} · B-BBEE {result.company.bbbee} · director {result.company.director}
            </div>
          )} />
        <div className="text-[11px] text-muted-foreground">
          Cross-checks: CIPC company registry · SARS tax clearance · AVS bank account · B-BBEE status · age of company.
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * Main module
 * ============================================================ */

const TABS = [
  { id: "invoice", label: "Invoices", icon: FileCheck2 },
  { id: "hire", label: "Appointments", icon: UserCheck },
  { id: "leak", label: "Tender Leak Guard", icon: Lock },
  { id: "funds", label: "Vendor & Funds", icon: Building },
] as const;
type TabId = typeof TABS[number]["id"];

export function IntegrityGate() {
  const [tab, setTab] = useState<TabId>("invoice");
  const stats = useMemo(() => ([
    { k: "Invoices verified (24h)", v: "1,284" },
    { k: "Appointments blocked", v: "7" },
    { k: "Leak attempts stopped", v: "12" },
    { k: "Funds withheld", v: "R 9.4M" },
  ]), []);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.k} className="glass rounded-xl p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.k}</div>
            <div className="text-xl font-semibold mt-1">{s.v}</div>
          </div>
        ))}
      </div>
      <div className="glass rounded-xl p-2 flex flex-wrap gap-1">
        {TABS.map((t) => {
          const Icon = t.icon; const on = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-3 h-9 rounded-md text-xs font-medium flex items-center gap-2 border transition ${
                on ? "bg-cyber/15 text-cyber border-cyber/40" : "bg-transparent text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/60"
              }`}>
              <Icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          );
        })}
      </div>
      {tab === "invoice" && <InvoiceVerifier />}
      {tab === "hire" && <HireVerifier />}
      {tab === "leak" && <TenderLeakGuard />}
      {tab === "funds" && <VendorFundsGate />}
    </div>
  );
}
