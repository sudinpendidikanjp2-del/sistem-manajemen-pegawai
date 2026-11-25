'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Field, fieldProps } from '@/components/app/field';
import { api, useAction } from '@/components/app/api-client';
import { confirmDialog } from '@/components/app/confirm-dialog';

type Item = { key: string; text: string };
type Group = { key: string; title: string; items: Item[] };
interface Initial { id: string | null; name: string; description: string; passScore: number; groups: Group[]; unitIds: string[]; includeSubunits: boolean }

const uid = (p: string) => `${p}${Math.random().toString(36).slice(2, 8)}`;
const swap = <T,>(a: T[], i: number, j: number) => { const n = [...a]; [n[i], n[j]] = [n[j], n[i]]; return n; };

export function FormEditor({ initial, units, taken, readOnly = false }: { initial: Initial; units: { id: string; name: string }[]; taken: Record<string, string>; readOnly?: boolean }) {
  const router = useRouter();
  const { pending, fields, error, run } = useAction();
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [passScore, setPassScore] = useState(String(initial.passScore));
  const [groups, setGroups] = useState<Group[]>(initial.groups.map((g) => ({ ...g, items: g.items.map((i) => ({ ...i })) })));
  const [unitIds, setUnitIds] = useState<string[]>(initial.unitIds);
  const [sub, setSub] = useState(initial.includeSubunits);
  const [filter, setFilter] = useState('');
  const total = useMemo(() => groups.reduce((n, g) => n + g.items.length, 0), [groups]);
  const shown = units.filter((u) => u.name.toLowerCase().includes(filter.trim().toLowerCase()));

  const setGroup = (gi: number, fn: (g: Group) => Group) => setGroups((gs) => gs.map((g, i) => (i === gi ? fn(g) : g)));
  const toggleUnit = (id: string) => setUnitIds((u) => (u.includes(id) ? u.filter((x) => x !== id) : [...u, id]));

  async function save() {
    const payload = { name, description, passScore: Number(passScore), groups };
    const r = await run(async () => {
      const id = initial.id ?? (await api<{ id: string }>('POST', '/api/v1/assessments/forms', payload)).id;
      if (initial.id) await api('PUT', `/api/v1/assessments/forms/${id}`, payload);
      const u = await api<{ units: number; moved: number }>('PUT', `/api/v1/assessments/forms/${id}/units`, { unitIds, includeSubunits: sub });
      return { id, ...u };
    }, { success: (x) => `Formulir disimpan${x.moved ? `, ${x.moved} unit dipindahkan dari formulir lain` : ''}.`, refresh: false });
    if (r) { if (initial.id) router.refresh(); else router.push(`/kinerja/formulir/${r.id}`); }
  }

  async function remove() {
    if (!initial.id) return;
    if (!(await confirmDialog({ title: 'Hapus formulir ini?', description: 'Unit yang memakainya kembali ke formulir bawaan. Penilaian yang sudah dikirim tetap tersimpan lengkap dengan formulirnya.', confirmLabel: 'Hapus', destructive: true }))) return;
    const r = await run(() => api('DELETE', `/api/v1/assessments/forms/${initial.id}`), { success: 'Formulir dihapus.', refresh: false });
    if (r !== undefined) router.push('/kinerja/formulir');
  }

  return (
    <form className="grid gap-5" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <Card>
        <CardHeader><CardTitle>Identitas formulir</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-[2fr_1fr]">
          <Field id="name" label="Nama formulir" error={fields.name} required><Input {...fieldProps('name', fields.name)} value={name} onChange={(e) => setName(e.target.value)} disabled={readOnly} maxLength={100} placeholder="mis. Penilaian Petugas Kebersihan" /></Field>
          <Field id="passScore" label="Batas nilai Baik" error={fields.passScore} hint="Rata-rata di bawah angka ini Buruk."><Input {...fieldProps('passScore', fields.passScore)} type="number" min={1} max={100} value={passScore} onChange={(e) => setPassScore(e.target.value)} disabled={readOnly} className="w-24 tabular" /></Field>
          <div className="sm:col-span-2"><Field id="description" label="Keterangan (opsional)" error={fields.description}><Textarea {...fieldProps('description', fields.description)} rows={2} maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} disabled={readOnly} /></Field></div>
        </CardContent>
      </Card>

      <section className="grid gap-3" aria-label="Indikator">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Indikator penilaian <span className="ml-1 text-sm font-normal text-muted-foreground tabular-nums">{total} indikator</span></h2>
          {!readOnly && <Button type="button" variant="outline" size="sm" onClick={() => setGroups((g) => [...g, { key: uid('g'), title: '', items: [{ key: uid('i'), text: '' }] }])}><Plus />Tambah kelompok</Button>}
        </div>
        {fields.groups && <p className="text-sm font-medium text-destructive" role="alert">{fields.groups}</p>}
        {groups.map((g, gi) => (
          <Card key={g.key} className="gap-0 overflow-hidden py-0">
            <div className="flex flex-wrap items-center gap-2 border-b bg-muted px-4 py-2.5">
              <Input aria-label={`Judul kelompok ${gi + 1}`} value={g.title} onChange={(e) => setGroup(gi, (x) => ({ ...x, title: e.target.value }))} disabled={readOnly} placeholder="Judul kelompok, mis. Disiplin kehadiran" className="h-9 min-w-0 flex-1 bg-background font-medium" />
              {!readOnly && (
                <span className="flex">
                  <Button type="button" variant="ghost" size="icon" className="size-9" aria-label="Naikkan kelompok" disabled={gi === 0} onClick={() => setGroups((gs) => swap(gs, gi, gi - 1))}><ArrowUp /></Button>
                  <Button type="button" variant="ghost" size="icon" className="size-9" aria-label="Turunkan kelompok" disabled={gi === groups.length - 1} onClick={() => setGroups((gs) => swap(gs, gi, gi + 1))}><ArrowDown /></Button>
                  <Button type="button" variant="ghost" size="icon" className="size-9 text-destructive hover:text-destructive" aria-label="Hapus kelompok" disabled={groups.length === 1} onClick={() => setGroups((gs) => gs.filter((_, i) => i !== gi))}><Trash2 /></Button>
                </span>
              )}
            </div>
            <ul className="divide-y">
              {g.items.map((it, ii) => (
                <li key={it.key} className="flex items-center gap-2 px-4 py-2">
                  <span className="w-6 shrink-0 text-right text-sm text-muted-foreground tabular-nums">{groups.slice(0, gi).reduce((n, x) => n + x.items.length, 0) + ii + 1}</span>
                  <Input aria-label={`Indikator ${ii + 1} kelompok ${gi + 1}`} value={it.text} onChange={(e) => setGroup(gi, (x) => ({ ...x, items: x.items.map((y, k) => (k === ii ? { ...y, text: e.target.value } : y)) }))} disabled={readOnly} placeholder="Tulis indikator yang dinilai" className="h-9 min-w-0 flex-1" />
                  {!readOnly && (
                    <span className="flex">
                      <Button type="button" variant="ghost" size="icon" className="size-9" aria-label="Naikkan indikator" disabled={ii === 0} onClick={() => setGroup(gi, (x) => ({ ...x, items: swap(x.items, ii, ii - 1) }))}><ArrowUp /></Button>
                      <Button type="button" variant="ghost" size="icon" className="size-9" aria-label="Turunkan indikator" disabled={ii === g.items.length - 1} onClick={() => setGroup(gi, (x) => ({ ...x, items: swap(x.items, ii, ii + 1) }))}><ArrowDown /></Button>
                      <Button type="button" variant="ghost" size="icon" className="size-9 text-destructive hover:text-destructive" aria-label="Hapus indikator" disabled={g.items.length === 1} onClick={() => setGroup(gi, (x) => ({ ...x, items: x.items.filter((_, k) => k !== ii) }))}><Trash2 /></Button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {!readOnly && <div className="border-t px-4 py-2"><Button type="button" variant="ghost" size="sm" onClick={() => setGroup(gi, (x) => ({ ...x, items: [...x.items, { key: uid('i'), text: '' }] }))}><Plus />Tambah indikator</Button></div>}
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Unit kerja yang memakai formulir ini</CardTitle>
          <CardDescription>Pegawai di unit yang dicentang dinilai dengan formulir ini. Unit yang tadinya memakai formulir lain dipindahkan ke sini.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex items-start gap-3"><Checkbox id="sub" checked={sub} onCheckedChange={(v) => setSub(!!v)} disabled={readOnly} className="mt-0.5" /><Label htmlFor="sub" className="leading-snug font-normal">Berlaku juga untuk sub-unit yang tidak punya formulir sendiri</Label></div>
          <Input aria-label="Cari unit" type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Cari unit" className="max-w-sm" />
          <ul className="grid max-h-72 gap-1 overflow-y-auto rounded-lg border p-2 sm:grid-cols-2">
            {shown.map((u) => (
              <li key={u.id} className="flex items-start gap-2 rounded px-2 py-1.5 hover:bg-secondary/60">
                <Checkbox id={`u-${u.id}`} checked={unitIds.includes(u.id)} onCheckedChange={() => toggleUnit(u.id)} disabled={readOnly} className="mt-0.5" />
                <Label htmlFor={`u-${u.id}`} className="min-w-0 leading-snug font-normal">{u.name}{taken[u.id] && !unitIds.includes(u.id) && <span className="block text-xs text-muted-foreground">Saat ini: {taken[u.id]}</span>}{taken[u.id] && unitIds.includes(u.id) && <span className="block text-xs text-amber-700">Dipindahkan dari {taken[u.id]}</span>}</Label>
              </li>
            ))}
            {shown.length === 0 && <li className="px-2 py-1.5 text-sm text-muted-foreground">Tidak ada unit yang cocok.</li>}
          </ul>
          <p className="text-sm text-muted-foreground tabular-nums">{unitIds.length} unit dipilih</p>
        </CardContent>
      </Card>

      {(error || Object.keys(fields).length > 0) && (
        <div className="text-sm font-medium text-destructive" role="alert">
          {error && <p>{error}</p>}
          {Object.entries(fields).filter(([k]) => k.startsWith('groups.')).slice(0, 3).map(([k, v]) => <p key={k}>{v}</p>)}
        </div>
      )}
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="lg" disabled={pending}><Save />{pending ? 'Menyimpan...' : 'Simpan formulir'}</Button>
          {initial.id && <Button type="button" variant="outline" size="lg" className="text-destructive hover:text-destructive" disabled={pending} onClick={remove}><Trash2 />Hapus formulir</Button>}
          {unitIds.length === 0 && <span className="text-sm text-muted-foreground">Belum dipasang ke unit mana pun, jadi belum dipakai.</span>}
        </div>
      )}
    </form>
  );
}
