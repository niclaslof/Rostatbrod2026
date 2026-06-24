import { put, list, del } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { site } from "@/lib/site";

/**
 * Expense splitter ("Dela"), Blob-backed, no database / no login.
 *
 *   split/members.json            → [{ id, name, color }]  (whole list, overwritten)
 *   split/expenses/<id>.json      → one expense per blob (easy append + delete)
 *   split/settlements/<id>.json   → one settlement (debt payment) per blob
 *
 * An expense is split EQUALLY among its `participants` unless it carries a
 * resolved `breakdown` (exact/shares). Settlement maths (who owes whom) is
 * computed client-side from this raw data; "Markera betald" persists a
 * settlement transfer that folds back into the ledger.
 */

export type SplitMode = "equal" | "exact" | "shares";

export interface Member {
  id: string;
  name: string;
  color: string;
}

export interface Expense {
  id: string;
  description: string;
  /** kronor, positive */
  amount: number;
  /** member id who paid */
  paidBy: string;
  /** member ids the cost is split between */
  participants: string[];
  category: string;
  createdAt: string;
  // ── NEW, all optional → a blob with only the original 7 fields reads as equal ──
  splitMode?: SplitMode;
  breakdown?: Record<string, number>;
  shares?: Record<string, number>;
  updatedAt?: string;
}

export interface SettlementRecord {
  id: string;
  from: string;
  to: string;
  amount: number;
  note?: string;
  createdAt: string;
}

const COLORS = [
  "#c9a227", "#e07a5f", "#9b7ede", "#4ea8de",
  "#48bf91", "#f4d35e", "#ef798a", "#7ec4cf",
];

/** Penny-fair share split: largest-remainder rounding from integer weights. */
function resolveShares(shares: Record<string, number>, amount: number): Record<string, number> {
  const cents = Math.round(amount * 100);
  const ids = Object.keys(shares).filter((id) => shares[id] > 0);
  const tot = ids.reduce((s, id) => s + shares[id], 0) || 1;
  const rows = ids.map((id) => { const x = (cents * shares[id]) / tot; const f = Math.floor(x); return { id, f, frac: x - f }; });
  const rem = cents - rows.reduce((s, r) => s + r.f, 0);
  rows.sort((a, b) => b.frac - a.frac);
  const out: Record<string, number> = {};
  rows.forEach((r, i) => { out[r.id] = (r.f + (i < rem ? 1 : 0)) / 100; });
  return out;
}

async function readMembers(): Promise<Member[]> {
  try {
    const { blobs } = await list({ prefix: "split/members.json" });
    if (blobs.length === 0) return site.people.map((p) => ({ ...p }));
    const res = await fetch(blobs[0].url, { cache: "no-store" });
    if (!res.ok) return site.people.map((p) => ({ ...p }));
    const data = (await res.json()) as Member[];
    return Array.isArray(data) && data.length ? data : site.people.map((p) => ({ ...p }));
  } catch {
    return site.people.map((p) => ({ ...p }));
  }
}

async function writeMembers(members: Member[]): Promise<void> {
  await put("split/members.json", JSON.stringify(members), {
    access: "public",
    addRandomSuffix: false,
    contentType: "application/json",
    allowOverwrite: true,
  });
}

