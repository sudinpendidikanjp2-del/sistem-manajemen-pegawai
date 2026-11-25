import Link from 'next/link';
import { FilePlus2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageBody, PageHeader } from '@/components/app/page-header';
import { EmptyState } from '@/components/app/empty-state';
import { requirePage } from '@/lib/guard';
import { scopeOf } from '@/lib/auth/actor';
import { listForms } from '@/lib/services/assessment-forms';
import { DEFAULT_FORM, formKeys } from '@/lib/assessment/forms';

export const metadata = { title: 'Formulir Penilaian' };

export default async function FormsPage() {
  const actor = await requirePage(['assess.manage']);
  const forms = await listForms(actor);
  const canEdit = !!scopeOf(actor, 'assess.manage')?.all;
  return (
    <>
      <PageHeader
        title="Formulir Penilaian"
        description="Atur indikator penilaian kinerja untuk tiap unit kerja. Unit tanpa formulir sendiri memakai formulir bawaan."
        actions={canEdit ? <Button asChild><Link href="/kinerja/formulir/baru"><FilePlus2 />Buat formulir</Link></Button> : undefined}
      />
      <PageBody className="grid gap-4">
        {!canEdit && <p className="rounded-lg border bg-muted px-4 py-3 text-sm">Formulir hanya bisa diubah oleh pengelola dengan cakupan seluruh unit. Anda dapat melihat daftarnya.</p>}
        <div className="rounded-xl border bg-card">
          <Table className="table-stack">
            <TableHeader><TableRow><TableHead className="pl-4 lg:pl-6">Formulir</TableHead><TableHead>Indikator</TableHead><TableHead>Batas nilai Baik</TableHead><TableHead className="pr-4 lg:pr-6">Dipakai unit</TableHead></TableRow></TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="stack-head pl-4 lg:pl-6"><span className="font-medium">{DEFAULT_FORM.name}</span><span className="block text-xs text-muted-foreground">Bawaan sistem, tidak bisa diubah</span></TableCell>
                <TableCell data-label="Indikator" className="tabular">{formKeys(DEFAULT_FORM).length} dalam {DEFAULT_FORM.groups.length} kelompok</TableCell>
                <TableCell data-label="Batas nilai Baik" className="tabular">{DEFAULT_FORM.passScore}</TableCell>
                <TableCell data-label="Dipakai unit" className="pr-4 text-muted-foreground lg:pr-6">Semua unit yang tidak punya formulir sendiri</TableCell>
              </TableRow>
              {forms.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="stack-head pl-4 lg:pl-6"><Link href={`/kinerja/formulir/${f.id}`} className="font-medium text-primary hover:underline">{f.name}</Link>{f.description && <span className="block text-xs text-muted-foreground">{f.description}</span>}</TableCell>
                  <TableCell data-label="Indikator" className="tabular">{f.indicators} dalam {f.groups} kelompok</TableCell>
                  <TableCell data-label="Batas nilai Baik" className="tabular">{f.passScore}</TableCell>
                  <TableCell data-label="Dipakai unit" className="whitespace-normal pr-4 lg:pr-6">
                    {f.units.length === 0 ? <span className="text-muted-foreground">Belum dipasang ke unit</span> : f.units.map((u) => u.name + (u.includeSubunits ? ' (+ sub-unit)' : '')).join(', ')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {forms.length === 0 && <EmptyState title="Belum ada formulir sendiri" description="Buat formulir, lalu pasang ke unit kerja yang memakainya." />}
        </div>
      </PageBody>
    </>
  );
}
