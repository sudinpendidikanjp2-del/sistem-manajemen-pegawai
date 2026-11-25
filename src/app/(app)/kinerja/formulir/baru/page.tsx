import { requirePage } from '@/lib/guard';
import { PageBody, PageHeader } from '@/components/app/page-header';
import { listForms } from '@/lib/services/assessment-forms';
import { unitOptions } from '@/lib/services/units';
import { scopeOf } from '@/lib/auth/actor';
import { DEFAULT_FORM } from '@/lib/assessment/forms';
import { FormEditor } from '../editor';

export const metadata = { title: 'Buat Formulir Penilaian' };

export default async function NewFormPage() {
  const actor = await requirePage(['assess.manage']);
  const [forms, units] = await Promise.all([listForms(actor), unitOptions(actor, 'assess.manage')]);
  const taken = Object.fromEntries(forms.flatMap((f) => f.units.map((u) => [u.id, f.name])));
  return (
    <>
      <PageHeader title="Buat formulir penilaian" description="Mulai dari salinan formulir bawaan, lalu ubah indikatornya sesuai kebutuhan unit." crumbs={[{ href: '/kinerja/formulir', label: 'Formulir Penilaian' }, { label: 'Baru' }]} />
      <PageBody className="max-w-4xl">
        {!scopeOf(actor, 'assess.manage')?.all
          ? <p className="rounded-lg border bg-muted px-4 py-3 text-sm">Hanya pengelola dengan cakupan seluruh unit yang bisa membuat formulir.</p>
          : <FormEditor initial={{ id: null, name: '', description: '', passScore: DEFAULT_FORM.passScore, groups: DEFAULT_FORM.groups, unitIds: [], includeSubunits: true }} units={units.map((u) => ({ id: u.id, name: u.name }))} taken={taken} />}
      </PageBody>
    </>
  );
}
