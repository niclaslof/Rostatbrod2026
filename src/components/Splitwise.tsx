"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { site } from "@/lib/site";

interface Member {
  id: string;
  name: string;
  color: string;
}

type SplitMode = "equal" | "exact" | "shares";

interface Expense {
  id: string;
  description: string;
  amount: number;
  paidBy: string;
  participants: string[];
  category: string;
  createdAt: string;
  splitMode?: SplitMode;
  breakdown?: Record<string, number>;
  shares?: Record<string, number>;
  updatedAt?: string;
}

interface SettlementRecord {
  id: string;
  from: string;
  to: string;
  amount: number;
  note?: string;
  createdAt: string;
}

const CATEGORIES: { id: string; label: string; emoji: string }[] = [
  { id: "food", label: "Mat", emoji: "🍽️" },
  { id: "drink", label: "Dryck", emoji: "🍸" },
  { id: "stay", label: "Boende", emoji: "🛏️" },
  { id: "transport", label: "Resa", emoji: "🚕" },
  { id: "fun", label: "Nöje", emoji: "🎉" },
  { id: "other", label: "Övrigt", emoji: "🧾" },
];

const catMeta = (id: string) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];

function kr(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return `${rounded.toLocaleString("sv-SE", { maximumFractionDigits: rounded % 1 ? 2 : 0 })} kr`;
}

/** Penny-fair equal split: remainder cents distributed to leading ids. */
function splitEqual(amount: number, ids: string[]): Record<string, number> {
  const cents = Math.round(amount * 100);
  const base = Math.floor(cents / ids.length);
  const rem = cents - base * ids.length;
  const out: Record<string, number> = {};
  ids.forEach((id, i) => { out[id] = (base + (i < rem ? 1 : 0)) / 100; });
  return out;
}

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

interface Settlement {
  from: string;
  to: string;
  amount: number;
}

/** Greedy minimum-transaction settlement from net balances. */
function settle(balances: Record<string, number>): Settlement[] {
  const debtors: { id: string; amt: number }[] = [];
  const creditors: { id: string; amt: number }[] = [];
  for (const [id, net] of Object.entries(balances)) {
    const v = Math.round(net * 100) / 100;
    if (v < -0.009) debtors.push({ id, amt: -v });
    else if (v > 0.009) creditors.push({ id, amt: v });
  }
  debtors.sort((a, b) => b.amt - a.amt);
  creditors.sort((a, b) => b.amt - a.amt);

  const out: Settlement[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amt, creditors[j].amt);
    out.push({ from: debtors[i].id, to: creditors[j].id, amount: Math.round(pay * 100) / 100 });
    debtors[i].amt -= pay;
    creditors[j].amt -= pay;
    if (debtors[i].amt < 0.009) i++;
    if (creditors[j].amt < 0.009) j++;
  }
  return out;
}

type Tab = "saldo" | "lista" | "lagg-till";

type ExpenseFormPayload = {
  description: string;
  amount: number;
  paidBy: string;
  participants: string[];
  category: string;
  splitMode?: SplitMode;
  exact?: Record<string, number>;
  shares?: Record<string, number>;
  id?: string;
  createdAt?: string;
};

