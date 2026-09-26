import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseSaId } from "./sa-id";

// ============ IDENTITY VERIFICATION ============
const idInput = z.object({
  idNumber: z.string().min(1),
  claimedName: z.string().optional(),
});

export const verifyIdentity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const parsed = parseSaId(data.idNumber);
    const id = data.idNumber.replace(/\s|-/g, "");
    const reasons: string[] = [...parsed.reasons];
    let risk = 0;
    if (!parsed.valid) risk += 60;

    // Check duplicate usage in our own verifications
    const { data: dupRows } = await supabase
      .from("identity_verifications")
      .select("id, claimed_name, requested_by, created_at")
      .eq("id_number", id);
    const distinctNames = new Set(
      (dupRows ?? [])
        .map((r) => (r.claimed_name ?? "").trim().toLowerCase())
        .filter(Boolean),
    );
    if (data.claimedName) distinctNames.add(data.claimedName.trim().toLowerCase());
    const dupCount = dupRows?.length ?? 0;
    if (distinctNames.size > 1) {
      reasons.push(`This ID has been submitted under ${distinctNames.size} different names — possible identity fraud`);
      risk += 40;
    }
    if (dupCount >= 5) {
      reasons.push(`High submission volume: ${dupCount} prior checks on this ID`);
      risk += 10;
    }

    // Registry status (admin-curated watchlist)
    const { data: reg } = await supabase
      .from("sa_id_registry")
      .select("status, notes")
      .eq("id_number", id)
      .maybeSingle();
    if (reg?.status === "blocked") {
      reasons.push(`Registry status: BLOCKED — ${reg.notes ?? "no notes"}`);
      risk += 100;
    } else if (reg?.status === "flagged") {
      reasons.push(`Registry status: FLAGGED — ${reg.notes ?? "no notes"}`);
      risk += 30;
    }

    risk = Math.min(100, risk);
    const outcome = !parsed.valid || risk >= 70 ? "blocked" : risk >= 30 ? "review" : "approved";

    const { data: inserted, error } = await supabase
      .from("identity_verifications")
      .insert({
        requested_by: userId,
        id_number: id,
        claimed_name: data.claimedName ?? null,
        algo_valid: parsed.valid,
        date_of_birth: parsed.dateOfBirth ?? null,
        gender: parsed.gender ?? null,
        citizenship: parsed.citizenship ?? null,
        duplicate_count: dupCount,
        risk_score: risk,
        outcome,
        reasons,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    await supabase.from("integrity_audit_log").insert({
      user_id: userId, action: "verify_identity", entity_type: "identity",
      entity_id: id, outcome, payload: { risk, reasons },
    });

    return { ...inserted, parsed };
  });

// ============ INVOICE VERIFICATION ============
const invoiceInput = z.object({
  invoiceNumber: z.string().min(1),
  poNumber: z.string().optional(),
  vendorName: z.string().min(1),
  amount: z.number().positive(),
});

export const verifyInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => invoiceInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const reasons: string[] = [];
    let risk = 0;

    // Duplicate invoice number
    const { data: dups } = await supabase
      .from("invoice_verifications")
      .select("id, amount, vendor_name, outcome")
      .eq("invoice_number", data.invoiceNumber);
    if ((dups?.length ?? 0) > 0) {
      reasons.push(`Duplicate invoice number — ${dups!.length} prior submission(s)`);
      risk += 60;
      const paid = dups!.find((d) => d.outcome === "approved");
      if (paid) {
        reasons.push("Previous invoice with same number was approved — possible double-payment fraud");
        risk += 40;
      }
    }

    if (data.amount > 1_000_000) { reasons.push("Amount exceeds R1m ceiling without dual approval"); risk += 30; }
    if (data.amount > 0 && data.amount % 100000 === 0) { reasons.push("Round-number amount — review for split-PO pattern"); risk += 10; }
    if (!data.poNumber) { reasons.push("No PO number attached"); risk += 25; }

    // Check vendor exists in prior vendor verifications
    const { data: vendorOk } = await supabase
      .from("vendor_verifications")
      .select("id, outcome")
      .ilike("company_name", data.vendorName)
      .eq("outcome", "approved")
      .limit(1);
    if (!vendorOk?.length) { reasons.push("Vendor not in approved-vendor registry"); risk += 35; }

    risk = Math.min(100, risk);
    const outcome = risk >= 70 ? "blocked" : risk >= 30 ? "review" : "approved";

    const { data: inserted, error } = await supabase
      .from("invoice_verifications")
      .insert({
        requested_by: userId,
        invoice_number: data.invoiceNumber,
        po_number: data.poNumber ?? null,
        vendor_name: data.vendorName,
        amount: data.amount,
        risk_score: risk,
        outcome,
        reasons,
      })
      .select().single();
    if (error) throw new Error(error.message);

    await supabase.from("integrity_audit_log").insert({
      user_id: userId, action: "verify_invoice", entity_type: "invoice",
      entity_id: data.invoiceNumber, outcome, payload: { risk, reasons, amount: data.amount },
    });

    return inserted;
  });

