import { requirePage } from '@/lib/guard';
import { PageBody, PageHeader } from '@/components/app/page-header';
import { getForm, listForms } from '@/lib/services/assessment-forms';
import { unitOptions } from '@/lib/services/units';
import { scopeOf } from '@/lib/auth/actor';
import { FormEditor } from '../editor';

export const metadata = { title: 'Ubah Formulir Penilaian' };

export default async function EditFormPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePage(['assess.manage']);
  const { id } = await params;
  const [form, forms, units] = await Promise.all([getForm(actor, id), listForms(actor), unitOptions(actor, 'assess.manage')]);
  const taken = Object.fromEntries(forms.filter((f) => f.id !== id).flatMap((f) => f.units.map((u) => [u.id, f.name])));
  const canEdit = !!scopeOf(actor, 'assess.manage')?.all;
  return (
    <>
      <PageHeader title={form.name} description="Penilaian yang sudah dikirim menyimpan salinan formulirnya, jadi perubahan di sini hanya berlaku untuk penilaian berikutnya." crumbs={[{ href: '/kinerja/formulir', label: 'Formulir Penilaian' }, { label: form.name }]} />
      <PageBody className="max-w-4xl">
        {!canEdit && <p className="mb-4 rounded-lg border bg-muted px-4 py-3 text-sm">Anda hanya bisa melihat formulir ini.</p>}
        <FormEditor readOnly={!canEdit} initial={{ id: form.id, name: form.name, description: form.description ?? '', passScore: form.passScore, groups: form.groups, unitIds: form.units.map((u) => u.unitId), includeSubunits: form.units[0]?.includeSubunits ?? true }} units={units.map((u) => ({ id: u.id, name: u.name }))} taken={taken} />
      </PageBody>
    </>
  );
}
