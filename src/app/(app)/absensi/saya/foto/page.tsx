import Link from 'next/link';
import { Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageBody, PageHeader } from '@/components/app/page-header';
import { EmptyState } from '@/components/app/empty-state';
import { PhotoCheck } from '@/components/app/photo-check';
import { requirePage } from '@/lib/guard';
import { prisma } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { fmtJam, todayIn, toDbDate } from '@/lib/time';

export const metadata = { title: 'Absen Foto' };

export default async function PhotoAttendancePage() {
  const actor = await requirePage(['attendance.self']);
  if (!actor.employeeId) return <PageBody><EmptyState title="Akun tidak terhubung dengan data pegawai" description="Absen hanya untuk akun pegawai." /></PageBody>;
  const s = await getSettings();
  const tz = s['org.timezone'];
  const today = todayIn(tz);
  const [emp, rec] = await Promise.all([
    prisma.employee.findUniqueOrThrow({ where: { id: actor.employeeId }, select: { fullName: true, employeeNumber: true, photoAttendance: true, isActive: true } }),
    prisma.attendanceRecord.findUnique({ where: { employeeId_workDate: { employeeId: actor.employeeId, workDate: toDbDate(today) } } }),
  ]);
  const suggested = rec?.checkInAt && !rec.checkOutAt ? 'OUT' : 'IN';
  return (
    <>
      <PageHeader
        title="Absen Foto"
        description={rec?.checkInAt ? `Hari ini masuk ${fmtJam(rec.checkInAt, tz)}${rec.checkOutAt ? `, pulang ${fmtJam(rec.checkOutAt, tz)}` : ''}.` : 'Belum ada absen hari ini.'}
        actions={<><Button asChild variant="outline"><Link href="/absensi/saya/absen">Absen wajah</Link></Button><Button asChild variant="outline"><Link href="/absensi/saya">Rekap presensi</Link></Button></>}
      />
      <PageBody className="grid max-w-5xl gap-4">
        {!emp.isActive ? <EmptyState title="Status pegawai nonaktif" description="Absensi tidak bisa dicatat untuk pegawai nonaktif." />
          : !s['methods.photo'] ? <EmptyState icon={Camera} title="Absen foto sedang dinonaktifkan" description="Gunakan absen wajah, mesin absensi, atau minta petugas mencatat absensi Anda." actions={[{ href: '/absensi/saya/absen', label: 'Absen wajah', primary: true }]} />
          : !emp.photoAttendance ? <EmptyState icon={Camera} title="Absen foto belum diizinkan untuk akun Anda" description="Absen foto hanya untuk pegawai yang diizinkan admin kepegawaian. Hubungi admin bila Anda tidak bisa memakai absen wajah." actions={[{ href: '/absensi/saya/absen', label: 'Absen wajah', primary: true }]} />
          : <PhotoCheck employee={{ name: emp.fullName, nip: emp.employeeNumber }} org={s['org.name']} geocode={!!s['geo.reverseGeocode']} suggested={suggested} />}
      </PageBody>
    </>
  );
}