// ============ VENDOR VERIFICATION ============
// Mock CIPC registry — deterministic by company name hash
function mockCipcLookup(name: string, regNo?: string) {
  const seed = (name + (regNo ?? "")).toLowerCase();
  const hash = Array.from(seed).reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  // 12% of unseen vendors are non-existent (no CIPC record)
  const exists = hash % 100 > 12 && !!regNo && /^\d{4}\/\d{6}\/\d{2}$/.test(regNo);
  return {
    exists,
    taxClearance: exists && hash % 7 !== 0,
    bankVerified: exists && hash % 5 !== 0,
    ageDays: exists ? 30 + (hash % 4000) : 0,
  };
}

const vendorInput = z.object({
  companyName: z.string().min(2),
  registrationNumber: z.string().optional(),
  amount: z.number().nonnegative().optional(),
});

export const verifyVendor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => vendorInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const lookup = mockCipcLookup(data.companyName, data.registrationNumber);
    const reasons: string[] = [];
    let risk = 0;

    if (!lookup.exists) { reasons.push("Company does NOT exist on the CIPC register — funds release BLOCKED"); risk = 100; }
    else {
      if (!lookup.taxClearance) { reasons.push("No valid SARS tax clearance"); risk += 40; }
      if (!lookup.bankVerified) { reasons.push("Bank account could not be verified"); risk += 30; }
      if (lookup.ageDays < 180) { reasons.push(`Company is only ${lookup.ageDays} days old — high risk for new vendor on large award`); risk += 25; }
      if ((data.amount ?? 0) > 500000 && lookup.ageDays < 365) { reasons.push("Large amount to <1yr-old company"); risk += 15; }
    }

    risk = Math.min(100, risk);
    const outcome = !lookup.exists || risk >= 70 ? "blocked" : risk >= 30 ? "review" : "approved";

    const { data: inserted, error } = await supabase
      .from("vendor_verifications")
      .insert({
        requested_by: userId,
        company_name: data.companyName,
        registration_number: data.registrationNumber ?? null,
        amount: data.amount ?? null,
        cipc_exists: lookup.exists,
        tax_clearance: lookup.taxClearance,
        bank_verified: lookup.bankVerified,
        company_age_days: lookup.ageDays,
        risk_score: risk,
        outcome,
        reasons,
      })
      .select().single();
    if (error) throw new Error(error.message);

    await supabase.from("integrity_audit_log").insert({
      user_id: userId, action: "verify_vendor", entity_type: "vendor",
      entity_id: data.companyName, outcome, payload: { risk, reasons, lookup },
    });

    return inserted;
  });

// ============ HIRE VERIFICATION ============
const POSITION_REQS: Record<string, string[]> = {
  "Chief Financial Officer": ["CA(SA)", "MFMA Competency"],
  "Municipal Manager": ["MFMA Competency", "B.Com / LLB"],
  "Supply Chain Manager": ["CIPS", "MFMA Competency"],
  "IT Security Officer": ["CISSP or CISM"],
  "Internal Auditor": ["CIA or CA(SA)"],
};