async function readExpenses(): Promise<Expense[]> {
  try {
    const { blobs } = await list({ prefix: "split/expenses/" });
    const expenses = await Promise.all(
      blobs.map(async (b) => {
        try {
          const res = await fetch(b.url, { cache: "no-store" });
          if (!res.ok) return null;
          return (await res.json()) as Expense;
        } catch {
          return null;
        }
      }),
    );
    return expenses
      .filter((e): e is Expense => !!e)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch {
    return [];
  }
}

async function readSettlements(): Promise<SettlementRecord[]> {
  try {
    const { blobs } = await list({ prefix: "split/settlements/" });
    const settlements = await Promise.all(
      blobs.map(async (b) => {
        try {
          const res = await fetch(b.url, { cache: "no-store" });
          if (!res.ok) return null;
          return (await res.json()) as SettlementRecord;
        } catch {
          return null;
        }
      }),
    );
    return settlements
      .filter((s): s is SettlementRecord => !!s)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch {
    return [];
  }
}

/**
 * Validate base expense fields + resolve the per-participant breakdown.
 * Returns the resolved fields, or an `error`/`status` to short-circuit.
 */
function buildSplit(
  p: Record<string, unknown>,
  amount: number,
  participants: string[],
):
  | { error: string; status: number }
  | { breakdown?: Record<string, number>; shares?: Record<string, number>; mode: SplitMode } {
  const mode: SplitMode = (["equal", "exact", "shares"] as const).includes(
    String(p.splitMode) as SplitMode,
  )
    ? (String(p.splitMode) as SplitMode)
    : "equal";

  if (mode === "exact") {
    const exact = (p.exact && typeof p.exact === "object" ? p.exact : {}) as Record<string, unknown>;
    const breakdown: Record<string, number> = {};
    for (const id of participants) {
      const v = Number(exact[id]);
      breakdown[id] = Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : 0;
    }
    const sumCents = participants.reduce((s, id) => s + Math.round(breakdown[id] * 100), 0);
    if (sumCents !== Math.round(amount * 100)) {
      return { error: `Delsummorna måste bli ${Math.round(amount * 100) / 100} kr`, status: 400 };
    }
    return { breakdown, mode };
  }

  if (mode === "shares") {
    const raw = (p.shares && typeof p.shares === "object" ? p.shares : {}) as Record<string, unknown>;
    const shares: Record<string, number> = {};
    for (const id of participants) {
      const v = Math.max(0, Math.round(Number(raw[id])));
      shares[id] = Number.isFinite(v) ? v : 1;
    }
    const positives = participants.filter((id) => shares[id] > 0);
    if (positives.length === 0) return { error: "Ogiltig utgift", status: 400 };
    const breakdown = resolveShares(shares, amount);
    return { breakdown, shares, mode };
  }

  return { mode: "equal" };
}

export async function GET() {
  const [members, expenses, settlements] = await Promise.all([
    readMembers(),
    readExpenses(),
    readSettlements(),
  ]);
  return NextResponse.json({ members, expenses, settlements });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { action, payload } = body as { action?: string; payload?: Record<string, unknown> };

  try {
    if (action === "addExpense" || action === "editExpense") {
      const p = payload || {};
      const amount = Number(p.amount);
      const paidBy = String(p.paidBy || "");
      const participants = Array.isArray(p.participants) ? (p.participants as string[]) : [];
      const description = String(p.description || "").trim().slice(0, 120) || "Utgift";
      const category = String(p.category || "other").slice(0, 24);

      if (action === "editExpense" && !String(p.id || "")) {
        return NextResponse.json({ error: "id krävs" }, { status: 400 });
      }
      if (!amount || amount <= 0 || !paidBy || participants.length === 0) {
        return NextResponse.json({ error: "Ogiltig utgift" }, { status: 400 });
      }

      const split = buildSplit(p, amount, participants);
      if ("error" in split) return NextResponse.json({ error: split.error }, { status: split.status });

      const roundedAmount = Math.round(amount * 100) / 100;
      const base = {
        description,
        amount: roundedAmount,
        paidBy,
        participants,
        category,
      };

      if (action === "editExpense") {
        const id = String(p.id);
        let createdAt = String(p.createdAt || "");
        if (!createdAt || Number.isNaN(new Date(createdAt).getTime())) {
          // Fall back to re-reading the original blob so list order stays stable.
          try {
            const { blobs } = await list({ prefix: `split/expenses/${id}.json` });
            if (blobs.length) {
              const res = await fetch(blobs[0].url, { cache: "no-store" });
              if (res.ok) {
                const orig = (await res.json()) as Expense;
                createdAt = orig.createdAt;
              }
            }
          } catch {
            /* fall through */
          }
          if (!createdAt || Number.isNaN(new Date(createdAt).getTime())) {
            createdAt = new Date().toISOString();
          }
        }
        const expense: Expense = {
          id,
          ...base,
          createdAt,
          updatedAt: new Date().toISOString(),
          ...(split.mode !== "equal" && split.breakdown
            ? { splitMode: split.mode, breakdown: split.breakdown }
            : {}),
          ...(split.mode === "shares" && split.shares ? { shares: split.shares } : {}),
        };
        await put(`split/expenses/${id}.json`, JSON.stringify(expense), {
          access: "public",
          addRandomSuffix: false,
          contentType: "application/json",
          allowOverwrite: true,
        });
        return NextResponse.json({ ok: true, expense });
      }

      const expense: Expense = {
        id: `e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        ...base,
        createdAt: new Date().toISOString(),
        ...(split.mode !== "equal" && split.breakdown
          ? { splitMode: split.mode, breakdown: split.breakdown }
          : {}),
        ...(split.mode === "shares" && split.shares ? { shares: split.shares } : {}),
      };

      await put(`split/expenses/${expense.id}.json`, JSON.stringify(expense), {
        access: "public",
        addRandomSuffix: false,
        contentType: "application/json",
      });
      return NextResponse.json({ ok: true, expense });
    }

    if (action === "deleteExpense") {
      const id = String((payload || {}).id || "");
      if (!id) return NextResponse.json({ error: "id krävs" }, { status: 400 });
      const { blobs } = await list({ prefix: `split/expenses/${id}.json` });
      await Promise.all(blobs.map((b) => del(b.url)));
      return NextResponse.json({ ok: true });
    }

    if (action === "addSettlement") {
      const p = payload || {};
      const from = String(p.from || "");
      const to = String(p.to || "");
      const amount = Number(p.amount);
      if (!from || !to || from === to || !(amount > 0)) {
        return NextResponse.json({ error: "Ogiltig betalning" }, { status: 400 });
      }
      const note = String(p.note || "").trim().slice(0, 60) || undefined;
      const settlement: SettlementRecord = {
        id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        from,
        to,
        amount: Math.round(amount * 100) / 100,
        ...(note ? { note } : {}),
        createdAt: new Date().toISOString(),
      };
      await put(`split/settlements/${settlement.id}.json`, JSON.stringify(settlement), {
        access: "public",
        addRandomSuffix: false,
        contentType: "application/json",
      });
      return NextResponse.json({ ok: true, settlement });
    }

    if (action === "deleteSettlement") {
      const id = String((payload || {}).id || "");
      if (!id) return NextResponse.json({ error: "id krävs" }, { status: 400 });
      const { blobs } = await list({ prefix: `split/settlements/${id}.json` });
      await Promise.all(blobs.map((b) => del(b.url)));
      return NextResponse.json({ ok: true });
    }

    if (action === "addMember") {
      const name = String((payload || {}).name || "").trim().slice(0, 40);
      if (!name) return NextResponse.json({ error: "namn krävs" }, { status: 400 });
      const members = await readMembers();
      if (members.some((m) => m.name.toLowerCase() === name.toLowerCase())) {
        return NextResponse.json({ ok: true, members });
      }
      const member: Member = {
        id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name,
        color: COLORS[members.length % COLORS.length],
      };
      const next = [...members, member];
      await writeMembers(next);
      return NextResponse.json({ ok: true, members: next, member });
    }

    if (action === "renameMember") {
      const id = String((payload || {}).id || "");
      const name = String((payload || {}).name || "").trim().slice(0, 40);
      if (!id || !name) return NextResponse.json({ error: "id och namn krävs" }, { status: 400 });
      const members = await readMembers();
      if (!members.some((m) => m.id === id)) {
        return NextResponse.json({ error: "Okänd resenär" }, { status: 404 });
      }
      if (members.some((m) => m.id !== id && m.name.toLowerCase() === name.toLowerCase())) {
        return NextResponse.json({ error: "Namnet används redan" }, { status: 409 });
      }
      const next = members.map((m) => (m.id === id ? { ...m, name } : m));
      await writeMembers(next);
      return NextResponse.json({ ok: true, members: next });
    }

    if (action === "deleteMember") {
      const p = payload || {};
      const id = String(p.id || "");
      const force = Boolean(p.force);
      if (!id) return NextResponse.json({ error: "id krävs" }, { status: 400 });
      const members = await readMembers();
      if (members.length <= 1) {
        return NextResponse.json({ error: "Minst en resenär krävs" }, { status: 400 });
      }
      const expenses = await readExpenses();
      const refs = expenses.filter(
        (e) => e.paidBy === id || e.participants.includes(id),
      ).length;
      if (refs > 0 && !force) {
        return NextResponse.json({ error: "MEMBER_IN_USE", refs }, { status: 409 });
      }
      const next = members.filter((m) => m.id !== id);
      await writeMembers(next);
      return NextResponse.json({ ok: true, members: next, removed: id, refs });
    }

    return NextResponse.json({ error: "okänd action" }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: `Fel: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 },
    );
  }
}
