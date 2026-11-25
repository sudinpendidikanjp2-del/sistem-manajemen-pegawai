'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, CircleDashed, Trash2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { api, useAction } from '@/components/app/api-client';
import { confirmDialog } from '@/components/app/confirm-dialog';
import { EmployeePicker, fetchEmployeeOptions, type EmployeeOption } from '@/components/app/employee-picker';
import { cn } from '@/lib/utils';

const base = (id: string) => `/api/v1/assessments/periods/${id}`;

/** Pilih pegawai yang ingin diatur, lalu pindah ke halaman pegawai itu. */
export function PersonSearch({ periodId, current }: { periodId: string; current: string | null }) {
  const router = useRouter();
  return (
    <div className="grid max-w-xl gap-2">
      <Label htmlFor="person">Cari pegawai</Label>
      <EmployeePicker id="person" name="person" purpose="dinilai" emptyLabel="Ketik nama atau NIP" onChange={(id) => { if (id && id !== current) router.push(`/kinerja/periode/${periodId}/penilai/orang?e=${id}`); }} />
    </div>
  );
}

type Row = { id: string; role: string; source: string; status: 'PENDING' | 'SUBMITTED'; person: { fullName: string; employeeNumber: string | null; unit: { name: string } | null } };

/** Daftar penugasan yang ada, bisa dicentang untuk dihapus selama belum dinilai. */
export function AssignmentList({ periodId, rows, empty, closed }: { periodId: string; rows: Row[]; empty: string; closed: boolean }) {
  const { pending, run } = useAction();
  const [sel, setSel] = useState<string[]>([]);
  const removable = rows.filter((r) => r.status === 'PENDING');
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  if (rows.length === 0) return <p className="px-4 py-3 text-sm text-muted-foreground lg:px-6">{empty}</p>;
  return (
    <div>
      {!closed && removable.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2 text-sm lg:px-6">
          <Button type="button" variant="ghost" size="sm" onClick={() => setSel(sel.length === removable.length ? [] : removable.map((r) => r.id))}>{sel.length === removable.length ? 'Kosongkan pilihan' : 'Pilih semua yang belum menilai'}</Button>
          <Button type="button" variant="outline" size="sm" className="text-destructive hover:text-destructive" disabled={!sel.length || pending}
            onClick={async () => {
              if (!(await confirmDialog({ title: `Hapus ${sel.length} penugasan?`, description: 'Penugasan yang dicentang dihapus. Penilaian yang sudah dikirim tidak terpengaruh.', confirmLabel: 'Hapus', destructive: true }))) return;
              const r = await run(() => api<{ removed: number }>('POST', `${base(periodId)}/unassign-bulk`, { ids: sel }), { success: (x) => `${x.removed} penugasan dihapus.` });
              if (r) setSel([]);
            }}><Trash2 />Hapus yang dicentang ({sel.length})</Button>
        </div>
      )}
      <ul className="max-h-96 divide-y overflow-y-auto">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-sm lg:px-6">
            {!closed && r.status === 'PENDING' ? <Checkbox aria-label={`Pilih ${r.person.fullName}`} checked={sel.includes(r.id)} onCheckedChange={() => toggle(r.id)} /> : <span className="w-4 shrink-0" />}
            {r.status === 'SUBMITTED' ? <Check className="size-4 shrink-0 text-[#15803d]" aria-label="Sudah menilai" /> : <CircleDashed className="size-4 shrink-0 text-muted-foreground" aria-label="Belum menilai" />}
            <span className="min-w-0 flex-1"><span className="block truncate font-medium">{r.person.fullName}</span><span className="block truncate text-xs text-muted-foreground">{[r.person.employeeNumber, r.person.unit?.name].filter(Boolean).join(' · ')}</span></span>
            <span className="shrink-0 text-xs text-muted-foreground">{r.role === 'ATASAN' ? 'atasan' : r.source === 'AUTO' ? 'acak' : r.source === 'UNIT' ? 'unit' : 'manual'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Cari banyak pegawai (per unit atau nama), centang, lalu tugaskan sekaligus. */
export function AddMany({ periodId, personId, mode, units, already, hasBoss }: { periodId: string; personId: string; mode: 'assessors' | 'targets'; units: { id: string; name: string }[]; already: string[]; hasBoss: boolean }) {
  const { pending, error, run } = useAction();
  const [q, setQ] = useState('');
  const [unitId, setUnitId] = useState('');
  const [rows, setRows] = useState<EmployeeOption[] | null>(null);
  const [total, setTotal] = useState(0);
  const [sel, setSel] = useState<string[]>([]);
  const [role, setRole] = useState<'REKAN' | 'ATASAN'>('REKAN');
  const asAssessors = mode === 'assessors';
  const taken = useMemo(() => new Set([personId, ...already]), [personId, already]);

  useEffect(() => {
    let live = true;
    const t = setTimeout(async () => {
      try {
        const r = await fetchEmployeeOptions(asAssessors ? 'nilai' : 'dinilai', { q: q.trim() || undefined, unitId: unitId || undefined, limit: 300 });
        if (live) { setRows(r.rows); setTotal(r.total); }
      } catch { if (live) setRows([]); }
    }, q ? 250 : 0);
    return () => { live = false; clearTimeout(t); };
  }, [q, unitId, asAssessors]);

  const pickable = (rows ?? []).filter((e) => !taken.has(e.id));
  const allShown = pickable.length > 0 && pickable.every((e) => sel.includes(e.id));
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const effectiveRole = asAssessors && sel.length === 1 ? role : 'REKAN';

  async function submit() {
    const payload = asAssessors ? { targetIds: [personId], assessorIds: sel, role: effectiveRole } : { targetIds: sel, assessorIds: [personId], role: 'REKAN' };
    const r = await run(() => api<{ created: number; skipped: Record<string, number> }>('POST', `${base(periodId)}/assign-bulk`, payload), {
      success: (x) => {
        const sk = Object.values(x.skipped).reduce((a, b) => a + b, 0);
        return `${x.created} penugasan dibuat${sk ? `, ${sk} dilewati (sudah ada atau tidak boleh)` : ''}.`;
      },
    });
    if (r) setSel([]);
  }

  return (
    <div className="grid gap-3 p-4 lg:p-6">
      <div className="grid gap-3 sm:grid-cols-[2fr_1.4fr]">
        <div className="grid gap-1.5"><Label htmlFor={`q-${mode}`}>Cari nama atau NIP</Label><Input id={`q-${mode}`} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ketik untuk menyaring" /></div>
        <div className="grid gap-1.5"><Label htmlFor={`u-${mode}`}>Unit kerja</Label>
          <NativeSelect id={`u-${mode}`} value={unitId} onChange={(e) => setUnitId(e.target.value)}><NativeSelectOption value="">Semua unit</NativeSelectOption>{units.map((u) => <NativeSelectOption key={u.id} value={u.id}>{u.name}</NativeSelectOption>)}</NativeSelect>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Button type="button" variant="outline" size="sm" disabled={!pickable.length} onClick={() => setSel(allShown ? sel.filter((id) => !pickable.some((e) => e.id === id)) : [...new Set([...sel, ...pickable.map((e) => e.id)])])}>{allShown ? 'Batalkan yang tampil' : `Pilih semua yang tampil (${pickable.length})`}</Button>
        {sel.length > 0 && <Button type="button" variant="ghost" size="sm" onClick={() => setSel([])}>Kosongkan pilihan</Button>}
        <span className="text-muted-foreground tabular-nums">{rows ? `${rows.length} dari ${total} pegawai tampil` : 'Memuat...'}</span>
      </div>
      <ul className="max-h-72 divide-y overflow-y-auto rounded-lg border">
        {rows && rows.length === 0 && <li className="px-3 py-3 text-sm text-muted-foreground">Tidak ada pegawai yang cocok.</li>}
        {(rows ?? []).map((e) => {
          const off = taken.has(e.id);
          return (
            <li key={e.id} className={cn('flex items-center gap-3 px-3 py-2 text-sm', off && 'opacity-55')}>
              <Checkbox id={`${mode}-${e.id}`} checked={sel.includes(e.id)} disabled={off} onCheckedChange={() => toggle(e.id)} />
              <Label htmlFor={`${mode}-${e.id}`} className="block min-w-0 flex-1 font-normal"><span className="block truncate font-medium">{e.name}</span><span className="block truncate text-xs text-muted-foreground">{[e.nip, e.unit].filter(Boolean).join(' · ')}</span></Label>
              {off && <span className="shrink-0 text-xs text-muted-foreground">{e.id === personId ? 'orang ini' : 'sudah ditugaskan'}</span>}
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-end gap-3">
        {asAssessors && sel.length === 1 && (
          <div className="grid gap-1.5"><Label htmlFor="role-one">Sebagai</Label>
            <NativeSelect id="role-one" value={role} onChange={(e) => setRole(e.target.value as 'REKAN' | 'ATASAN')}><NativeSelectOption value="REKAN">Rekan</NativeSelectOption><NativeSelectOption value="ATASAN" disabled={hasBoss}>Atasan langsung{hasBoss ? ' (sudah ada)' : ''}</NativeSelectOption></NativeSelect>
          </div>
        )}
        <Button type="button" disabled={!sel.length || pending} onClick={submit}><UserPlus />{pending ? 'Menugaskan...' : asAssessors ? `Jadikan ${sel.length || ''} orang penilai` : `Tugaskan menilai ${sel.length || ''} orang`}</Button>
      </div>
      {error && <p className="text-sm font-medium text-destructive" role="alert">{error}</p>}
    </div>
  );
}