const hireInput = z.object({
  candidateName: z.string().min(2),
  candidateIdNumber: z.string().optional(),
  position: z.string().min(2),
  qualifications: z.array(z.string()),
  declaredRelatives: z.array(z.string()).optional(),
});

export const verifyHire = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => hireInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const reasons: string[] = [];
    let risk = 0;

    const req = POSITION_REQS[data.position];
    const missing = req
      ? req.filter((r) => !data.qualifications.some((q) => q.toLowerCase().includes(r.split(" ")[0].toLowerCase())))
      : [];
    if (missing.length) { reasons.push(`Missing required qualifications: ${missing.join(", ")}`); risk += 50; }

    // ID validity
    if (data.candidateIdNumber) {
      const parsed = parseSaId(data.candidateIdNumber);
      if (!parsed.valid) { reasons.push("Candidate SA ID number is invalid"); risk += 40; }
      // Check ID used by another candidate
      const { data: idHits } = await supabase
        .from("hire_verifications")
        .select("candidate_name")
        .eq("candidate_id_number", data.candidateIdNumber.replace(/\s|-/g, ""));
      const others = (idHits ?? []).filter((r) => r.candidate_name.toLowerCase() !== data.candidateName.toLowerCase());
      if (others.length) { reasons.push("Same ID number previously linked to a different candidate name"); risk += 50; }
    }

    // Nepotism: any declared relative matches a vendor in our DB
    let nepotism = false;
    if (data.declaredRelatives?.length) {
      const { data: matches } = await supabase
        .from("vendor_verifications")
        .select("company_name")
        .in(
          "company_name",
          data.declaredRelatives,
        );
      if (matches?.length) { nepotism = true; reasons.push(`Conflict of interest: relative(s) linked to vendor(s) ${matches.map((m) => m.company_name).join(", ")}`); risk += 40; }
    }

    risk = Math.min(100, risk);
    const outcome = risk >= 70 ? "blocked" : risk >= 30 ? "review" : "approved";

    const { data: inserted, error } = await supabase
      .from("hire_verifications")
      .insert({
        requested_by: userId,
        candidate_name: data.candidateName,
        candidate_id_number: data.candidateIdNumber?.replace(/\s|-/g, "") ?? null,
        position: data.position,
        qualifications: data.qualifications,
        nepotism_flag: nepotism,
        criminal_flag: false,
        risk_score: risk,
        outcome,
        reasons,
      })
      .select().single();
    if (error) throw new Error(error.message);

    await supabase.from("integrity_audit_log").insert({
      user_id: userId, action: "verify_hire", entity_type: "hire",
      entity_id: data.candidateName, outcome, payload: { risk, reasons },
    });

    return inserted;
  });

// ============ TENDER ACCESS (DLP) ============
const CLEARANCE_LEVEL: Record<string, number> = { L1: 1, L2: 2, L3: 3 };
const CLASS_REQUIRED: Record<string, number> = { Public: 0, Internal: 1, Sealed: 3, Draft: 3 };
const ALLOWED_CHANNELS: Record<string, string[]> = {
  Public: ["Portal", "Email", "USB"],
  Internal: ["Portal", "Email"],
  Sealed: ["Portal"],
  Draft: ["Portal"],
};

const tenderInput = z.object({
  tenderRef: z.string().min(1),
  classification: z.enum(["Public", "Internal", "Sealed", "Draft"]),
  userClearance: z.enum(["L1", "L2", "L3"]),
  channel: z.enum(["Portal", "Email", "USB"]),
});

export const requestTenderAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => tenderInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const reasons: string[] = [];
    let allowed = true;
    if (CLEARANCE_LEVEL[data.userClearance] < CLASS_REQUIRED[data.classification]) {
      allowed = false;
      reasons.push(`Clearance ${data.userClearance} insufficient for ${data.classification} tender`);
    }
    if (!ALLOWED_CHANNELS[data.classification].includes(data.channel)) {
      allowed = false;
      reasons.push(`${data.channel} is blocked for ${data.classification} tenders — DLP enforced`);
    }

    const reason = reasons.join("; ") || "Access granted";
    const { data: inserted, error } = await supabase
      .from("tender_access_log")
      .insert({
        requested_by: userId,
        tender_ref: data.tenderRef,
        classification: data.classification,
        user_clearance: data.userClearance,
        channel: data.channel,
        allowed,
        reason,
      })
      .select().single();
    if (error) throw new Error(error.message);

    await supabase.from("integrity_audit_log").insert({
      user_id: userId, action: "tender_access", entity_type: "tender",
      entity_id: data.tenderRef, outcome: allowed ? "approved" : "blocked", payload: { reasons },
    });

    return inserted;
  });