export default function Splitwise() {
  const [members, setMembers] = useState<Member[]>(site.people.map((p) => ({ ...p })));
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<SettlementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("saldo");
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/split", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.members) && data.members.length) setMembers(data.members);
        if (Array.isArray(data.expenses)) setExpenses(data.expenses);
        setSettlements(Array.isArray(data.settlements) ? data.settlements : []);
        setError(null);
      } else {
        setError("Kunde inte ladda – kontrollera nätet.");
      }
    } catch {
      setError("Kunde inte ladda – kontrollera nätet.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ob = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          load();
          ob.disconnect();
        }
      },
      { threshold: 0.05 },
    );
    const el = document.getElementById("dela");
    if (el) ob.observe(el);
    return () => ob.disconnect();
  }, [load]);

  const nameOf = useCallback(
    (id: string) => members.find((m) => m.id === id)?.name || "Okänd",
    [members],
  );
  const colorOf = useCallback(
    (id: string) => members.find((m) => m.id === id)?.color || "#8b8597",
    [members],
  );

  const { balances, total } = useMemo(() => {
    const bal: Record<string, number> = {};
    members.forEach((m) => (bal[m.id] = 0));
    let tot = 0;
    for (const e of expenses) {
      tot += e.amount;
      const parts = e.participants.filter((p) => bal[p] !== undefined);
      // Skip the expense from per-person balances if no participant or the payer
      // survives a force-delete — it still counts toward `tot` but must not inject
      // a non-zero-sum residual into the ledger.
      if (parts.length === 0 || bal[e.paidBy] === undefined) continue;
      if (e.breakdown) {
        // Credit the payer only for the share attributable to surviving
        // participants so the expense still nets to zero when a referenced
        // member was force-deleted (or the breakdown is partial vs amount).
        let credited = 0;
        for (const p of parts) {
          const share = e.breakdown[p] ?? 0;
          bal[p] -= share;
          credited += share;
        }
        bal[e.paidBy] += credited;
      } else {
        const s = splitEqual(e.amount, parts);
        for (const p of parts) bal[p] -= s[p];
        bal[e.paidBy] += e.amount;
      }
    }
    for (const s of settlements) {
      if (bal[s.from] !== undefined) bal[s.from] += s.amount;
      if (bal[s.to] !== undefined) bal[s.to] -= s.amount;
    }
    return { balances: bal, total: tot };
  }, [members, expenses, settlements]);

  const greedy = useMemo(() => settle(balances), [balances]);

  const submitExpense = (payload: ExpenseFormPayload) => {
    if (payload.id) editExpense(payload.id, payload);
    else addExpense(payload);
  };

  const addExpense = async (payload: ExpenseFormPayload) => {
    setError(null);
    const optimistic: Expense = {
      id: `tmp-${Date.now()}`,
      description: payload.description,
      amount: payload.amount,
      paidBy: payload.paidBy,
      participants: payload.participants,
      category: payload.category,
      createdAt: new Date().toISOString(),
      ...(payload.splitMode && payload.splitMode !== "equal" ? { splitMode: payload.splitMode } : {}),
      ...(payload.splitMode === "exact" && payload.exact ? { breakdown: payload.exact } : {}),
      ...(payload.splitMode === "shares" && payload.shares
        ? { shares: payload.shares, breakdown: resolveShares(payload.shares, payload.amount) }
        : {}),
    };
    setExpenses((prev) => [optimistic, ...prev]);
    setTab("saldo");
    try {
      const res = await fetch("/api/split", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "addExpense", payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kunde inte spara");
      setExpenses((prev) => prev.map((e) => (e.id === optimistic.id ? data.expense : e)));
    } catch (e) {
      setExpenses((prev) => prev.filter((x) => x.id !== optimistic.id));
      setError(e instanceof Error ? e.message : "Fel");
    }
  };

  const editExpense = async (id: string, payload: ExpenseFormPayload) => {
    setError(null);
    const prev = expenses;
    const patched: Expense = {
      id,
      description: payload.description,
      amount: payload.amount,
      paidBy: payload.paidBy,
      participants: payload.participants,
      category: payload.category,
      createdAt: payload.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...(payload.splitMode && payload.splitMode !== "equal" ? { splitMode: payload.splitMode } : {}),
      ...(payload.splitMode === "exact" && payload.exact ? { breakdown: payload.exact } : {}),
      ...(payload.splitMode === "shares" && payload.shares
        ? { shares: payload.shares, breakdown: resolveShares(payload.shares, payload.amount) }
        : {}),
    };
    setExpenses((p) => p.map((e) => (e.id === id ? patched : e)));
    setEditing(null);
    setTab("saldo");
    try {
      const res = await fetch("/api/split", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "editExpense", payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kunde inte spara");
      setExpenses((p) => p.map((e) => (e.id === id ? data.expense : e)));
    } catch (e) {
      setExpenses(prev);
      setError(e instanceof Error ? e.message : "Fel");
    }
  };

  const deleteExpense = async (id: string) => {
    const prev = expenses;
    setExpenses((p) => p.filter((e) => e.id !== id));
    try {
      await fetch("/api/split", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deleteExpense", payload: { id } }),
      });
    } catch {
      setExpenses(prev);
    }
  };

  const addSettlement = async (payload: { from: string; to: string; amount: number; note?: string }) => {
    setError(null);
    const optimistic: SettlementRecord = {
      id: `tmp-${Date.now()}`,
      from: payload.from,
      to: payload.to,
      amount: payload.amount,
      ...(payload.note ? { note: payload.note } : {}),
      createdAt: new Date().toISOString(),
    };
    setSettlements((prev) => [optimistic, ...prev]);
    try {
      const res = await fetch("/api/split", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "addSettlement", payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kunde inte spara");
      setSettlements((prev) => prev.map((s) => (s.id === optimistic.id ? data.settlement : s)));
    } catch (e) {
      setSettlements((prev) => prev.filter((s) => s.id !== optimistic.id));
      setError(e instanceof Error ? e.message : "Fel");
    }
  };

  const deleteSettlement = async (id: string) => {
    const prev = settlements;
    setSettlements((p) => p.filter((s) => s.id !== id));
    try {
      await fetch("/api/split", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deleteSettlement", payload: { id } }),
      });
    } catch {
      setSettlements(prev);
    }
  };

  const addMember = async (name: string) => {
    setError(null);
    try {
      const res = await fetch("/api/split", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "addMember", payload: { name } }),
      });
      const data = await res.json();
      if (data.members) setMembers(data.members);
    } catch {
      setError("Kunde inte lägga till resenär");
    }
  };

  const renameMember = async (id: string, name: string) => {
    setError(null);
    const prev = members;
    setBusy(true);
    setMembers((p) => p.map((m) => (m.id === id ? { ...m, name } : m)));
    try {
      const res = await fetch("/api/split", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "renameMember", payload: { id, name } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kunde inte byta namn");
      if (data.members) setMembers(data.members);
    } catch (e) {
      setMembers(prev);
      setError(e instanceof Error ? e.message : "Kunde inte byta namn");
    } finally {
      setBusy(false);
    }
  };

  const deleteMember = async (id: string, force = false) => {
    setError(null);
    const prev = members;
    setBusy(true);
    setMembers((p) => p.filter((m) => m.id !== id));
    try {
      const res = await fetch("/api/split", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deleteMember", payload: { id, force } }),
      });
      const data = await res.json();
      if (res.status === 409 && data.error === "MEMBER_IN_USE") {
        setMembers(prev);
        setBusy(false);
        const n = Number(data.refs) || 0;
        if (window.confirm(`Den här resenären är med i ${n} utgift(er). Ta bort ändå? Utgifterna ligger kvar oförändrade.`)) {
          await deleteMember(id, true);
        }
        return;
      }
      if (!res.ok) throw new Error(data.error || "Kunde inte ta bort resenär");
      if (data.members) setMembers(data.members);
    } catch (e) {
      setMembers(prev);
      setError(e instanceof Error ? e.message : "Kunde inte ta bort resenär");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="dela" className="py-16 sm:py-24 px-5 max-w-3xl mx-auto">
      <div className="text-center reveal">
        <p className="micro text-amber mb-2">Vem är skyldig vem</p>
        <h2 className="font-display text-3xl sm:text-5xl font-bold text-ink">Dela notan</h2>
        <div className="fancy-rule w-32 mx-auto mt-4" />
        <p className="text-warm text-sm sm:text-base max-w-xl mx-auto mt-4">
          Lägg in vem som betalat vad så räknar vi ut hur ni gör upp – med så få swishar som möjligt.
        </p>
      </div>

      <div className="mt-8 card p-1.5 reveal flex gap-1">
        {([
          ["saldo", "Saldon"],
          ["lista", `Utgifter${expenses.length ? ` (${expenses.length})` : ""}`],
          ["lagg-till", "+ Lägg till"],
        ] as [Tab, string][]).map(([id, label]) => (
          <button
            key={id}
            onClick={() => {
              if (id !== "lagg-till") setEditing(null);
              setTab(id);
            }}
            className={`flex-1 py-2.5 rounded-xl text-[0.78rem] font-semibold transition-colors cursor-pointer ${
              tab === id ? "bg-amber text-white" : "text-warm hover:bg-tag"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-wine/10 border border-wine/40 p-3 text-[0.78rem] text-wine flex items-center justify-between gap-3">
          <span>{error}</span>
          <button
            onClick={() => load()}
            className="shrink-0 px-2.5 py-1 rounded-full bg-wine/20 text-wine text-[0.7rem] font-semibold hover:bg-wine/30 transition-colors cursor-pointer"
          >
            Försök igen
          </button>
        </div>
      )}

      <div className="mt-5">
        {loading ? (
          <div className="flex items-center gap-3 py-10 justify-center text-warm text-sm">
            <div className="w-4 h-4 border-2 border-amber/30 border-t-amber rounded-full animate-spin" />
            Laddar…
          </div>
        ) : tab === "saldo" ? (
          <BalancesView
            members={members}
            balances={balances}
            greedy={greedy}
            settlements={settlements}
            total={total}
            busy={busy}
            nameOf={nameOf}
            colorOf={colorOf}
            onAddMember={addMember}
            onRenameMember={renameMember}
            onDeleteMember={deleteMember}
            onSettle={addSettlement}
            onUnsettle={deleteSettlement}
          />
        ) : tab === "lista" ? (
          <ExpenseList
            expenses={expenses}
            nameOf={nameOf}
            colorOf={colorOf}
            onDelete={deleteExpense}
            onEdit={(e) => {
              setEditing(e);
              setTab("lagg-till");
            }}
            onAdd={() => {
              setEditing(null);
              setTab("lagg-till");
            }}
          />
        ) : (
          <AddExpenseForm
            members={members}
            editing={editing}
            onSubmit={submitExpense}
            onDelete={(id) => {
              setEditing(null);
              setTab("saldo");
              deleteExpense(id);
            }}
          />
        )}
      </div>
    </section>
  );
}

function Avatar({ member }: { member: Member }) {
  return (
    <span
      className="w-8 h-8 rounded-full flex items-center justify-center text-[0.7rem] font-bold font-mono text-white shrink-0"
      style={{ backgroundColor: member.color }}
    >
      {member.name.slice(0, 2).toUpperCase()}
    </span>
  );
}

function BalancesView({
  members,
  balances,
  greedy,
  settlements,
  total,
  busy,
  nameOf,
  colorOf,
  onAddMember,
  onRenameMember,
  onDeleteMember,
  onSettle,
  onUnsettle,
}: {
  members: Member[];
  balances: Record<string, number>;
  greedy: Settlement[];
  settlements: SettlementRecord[];
  total: number;
  busy: boolean;
  nameOf: (id: string) => string;
  colorOf: (id: string) => string;
  onAddMember: (name: string) => void;
  onRenameMember: (id: string, name: string) => void;
  onDeleteMember: (id: string, force?: boolean) => void;
  onSettle: (p: { from: string; to: string; amount: number }) => void;
  onUnsettle: (id: string) => void;
}) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const max = Math.max(1, ...members.map((m) => Math.abs(balances[m.id] || 0)));

  const commitRename = (m: Member) => {
    const name = draftName.trim();
    if (name && name !== m.name) onRenameMember(m.id, name);
    setEditingId(null);
  };

  return (
    <div className="space-y-5 reveal">
      <div className="card-warm p-4 text-center">
        <p className="text-[0.65rem] uppercase tracking-[0.2em] text-warm">Totalt spenderat</p>
        <p className="font-display text-3xl font-bold text-amber mt-1 font-mono">{kr(total)}</p>
      </div>

      <div className="card p-4 space-y-3">
        <p className="text-[0.7rem] uppercase tracking-[0.2em] text-warm mb-1">Saldon</p>
        {members.map((m) => {
          const net = Math.round((balances[m.id] || 0) * 100) / 100;
          const pos = net >= 0;
          return (
            <div key={m.id} className="flex items-center gap-3">
              <Avatar member={m} />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                  <span className="text-sm text-ink truncate">{m.name}</span>
                  <span className={`text-sm font-semibold font-mono ${pos ? "text-price" : "text-wine"}`}>
                    {pos ? "+" : ""}
                    {kr(net)}
                  </span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-tag overflow-hidden">
                  <div
                    className={`h-full rounded-full grow-x ${pos ? "bg-price" : "bg-wine"}`}
                    style={{ width: `${(Math.abs(net) / max) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card p-4">
        <p className="text-[0.7rem] uppercase tracking-[0.2em] text-warm mb-3">Gör upp</p>
        {greedy.length === 0 ? (
          <p className="text-warm text-sm text-center py-3">Allt är jämnt – inga skulder. 🎉</p>
        ) : (
          <ul className="space-y-2">
            {greedy.map((s, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className="font-medium" style={{ color: colorOf(s.from) }}>{nameOf(s.from)}</span>
                <span className="text-faint">→</span>
                <span className="font-medium" style={{ color: colorOf(s.to) }}>{nameOf(s.to)}</span>
                <span className="ml-auto font-semibold text-amber font-mono">{kr(s.amount)}</span>
                <button
                  onClick={() => onSettle({ from: s.from, to: s.to, amount: s.amount })}
                  className="shrink-0 bg-amber text-white rounded-full px-3 py-1 text-[0.7rem] font-semibold hover:bg-amber-deep transition-colors cursor-pointer"
                >
                  Markera betald
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card p-4">
        <p className="text-[0.7rem] uppercase tracking-[0.2em] text-warm mb-3">Betalningar</p>
        {settlements.length === 0 ? (
          <p className="text-warm text-sm text-center py-3">Inga betalningar gjorda än.</p>
        ) : (
          <ul className="space-y-2">
            {settlements.map((s) => (
              <li key={s.id} className="flex items-center gap-2 text-sm">
                <span className="font-medium" style={{ color: colorOf(s.from) }}>{nameOf(s.from)}</span>
                <span className="text-faint">→</span>
                <span className="font-medium" style={{ color: colorOf(s.to) }}>{nameOf(s.to)}</span>
                {s.note && <span className="text-warm text-[0.72rem] truncate">· {s.note}</span>}
                <span className="ml-auto font-semibold text-amber font-mono">{kr(s.amount)}</span>
                <button
                  onClick={() => onUnsettle(s.id)}
                  className="shrink-0 text-[0.65rem] text-faint hover:text-wine transition-colors cursor-pointer"
                >
                  ångra
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card p-4">
        <p className="text-[0.7rem] uppercase tracking-[0.2em] text-warm mb-3">Resenärer</p>
        <div className="space-y-2">
          {members.map((m) => {
            const hasBalance = Math.abs(balances[m.id] || 0) > 0.009;
            const isEditing = editingId === m.id;
            return (
              <div key={m.id} className="flex items-center gap-3">
                <Avatar member={m} />
                {isEditing ? (
                  <input
                    autoFocus
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename(m);
                      else if (e.key === "Escape") setEditingId(null);
                    }}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-panel text-ink text-sm border border-line outline-none focus:border-amber placeholder:text-faint"
                  />
                ) : (
                  <span className="flex-1 text-sm text-ink truncate">
                    {m.name}
                    {hasBalance && (
                      <span className="ml-1.5 text-amber" title="Har ett saldo – gör upp först">⚠</span>
                    )}
                  </span>
                )}
                {isEditing ? (
                  <>
                    <button
                      onClick={() => commitRename(m)}
                      disabled={busy}
                      title="Byt namn"
                      className="text-warm hover:text-amber transition-colors cursor-pointer disabled:opacity-40"
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      title="Avbryt"
                      className="text-warm hover:text-ink transition-colors cursor-pointer"
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setEditingId(m.id);
                        setDraftName(m.name);
                      }}
                      disabled={busy}
                      title="Byt namn"
                      className="text-faint hover:text-amber transition-colors cursor-pointer disabled:opacity-40"
                    >
                      ✎
                    </button>
                    {members.length > 1 && (
                      <button
                        onClick={() => onDeleteMember(m.id)}
                        disabled={busy}
                        title="Ta bort resenär"
                        className="text-faint hover:text-wine transition-colors cursor-pointer disabled:opacity-40"
                      >
                        ✕
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex gap-2 mt-3">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newName.trim()) {
                onAddMember(newName.trim());
                setNewName("");
              }
            }}
            placeholder="Namn…"
            className="flex-1 px-3 py-2 rounded-lg bg-panel text-ink text-sm border border-line outline-none focus:border-amber placeholder:text-faint"
          />
          <button
            onClick={() => {
              if (newName.trim()) {
                onAddMember(newName.trim());
                setNewName("");
              }
            }}
            disabled={!newName.trim()}
            className="px-4 py-2 rounded-lg bg-amber text-white text-sm font-bold hover:bg-amber-deep transition-colors cursor-pointer disabled:opacity-40"
          >
            Lägg till
          </button>
        </div>
      </div>
    </div>
  );
}

function ExpenseList({
  expenses,
  nameOf,
  colorOf,
  onDelete,
  onEdit,
  onAdd,
}: {
  expenses: Expense[];
  nameOf: (id: string) => string;
  colorOf: (id: string) => string;
  onDelete: (id: string) => void;
  onEdit: (e: Expense) => void;
  onAdd: () => void;
}) {
  if (expenses.length === 0) {
    return (
      <div className="card text-center py-12 reveal">
        <span className="text-4xl block mb-3">🧾</span>
        <p className="text-sm text-warm mb-4">Inga utgifter ännu.</p>
        <button onClick={onAdd} className="px-4 py-2 rounded-lg bg-amber text-white text-sm font-bold hover:bg-amber-deep transition-colors cursor-pointer">
          Lägg till första utgiften
        </button>
      </div>
    );
  }

  return (
    <ul className="space-y-2 reveal">
      {expenses.map((e) => {
        const meta = catMeta(e.category);
        const splitLabel =
          e.breakdown && e.splitMode === "exact"
            ? "exakt fördelat"
            : e.breakdown && e.splitMode === "shares"
              ? "delat i andelar"
              : `delat på ${e.participants.length}`;
        return (
          <li key={e.id} className="card p-3 flex items-center gap-3">
            <span className="w-10 h-10 rounded-full bg-tag flex items-center justify-center text-lg shrink-0">{meta.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-ink font-medium truncate">{e.description}</p>
              <p className="text-[0.72rem] text-warm">
                <span style={{ color: colorOf(e.paidBy) }}>{nameOf(e.paidBy)}</span> betalade · {splitLabel}
                {e.updatedAt && <span className="text-faint"> · ändrad</span>}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-semibold text-amber font-mono">{kr(e.amount)}</p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => onEdit(e)}
                  className="text-[0.65rem] text-faint hover:text-amber transition-colors cursor-pointer"
                >
                  ändra
                </button>
                <button
                  onClick={() => onDelete(e.id)}
                  className="text-[0.65rem] text-faint hover:text-wine transition-colors cursor-pointer"
                >
                  ta bort
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function AddExpenseForm({
  members,
  editing,
  onSubmit,
  onDelete,
}: {
  members: Member[];
  editing: Expense | null;
  onSubmit: (p: ExpenseFormPayload) => void;
  onDelete: (id: string) => void;
}) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState(members[0]?.id || "");
  const [participants, setParticipants] = useState<string[]>(members.map((m) => m.id));
  const [category, setCategory] = useState("food");
  const [mode, setMode] = useState<SplitMode>("equal");
  const [exact, setExact] = useState<Record<string, string>>({});
  const [shares, setShares] = useState<Record<string, number>>({});

  // Hydrate from `editing` (or reset to defaults when leaving edit mode).
  useEffect(() => {
    if (editing) {
      setDescription(editing.description);
      setAmount(String(editing.amount));
      setPaidBy(editing.paidBy);
      setParticipants(editing.participants);
      setCategory(editing.category);
      const m = editing.splitMode ?? "equal";
      setMode(editing.breakdown ? m : "equal");
      const ex: Record<string, string> = {};
      if (editing.breakdown) for (const id of editing.participants) ex[id] = String(editing.breakdown[id] ?? 0);
      setExact(ex);
      const sh: Record<string, number> = {};
      if (editing.shares) for (const id of editing.participants) sh[id] = editing.shares[id] ?? 1;
      setShares(sh);
    } else {
      setDescription("");
      setAmount("");
      setPaidBy(members[0]?.id || "");
      setParticipants(members.map((m) => m.id));
      setCategory("food");
      setMode("equal");
      setExact({});
      setShares({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.id]);

  useEffect(() => {
    // keep paidBy valid + default-select everyone when the member list changes
    if (!members.some((m) => m.id === paidBy)) setPaidBy(members[0]?.id || "");
    setParticipants((prev) => {
      const ids = members.map((m) => m.id);
      const kept = prev.filter((p) => ids.includes(p));
      return kept.length ? kept : ids;
    });
  }, [members, paidBy]);

  const amt = parseFloat(amount.replace(",", ".")) || 0;
  const baseValid = !!description.trim() && amt > 0 && !!paidBy && participants.length > 0;

  const exactSum =
    Math.round(
      participants.reduce((s, id) => s + (parseFloat((exact[id] || "0").replace(",", ".")) || 0), 0) * 100,
    ) / 100;
  const shareWeights: Record<string, number> = {};
  for (const id of participants) shareWeights[id] = shares[id] ?? 1;
  const positiveShares = participants.filter((id) => (shareWeights[id] ?? 0) > 0);

  const modeValid =
    mode === "equal"
      ? true
      : mode === "exact"
        ? Math.round(exactSum * 100) === Math.round(amt * 100)
        : positiveShares.length > 0;
  const valid = baseValid && modeValid;

  const equalPreview = baseValid ? splitEqual(amt, participants) : {};
  const perHead = baseValid && participants.length ? equalPreview[participants[0]] ?? amt / participants.length : 0;
  const sharePreview = amt > 0 && positiveShares.length ? resolveShares(shareWeights, amt) : {};

  const toggle = (id: string) =>
    setParticipants((prev) => {
      if (prev.includes(id)) {
        setExact((e) => { const n = { ...e }; delete n[id]; return n; });
        setShares((s) => { const n = { ...s }; delete n[id]; return n; });
        return prev.filter((p) => p !== id);
      }
      setExact((e) => ({ ...e, [id]: "0" }));
      setShares((s) => ({ ...s, [id]: 1 }));
      return [...prev, id];
    });

  const nameOf = (id: string) => members.find((m) => m.id === id)?.name || "Okänd";

  const handleSubmit = () => {
    if (!valid) return;
    const payload: ExpenseFormPayload = {
      description: description.trim(),
      amount: Math.round(amt * 100) / 100,
      paidBy,
      participants,
      category,
      splitMode: mode,
    };
    if (mode === "exact") {
      const ex: Record<string, number> = {};
      for (const id of participants) ex[id] = Math.round((parseFloat((exact[id] || "0").replace(",", ".")) || 0) * 100) / 100;
      payload.exact = ex;
    } else if (mode === "shares") {
      payload.shares = { ...shareWeights };
    }
    if (editing) {
      payload.id = editing.id;
      payload.createdAt = editing.createdAt;
    }
    onSubmit(payload);
  };

  return (
    <div className="card p-5 space-y-4 reveal">
      <p className="text-[0.7rem] uppercase tracking-[0.2em] text-warm">{editing ? "Redigera utgift" : "Ny utgift"}</p>
      <div>
        <label className="text-[0.7rem] uppercase tracking-[0.18em] text-warm">Vad?</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="t.ex. Middag, taxi, hotell…"
          className="mt-1 w-full px-3 py-2.5 rounded-lg bg-panel text-ink text-sm border border-line outline-none focus:border-amber placeholder:text-faint"
        />
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-[0.7rem] uppercase tracking-[0.18em] text-warm">Belopp (kr)</label>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="0"
            className="mt-1 w-full px-3 py-2.5 rounded-lg bg-panel text-ink text-lg font-semibold font-mono border border-line outline-none focus:border-amber placeholder:text-faint"
          />
        </div>
        <div className="flex-1">
          <label className="text-[0.7rem] uppercase tracking-[0.18em] text-warm">Vem betalade?</label>
          <select
            value={paidBy}
            onChange={(e) => setPaidBy(e.target.value)}
            className="mt-1 w-full px-3 py-2.5 rounded-lg bg-panel text-ink text-sm border border-line outline-none focus:border-amber"
          >
            {members.map((m) => (
              <option key={m.id} value={m.id} className="bg-card">{m.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="text-[0.7rem] uppercase tracking-[0.18em] text-warm">Kategori</label>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={`px-2.5 py-1.5 rounded-full text-[0.72rem] border transition-colors cursor-pointer ${
                category === c.id ? "bg-amber text-white border-transparent" : "text-warm border-line hover:bg-tag"
              }`}
            >
              {c.emoji} {c.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-[0.7rem] uppercase tracking-[0.18em] text-warm">Fördelning</label>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {([
            ["equal", "Lika"],
            ["exact", "Exakt"],
            ["shares", "Andelar"],
          ] as [SplitMode, string][]).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setMode(id)}
              className={`px-2.5 py-1.5 rounded-full text-[0.72rem] border transition-colors cursor-pointer ${
                mode === id ? "bg-amber text-white border-transparent" : "text-warm border-line hover:bg-tag"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="text-[0.7rem] uppercase tracking-[0.18em] text-warm">Delas mellan</label>
          <button
            onClick={() => {
              if (participants.length === members.length) {
                setParticipants([]);
                setExact({});
                setShares({});
              } else {
                setParticipants(members.map((m) => m.id));
                setExact(() => { const n: Record<string, string> = {}; members.forEach((m) => (n[m.id] = exact[m.id] ?? "0")); return n; });
                setShares(() => { const n: Record<string, number> = {}; members.forEach((m) => (n[m.id] = shares[m.id] ?? 1)); return n; });
              }
            }}
            className="text-[0.65rem] text-amber hover:text-amber-deep cursor-pointer"
          >
            {participants.length === members.length ? "Avmarkera alla" : "Markera alla"}
          </button>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {members.map((m) => {
            const on = participants.includes(m.id);
            return (
              <button
                key={m.id}
                onClick={() => toggle(m.id)}
                className={`px-3 py-1.5 rounded-full text-[0.74rem] font-medium border transition-all cursor-pointer ${
                  on ? "text-white border-transparent" : "text-warm border-line bg-panel"
                }`}
                style={on ? { backgroundColor: m.color } : undefined}
              >
                {m.name}
              </button>
            );
          })}
        </div>
      </div>

      {mode === "equal" && valid && (
        <p className="text-[0.78rem] text-warm text-center">
          <span className="font-mono">{kr(perHead)}</span> per person · {participants.length} st
        </p>
      )}

      {mode === "exact" && participants.length > 0 && (
        <div className="space-y-2">
          <p className="text-[0.7rem] uppercase tracking-[0.18em] text-warm">Belopp per person (kr)</p>
          {participants.map((id) => (
            <div key={id} className="flex items-center gap-3">
              <span className="flex-1 text-sm text-ink truncate">{nameOf(id)}</span>
              <input
                value={exact[id] ?? ""}
                onChange={(e) => setExact((prev) => ({ ...prev, [id]: e.target.value }))}
                inputMode="decimal"
                placeholder="0"
                className="w-20 px-2.5 py-2 rounded-lg bg-panel text-ink text-sm font-mono border border-line outline-none focus:border-amber placeholder:text-faint"
              />
            </div>
          ))}
          {amt > 0 && Math.round(exactSum * 100) === Math.round(amt * 100) ? (
            <p className="text-[0.78rem] text-price text-center font-mono">Fördelat {kr(exactSum)} av {kr(amt)}</p>
          ) : (
            <p className="text-[0.78rem] text-wine text-center font-mono">
              Fördelat {kr(exactSum)} av {kr(amt)} ·{" "}
              {exactSum < amt ? `${kr(amt - exactSum)} kvar att fördela` : `${kr(exactSum - amt)} för mycket`}
            </p>
          )}
        </div>
      )}

      {mode === "shares" && participants.length > 0 && (
        <div className="space-y-2">
          {participants.map((id) => {
            const v = shareWeights[id] ?? 1;
            return (
              <div key={id} className="flex items-center gap-3">
                <span className="flex-1 text-sm text-ink truncate">{nameOf(id)}</span>
                <button
                  onClick={() => setShares((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 1) - 1) }))}
                  className="w-7 h-7 rounded-full bg-panel border border-line text-amber cursor-pointer hover:bg-tag transition-colors"
                >
                  −
                </button>
                <span className="w-6 text-center text-sm text-ink font-mono">{v}</span>
                <button
                  onClick={() => setShares((prev) => ({ ...prev, [id]: (prev[id] ?? 1) + 1 }))}
                  className="w-7 h-7 rounded-full bg-panel border border-line text-amber cursor-pointer hover:bg-tag transition-colors"
                >
                  +
                </button>
              </div>
            );
          })}
          {amt > 0 && positiveShares.length > 0 && (
            <div className="space-y-0.5 pt-1">
              {participants.map((id) => {
                const w = shareWeights[id] ?? 0;
                return (
                  <p
                    key={id}
                    className={`text-[0.74rem] text-center ${w > 0 ? "text-warm" : "text-faint"}`}
                  >
                    {nameOf(id)}: <span className="font-mono">{kr(w > 0 ? sharePreview[id] ?? 0 : 0)}</span> ({w} delar)
                  </p>
                );
              })}
            </div>
          )}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={!valid}
        className="w-full py-3 rounded-xl bg-amber text-white font-bold hover:bg-amber-deep transition-colors cursor-pointer disabled:opacity-40"
      >
        {editing ? "Spara ändringar" : "Lägg till utgift"}
      </button>

      {editing && (
        <button
          onClick={() => onDelete(editing.id)}
          className="w-full text-[0.78rem] text-wine hover:text-wine/80 transition-colors cursor-pointer"
        >
          Ta bort
        </button>
      )}
    </div>
  );
}
