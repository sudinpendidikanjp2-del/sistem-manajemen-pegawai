import { PageBody, PageHeader } from '@/components/app/page-header';
import { EmptyState } from '@/components/app/empty-state';
import { requirePage } from '@/lib/guard';
import { personMap } from '@/lib/services/assessment-mapping';
import { monthText } from '@/lib/services/performance';
import { unitOptions } from '@/lib/services/units';
import { AddMany, AssignmentList, PersonSearch } from './person-forms';

export const metadata = { title: 'Atur Penilai per Orang' };

export default async function PersonPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requirePage(['assess.manage']);
  const { id } = await params;
  const { e } = await searchParams;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(e ?? '') ? e! : null;
  const [data, units] = await Promise.all([uuid ? personMap(actor, id, uuid) : null, unitOptions(actor, 'assess.manage')]);
  const unitList = units.map((u) => ({ id: u.id, name: u.name }));
  const closed = data?.period.isClosed ?? false;
  const crumbs = [{ href: '/kinerja/periode', label: 'Kelola Penilaian' }, { href: `/kinerja/periode/${id}/penilai`, label: 'Penilai' }, { label: 'Per orang' }];
  return (
    <>
      <PageHeader title="Atur penilai per orang" description="Pilih satu pegawai, lalu lihat dan atur siapa yang menilainya serta siapa yang ia nilai. Bisa memilih banyak orang sekaligus, per unit atau dari hasil pencarian." crumbs={crumbs} />
      <PageBody className="grid gap-6">
        <PersonSearch periodId={id} current={uuid} />
        {!data ? (
          <div className="rounded-xl border bg-card"><EmptyState title="Belum ada pegawai dipilih" description="Cari nama atau NIP di atas. Contoh: pilih Kepala Seksi, lalu tambahkan semua staf seksinya sebagai orang yang ia nilai." /></div>
        ) : (
          <>
            <div className="rounded-xl border bg-card px-4 py-3 lg:px-6">
              <p className="text-lg font-semibold">{data.employee.fullName}</p>
              <p className="text-sm text-muted-foreground">{[data.employee.employeeNumber, data.employee.position, data.employee.unit?.name].filter(Boolean).join(' · ') || '-'}. Periode {monthText(data.period.month)}{closed ? ', sudah ditutup (hanya lihat)' : ''}.</p>
            </div>
            <div className="grid items-start gap-6 lg:grid-cols-2">
              <section className="overflow-hidden rounded-xl border bg-card" aria-labelledby="dinilai-oleh">
                <h2 id="dinilai-oleh" className="border-b px-4 py-3 font-semibold lg:px-6">Dinilai oleh <span className="font-normal text-muted-foreground tabular-nums">({data.assessedBy.length})</span></h2>
                <AssignmentList periodId={id} closed={closed} empty="Belum ada yang menilai pegawai ini." rows={data.assessedBy.map((a) => ({ id: a.id, role: a.role, source: a.source, status: a.status, person: a.assessor }))} />
                {!closed && (
                  <div className="border-t">
                    <p className="px-4 pt-4 text-sm font-medium lg:px-6">Tambah penilai untuk {data.employee.fullName}</p>
                    <AddMany periodId={id} personId={data.employee.id} mode="assessors" units={unitList} already={data.assessedBy.map((a) => a.assessor.id)} hasBoss={data.assessedBy.some((a) => a.role === 'ATASAN')} />
                  </div>
                )}
              </section>
              <section className="overflow-hidden rounded-xl border bg-card" aria-labelledby="menilai">
                <h2 id="menilai" className="border-b px-4 py-3 font-semibold lg:px-6">Menilai <span className="font-normal text-muted-foreground tabular-nums">({data.assesses.length})</span></h2>
                <AssignmentList periodId={id} closed={closed} empty="Pegawai ini belum ditugaskan menilai siapa pun." rows={data.assesses.map((a) => ({ id: a.id, role: a.role, source: a.source, status: a.status, person: a.target }))} />
                {!closed && (data.employee.hasAccount ? (
                  <div className="border-t">
                    <p className="px-4 pt-4 text-sm font-medium lg:px-6">Tambah pegawai yang dinilai oleh {data.employee.fullName}</p>
                    <AddMany periodId={id} personId={data.employee.id} mode="targets" units={unitList} already={data.assesses.map((a) => a.target.id)} hasBoss={false} />
                  </div>
                ) : <p className="border-t px-4 py-3 text-sm text-muted-foreground lg:px-6">Pegawai ini belum punya akun, jadi belum bisa menilai. Buat akunnya di menu Pengguna.</p>)}
              </section>
            </div>
          </>
        )}
      </PageBody>
    </>
  );
}
