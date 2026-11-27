import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageBody, PageHeader } from '@/components/app/page-header';
import { EmptyState } from '@/components/app/empty-state';
import { Segmented } from '@/components/app/segmented';
import { MonthStepper } from '@/components/app/month-stepper';
import { Pager, SortableHead, TableToolbar } from '@/components/app/pagination';
import { StatusBadge } from '@/components/app/status-badge';
import { requirePage } from '@/lib/guard';
import { clampPage, listSchema, qs, sortRows } from '@/lib/list';
import { teamRecap, type RecapRow } from '@/lib/services/reports';
import { getSetting } from '@/lib/settings';
import { BULAN, todayIn } from '@/lib/time';

export const metadata = { title: 'Kehadiran Tim' };

const SORTS = ['nama', 'hari', 'hadir', 'terlambat', 'dinas', 'izin', 'alfa', 'persen'] as const;
const schema = listSchema(SORTS, { sort: 'nama' });

export default async function TeamAttendancePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requirePage(['attendance.team']);
  const sp = await searchParams;
  const indirect = sp.tingkat === 'semua';
  const data = await teamRecap(actor, { month: sp.bulan, indirect });
  const l = schema.parse(sp);
  const key: Record<(typeof SORTS)[number], (r: RecapRow) => string | number | null> = {
    nama: (r) => r.name, hari: (r) => r.scheduledDays, hadir: (r) => r.present, terlambat: (r) => r.lateMinutes, dinas: (r) => r.fieldDuty,
    izin: (r) => r.permit + r.sick + r.leave, alfa: (r) => r.alfa, persen: (r) => r.attendancePct,
  };
  const sorted = sortRows(data.rows, key[l.sort], l.dir);
  const page = clampPage(l.page, l.per, sorted.length);
  const rows = sorted.slice((page - 1) * l.per, page * l.per);
  const params = { bulan: data.month, tingkat: indirect ? 'semua' : undefined, sort: sp.sort, dir: sp.dir, per: sp.per };
  const sortProps = { sort: l.sort, dir: l.dir, params };
  const num = { align: 'right' as const, firstDir: 'desc' as const };
  const label = `${BULAN[Number(data.month.slice(5, 7)) - 1]} ${data.month.slice(0, 4)}`;
  const today = todayIn(await getSetting('org.timezone')).slice(0, 7);
  return (
    <>
      <PageHeader
        title="Kehadiran tim"
        description={`Persentase kehadiran bawahan Anda selama ${label}. Dihitung dari hari kerja yang sudah lewat: hadir, terlambat, dan dinas luar dihitung hadir; izin, sakit, cuti, dan alfa tidak.`}
        actions={<MonthStepper value={data.month} href={qs({ ...params, bulan: '__bulan__', page: undefined }).replace('%5F%5Fbulan%5F%5F', '__bulan__')} max={today} />}
      />
      <PageBody className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented label="Cakupan bawahan" current={indirect ? 'semua' : 'langsung'} className="w-fit"
            items={[['langsung', 'Bawahan langsung'], ['semua', 'Termasuk tidak langsung']].map(([k, t]) => ({ key: k, label: t, href: qs({ ...params, tingkat: k === 'semua' ? 'semua' : undefined, page: undefined }) }))} />
          <dl className="flex gap-6 text-sm">
            <div><dt className="text-muted-foreground">Jumlah bawahan</dt><dd className="text-xl font-semibold tabular-nums">{data.summary.people}</dd></div>
            <div><dt className="text-muted-foreground">Rata-rata kehadiran</dt><dd className="text-xl font-semibold tabular-nums">{data.summary.average == null ? '-' : `${data.summary.average}%`}</dd></div>
          </dl>
        </div>
        <div className="rounded-xl border bg-card">
          {data.rows.length === 0 ? (
            <EmptyState title="Belum ada bawahan" description="Pegawai muncul di sini bila Anda ditetapkan sebagai atasan langsungnya di data pegawai." />
          ) : (
            <>
              <TableToolbar {...sortProps} sorts={[{ value: 'nama', label: 'Nama' }, { value: 'persen', label: 'Kehadiran' }, { value: 'terlambat', label: 'Menit terlambat' }, { value: 'alfa', label: 'Alfa' }]}>
                <span className="tabular-nums">{data.rows.length}</span> pegawai
              </TableToolbar>
              <Table className="table-stack stack-grid">
                <TableHeader><TableRow>
                  <SortableHead label="Pegawai" value="nama" {...sortProps} className="pl-4 lg:pl-6" />
                  <SortableHead label="Hari kerja" value="hari" {...sortProps} {...num} />
                  <SortableHead label="Hadir" value="hadir" {...sortProps} {...num} />
                  <SortableHead label="Terlambat" value="terlambat" {...sortProps} {...num} />
                  <SortableHead label="Dinas luar" value="dinas" {...sortProps} {...num} />
                  <SortableHead label="Izin/sakit/cuti" value="izin" {...sortProps} {...num} />
                  <SortableHead label="Alfa" value="alfa" {...sortProps} {...num} />
                  <TableHead className="w-44">Kehadiran</TableHead>
                  <SortableHead label="%" value="persen" {...sortProps} {...num} className="pr-4 lg:pr-6" />
                </TableRow></TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.employeeId}>
                      <TableCell className="stack-head pl-4 lg:pl-6"><span className="font-medium">{r.name}</span><span className="block text-xs text-muted-foreground">{[r.employeeNumber, r.unit].filter(Boolean).join(' · ')}</span></TableCell>
                      <TableCell data-label="Hari kerja" className="tabular md:text-right">{r.scheduledDays}</TableCell>
                      <TableCell data-label="Hadir" className="tabular md:text-right">{r.present}</TableCell>
                      <TableCell data-label="Terlambat" className="tabular md:text-right">{r.late}{r.lateMinutes ? <span className="block text-xs text-muted-foreground">{r.lateMinutes} mnt</span> : null}</TableCell>
                      <TableCell data-label="Dinas luar" className="tabular md:text-right">{r.fieldDuty}</TableCell>
                      <TableCell data-label="Izin/sakit/cuti" className="tabular md:text-right">{r.permit + r.sick + r.leave}</TableCell>
                      <TableCell data-label="Alfa" className="tabular md:text-right">{r.alfa ? <StatusBadge status="ALFA" label={String(r.alfa)} /> : 0}</TableCell>
                      <TableCell data-label="Kehadiran" className="max-md:hidden">
                        {r.attendancePct == null ? <span className="text-muted-foreground">Belum ada hari kerja</span> : (
                          <span className="block h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${r.attendancePct} persen`}><span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(100, r.attendancePct)}%` }} /></span>
                        )}
                      </TableCell>
                      <TableCell data-label="Persen" className="pr-4 font-semibold tabular md:text-right lg:pr-6">{r.attendancePct == null ? '-' : `${r.attendancePct}%`}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pager total={data.rows.length} page={page} pageSize={l.per} params={params} />
            </>
          )}
        </div>
      </PageBody>
    </>
  );
}
