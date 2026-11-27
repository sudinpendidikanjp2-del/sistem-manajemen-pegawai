// Kehadiran bawahan per bulan untuk atasan dan aksi massal atur atasan. Data fiktif.
import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { subordinateIds, teamRecap } from '@/lib/services/reports';
import { bulkEmployees } from '@/lib/services/bulk';
import { zonedToUtc } from '@/lib/time';
import { actorOf, pastWorkday, seedFixture } from './helpers';

let f: Awaited<ReturnType<typeof seedFixture>>;
const TZ = 'Asia/Jakarta';
const day = pastWorkday(1);
const month = day.slice(0, 7);

beforeAll(async () => {
  f = await seedFixture();
  await prisma.attendanceRecord.create({ data: { employeeId: f.stafA.id, workDate: new Date(`${day}T00:00:00Z`), checkInAt: zonedToUtc(day, '07:28', TZ), checkOutAt: zonedToUtc(day, '16:05', TZ), status: 'HADIR' } });
});

describe('kehadiran tim', () => {
  it('atasan melihat persentase bulanan bawahan langsungnya', async () => {
    const kabid = await actorOf(f.users.kabidUser.id);
    const r = await teamRecap(kabid, { month });
    expect(r.rows.map((x) => x.employeeId)).toEqual([f.stafA.id]);
    const row = r.rows[0];
    expect(row.present).toBe(1);
    expect(row.scheduledDays).toBeGreaterThan(0);
    expect(row.attendancePct).toBeCloseTo((1 / row.scheduledDays) * 100, 0);
    expect(r.summary.people).toBe(1);
  });

  it('pegawai tanpa izin tidak bisa membuka, dan bawahan tidak langsung opsional', async () => {
    const staf = await actorOf(f.users.stafAUser.id);
    await expect(teamRecap(staf, { month })).rejects.toMatchObject({ status: 403 });
    await prisma.employee.update({ where: { id: f.stafB.id }, data: { supervisorId: f.stafA.id } });
    expect(await subordinateIds(f.kabidA.id, false)).toEqual([f.stafA.id]);
    expect((await subordinateIds(f.kabidA.id, true)).sort()).toEqual([f.stafA.id, f.stafB.id].sort());
    const kabid = await actorOf(f.users.kabidUser.id);
    expect((await teamRecap(kabid, { month, indirect: true })).rows).toHaveLength(2);
    await prisma.employee.update({ where: { id: f.stafB.id }, data: { supervisorId: null } });
  });
});

describe('aksi massal atur atasan', () => {
  it('menetapkan atasan, melewati yang sudah sama, diri sendiri, dan putaran', async () => {
    const admin = await actorOf(f.users.admin.id);
    const r = await bulkEmployees(admin, { action: 'supervisor', ids: [f.stafB.id, f.stafA.id, f.kabidA.id], supervisorId: f.kabidA.id });
    // stafB berubah; stafA sudah punya atasan yang sama; kabid tidak bisa jadi atasan dirinya.
    expect(r.done).toBe(1);
    expect(r.skipped).toHaveLength(2);
    expect((await prisma.employee.findUniqueOrThrow({ where: { id: f.stafB.id } })).supervisorId).toBe(f.kabidA.id);
    const loop = await bulkEmployees(admin, { action: 'supervisor', ids: [f.kabidA.id], supervisorId: f.stafA.id });
    expect(loop.done).toBe(0);
    expect(loop.skipped[0].reason).toMatch(/berputar/);
  });

  it('mengosongkan atasan dan tercatat di audit', async () => {
    const admin = await actorOf(f.users.admin.id);
    const r = await bulkEmployees(admin, { action: 'supervisor', ids: [f.stafA.id, f.stafB.id], supervisorId: null });
    expect(r.done).toBe(2);
    expect((await prisma.employee.findUniqueOrThrow({ where: { id: f.stafA.id } })).supervisorId).toBeNull();
    expect(await prisma.auditLog.count({ where: { action: 'employee.supervisor_bulk' } })).toBe(3);
  });

  it('pengelola tanpa izin ubah pegawai ditolak', async () => {
    const staf = await actorOf(f.users.stafAUser.id);
    await expect(bulkEmployees(staf, { action: 'supervisor', ids: [f.stafB.id], supervisorId: null })).rejects.toMatchObject({ status: 403 });
  });
});