// ============ HISTORY ============
export const listMyAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("integrity_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    return data ?? [];
  });

export const listMyIdentityChecks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("identity_verifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    return data ?? [];
  });

// ============ INSIDER / SECURITY CASE LOGGING ============
const insiderCaseInput = z.object({
  subject: z.string().min(1),
  action: z.string().min(1),
  risk: z.enum(["Low", "Medium", "High", "Critical"]),
  channel: z.string().optional(),
});

export const logInsiderCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => insiderCaseInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const outcome = data.risk === "Critical" || data.risk === "High" ? "blocked" : "review";
    const { data: inserted, error } = await supabase
      .from("integrity_audit_log")
      .insert({
        user_id: userId,
        action: "insider_case_opened",
        entity_type: "insider_event",
        entity_id: data.subject,
        outcome,
        payload: {
          subject: data.subject,
          observed_action: data.action,
          risk: data.risk,
          channel: data.channel ?? null,
          opened_at: new Date().toISOString(),
        },
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return inserted;
  });

const cyberEventInput = z.object({
  target: z.string().min(1),
  kind: z.enum(["BLOCK", "QUARANTINE", "ALLOW"]),
  rule: z.string().min(1),
});

export const logCyberEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => cyberEventInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const outcome = data.kind === "ALLOW" ? "approved" : "blocked";
    const { data: inserted, error } = await supabase
      .from("integrity_audit_log")
      .insert({
        user_id: userId,
        action: "cybershield_event",
        entity_type: "network_target",
        entity_id: data.target,
        outcome,
        payload: { kind: data.kind, rule: data.rule, at: new Date().toISOString() },
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return inserted;
  });

export const getOverviewMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [audit, invoices, vendors, identities, hires, tenders] = await Promise.all([
      supabase
        .from("integrity_audit_log")
        .select("action, entity_type, entity_id, outcome, created_at, payload")
        .order("created_at", { ascending: false })
        .limit(15),
      supabase.from("invoice_verifications").select("outcome, risk_score, amount"),
      supabase.from("vendor_verifications").select("outcome, risk_score"),
      supabase.from("identity_verifications").select("outcome, risk_score"),
      supabase.from("hire_verifications").select("outcome, risk_score"),
      supabase.from("tender_access_log").select("allowed"),
    ]);
    const all = [
      ...(invoices.data ?? []).map((r) => ({ outcome: r.outcome, risk: r.risk_score })),
      ...(vendors.data ?? []).map((r) => ({ outcome: r.outcome, risk: r.risk_score })),
      ...(identities.data ?? []).map((r) => ({ outcome: r.outcome, risk: r.risk_score })),
      ...(hires.data ?? []).map((r) => ({ outcome: r.outcome, risk: r.risk_score })),
    ];
    const blocked = all.filter((r) => r.outcome === "blocked").length;
    const review = all.filter((r) => r.outcome === "review").length;
    const approved = all.filter((r) => r.outcome === "approved").length;
    const avgRisk = all.length
      ? Math.round(all.reduce((s, r) => s + (Number(r.risk) || 0), 0) / all.length)
      : 0;
    const safeguarded = (invoices.data ?? [])
      .filter((r) => r.outcome !== "approved")
      .reduce((s, r) => s + Number(r.amount ?? 0), 0);
    const integrityIndex = all.length ? Math.max(0, 100 - avgRisk) : 100;
    const tenderBlocked = (tenders.data ?? []).filter((t) => !t.allowed).length;
    return {
      counts: { blocked, review, approved, total: all.length, tenderBlocked },
      integrityIndex,
      safeguarded,
      recent: audit.data ?? [],
    };
  });
