import { z } from 'zod';
import { prisma } from '../db';
import { audit } from '../audit';
import { assertCan, employeeScopeWhere, type Actor } from '../auth/actor';
import { realUserId } from '../auth/system';
import { forbidden, unprocessable } from '../errors';
import { forgetTemplate } from '../biometric/templates';
import { assignRole, resetUserPassword, setUserActive } from './users';
import { getEmployeeInScope } from '../auth/actor';

export const MAX_BULK = 200;

export interface BulkOutcome {
  done: number;
  skipped: { name: string; reason: string }[];
  /** Hanya untuk reset password: kata sandi sementara yang dibuat, ditampilkan sekali. */
  credentials?: { name: string; username: string; password: string }[];
}

const ids = z.array(z.string().uuid()).min(1, 'Pilih minimal satu data').max(MAX_BULK, `Maksimal ${MAX_BULK} data sekali proses`);

export const bulkUserInput = z.discriminatedUnion('action', [
  z.object({ action: z.literal('role'), ids, roleId: z.string().uuid('Pilih peran'), unitId: z.string().uuid().nullable().optional(), includeSubunits: z.boolean().default(true) }),
  z.object({ action: z.literal('reset-password'), ids }),
  z.object({ action: z.literal('deactivate'), ids }),
  z.object({ action: z.literal('activate'), ids }),
]);
export const bulkEmployeeInput = z.discriminatedUnion('action', [
  z.object({ action: z.literal('delete'), ids, reason: z.string().trim().min(3, 'Alasan wajib diisi').max(300) }),
  z.object({ action: z.literal('photo-on'), ids }),
  z.object({ action: z.literal('photo-off'), ids }),
  // supervisorId null = kosongkan atasan.
  z.object({ action: z.literal('supervisor'), ids, supervisorId: z.string().uuid('Pilih atasan').nullable() }),
  z.object({ action: z.literal('role'), ids, roleId: z.string().uuid('Pilih peran'), unitId: z.string().uuid().nullable().optional(), includeSubunits: z.boolean().default(true) }),
  z.object({ action: z.literal('reset-password'), ids }),
  z.object({ action: z.literal('deactivate'), ids }),
  z.object({ action: z.literal('activate'), ids }),
]);

/** Jalankan satu aksi untuk tiap pengguna; yang gagal dicatat beserta alasannya, sisanya tetap diproses. */
async function eachUser(actor: Actor, userIds: string[], fn: (userId: string, label: string) => Promise<{ username: string; password: string } | void>): Promise<BulkOutcome> {
  const users = await prisma.user.findMany({ where: { id: { in: userIds }, deletedAt: null }, select: { id: true, username: true, employee: { select: { fullName: true } } } });
  const label = new Map(users.map((u) => [u.id, u.employee?.fullName ?? u.username]));
  const out: BulkOutcome = { done: 0, skipped: [] };
  for (const id of userIds) {
    const name = label.get(id) ?? 'Pengguna tidak ditemukan';
    try {
      const r = await fn(id, name);
      out.done += 1;
      if (r) (out.credentials ??= []).push({ name, ...r });
    } catch (err) {
      out.skipped.push({ name, reason: (err as Error).message });
    }
  }
  return out;
}

export async function bulkUsers(actor: Actor, raw: unknown): Promise<BulkOutcome> {
  assertCan(actor, 'user.manage');
  const v = bulkUserInput.parse(raw);
  const out = await runUserAction(actor, v.ids, v);
  await audit(actor, { action: `user.bulk_${v.action.replace('-', '_')}`, entityType: 'User', meta: { requested: v.ids.length, done: out.done, skipped: out.skipped.length } });
  return out;
}

type UserAction = z.infer<typeof bulkUserInput>;
function runUserAction(actor: Actor, userIds: string[], v: UserAction) {
  switch (v.action) {
    case 'role': return eachUser(actor, userIds, async (id) => { await assignRole(actor, id, { roleId: v.roleId, unitId: v.unitId ?? null, includeSubunits: v.includeSubunits }); });
    case 'reset-password': return eachUser(actor, userIds, async (id) => { const r = await resetUserPassword(actor, id); return { username: r.username, password: r.password }; });
    case 'deactivate': return eachUser(actor, userIds, async (id) => { await setUserActive(actor, id, false); });
    case 'activate': return eachUser(actor, userIds, async (id) => { await setUserActive(actor, id, true); });
  }
}

/** Aksi massal dari daftar pegawai. Aksi akun dijalankan pada akun milik pegawai terpilih; pegawai tanpa akun dilewati. */
export async function bulkEmployees(actor: Actor, raw: unknown): Promise<BulkOutcome> {
  const v = bulkEmployeeInput.parse(raw);
  if (v.action === 'delete') return deleteEmployees(actor, v.ids, v.reason);
  if (v.action === 'photo-on' || v.action === 'photo-off') return setPhotoAttendance(actor, v.ids, v.action === 'photo-on');
  if (v.action === 'supervisor') return setSupervisor(actor, v.ids, v.supervisorId);
  assertCan(actor, 'user.manage');
  const emps = await prisma.employee.findMany({ where: { AND: [{ id: { in: v.ids }, deletedAt: null }, employeeScopeWhere(actor, 'user.manage')] }, select: { id: true, fullName: true, user: { select: { id: true } } } });
  const withAccount = emps.filter((e) => e.user);
  const out = await runUserAction(actor, withAccount.map((e) => e.user!.id), v);
  for (const e of emps.filter((x) => !x.user)) out.skipped.push({ name: e.fullName, reason: 'Belum memiliki akun' });
  const missing = v.ids.length - emps.length;
  if (missing > 0) out.skipped.push({ name: `${missing} data`, reason: 'Tidak ditemukan atau di luar kewenangan Anda' });
  await audit(actor, { action: `user.bulk_${v.action.replace('-', '_')}`, entityType: 'Employee', meta: { requested: v.ids.length, done: out.done, skipped: out.skipped.length } });
  return out;
}

/**
 * Hapus data pegawai (hapus lunak): pegawai disembunyikan dari daftar, akun ditutup, wajah dihapus, dan NIP serta ID mesin
 * dibebaskan agar bisa dipakai lagi. Riwayat absensi dan audit tetap tersimpan.
 */
export async function deleteEmployees(actor: Actor, employeeIds: string[], reason: string): Promise<BulkOutcome> {
  assertCan(actor, 'employee.delete');
  const out: BulkOutcome = { done: 0, skipped: [] };
  for (const id of employeeIds) {
    let name = 'Pegawai';
    try {
      const emp = await getEmployeeInScope(actor, 'employee.delete', id);
      name = emp.fullName;
      if (emp.id === actor.employeeId) throw forbidden('Tidak bisa menghapus data pegawai milik akun sendiri.');
      const user = await prisma.user.findUnique({ where: { employeeId: emp.id }, include: { roles: { include: { role: true } } } });
      if (user?.roles.some((r) => r.role.code === 'SUPER_ADMIN')) throw forbidden('Pegawai ini memegang peran Super Admin; cabut perannya lebih dulu.');
      const suffix = `~hapus-${emp.id.slice(0, 8)}`;
      await prisma.$transaction(async (tx) => {
        await tx.employee.update({ where: { id: emp.id }, data: { deletedAt: new Date(), isActive: false, employeeNumber: emp.employeeNumber ? `${emp.employeeNumber}${suffix}` : null, machinePin: null } });
        if (user) {
          await tx.user.update({ where: { id: user.id }, data: { deletedAt: new Date(), isActive: false, username: `${user.username}${suffix}` } });
          await tx.session.deleteMany({ where: { userId: user.id } });
          await tx.userRole.deleteMany({ where: { userId: user.id } });
        }
        const templates = await tx.employeeBiometric.findMany({ where: { employeeId: emp.id, status: { in: ['ACTIVE', 'PENDING_VERIFICATION'] } }, select: { id: true } });
        await tx.employeeBiometric.updateMany({ where: { id: { in: templates.map((t) => t.id) } }, data: { status: 'REVOKED', templateEnc: 'DIHAPUS', revokedAt: new Date(), revokedById: realUserId(actor), revokedReason: 'Data pegawai dihapus' } });
        templates.forEach((t) => forgetTemplate(t.id));
        await audit(actor, { action: 'employee.delete', entityType: 'Employee', entityId: emp.id, before: { employeeNumber: emp.employeeNumber, machinePin: emp.machinePin, fullName: emp.fullName }, meta: { reason } }, tx);
      });
      out.done += 1;
    } catch (err) {
      out.skipped.push({ name, reason: (err as Error).message });
    }
  }
  if (!out.done && !out.skipped.length) throw unprocessable('Tidak ada data yang dihapus.');
  return out;
}

/**
 * Izinkan atau cabut absen foto (foto dan GPS tanpa pengenalan wajah) untuk pegawai terpilih.
 * Perubahan tercatat di audit log per pegawai.
 */
export async function setPhotoAttendance(actor: Actor, employeeIds: string[], enabled: boolean): Promise<BulkOutcome> {
  assertCan(actor, 'employee.write');
  const out: BulkOutcome = { done: 0, skipped: [] };
  for (const id of employeeIds) {
    let name = 'Pegawai';
    try {
      const emp = await getEmployeeInScope(actor, 'employee.write', id);
      name = emp.fullName;
      if (emp.photoAttendance === enabled) { out.skipped.push({ name, reason: enabled ? 'Sudah diizinkan' : 'Memang belum diizinkan' }); continue; }
      await prisma.employee.update({ where: { id }, data: { photoAttendance: enabled } });
      await audit(actor, { action: enabled ? 'employee.photo_attendance_on' : 'employee.photo_attendance_off', entityType: 'Employee', entityId: id, before: { photoAttendance: emp.photoAttendance }, after: { photoAttendance: enabled } });
      out.done += 1;
    } catch (err) {
      out.skipped.push({ name, reason: (err as Error).message });
    }
  }
  return out;
}

/**
 * Tetapkan (atau kosongkan) atasan langsung untuk banyak pegawai. Dilewati: pegawai itu sendiri, yang atasannya sudah sama,
 * dan yang akan membuat rantai atasan berputar (atasan baru ternyata bawahan pegawai itu). Tercatat di audit per pegawai.
 */
export async function setSupervisor(actor: Actor, employeeIds: string[], supervisorId: string | null): Promise<BulkOutcome> {
  assertCan(actor, 'employee.write');
  const out: BulkOutcome = { done: 0, skipped: [] };
  let boss: { id: string; fullName: string } | null = null;
  if (supervisorId) {
    const b = await getEmployeeInScope(actor, 'employee.read', supervisorId);
    if (!b.isActive) throw unprocessable('Atasan yang dipilih sudah nonaktif.', { supervisorId: 'Pilih pegawai aktif' });
    boss = { id: b.id, fullName: b.fullName };
  }
  // Peta atasan saat ini, untuk mendeteksi putaran: naik dari atasan baru, jangan sampai bertemu pegawai yang diubah.
  const all = await prisma.employee.findMany({ where: { deletedAt: null }, select: { id: true, supervisorId: true } });
  const up = new Map(all.map((e) => [e.id, e.supervisorId]));
  const loops = (id: string) => {
    const seen = new Set<string>();
    for (let cur = boss?.id ?? null; cur && !seen.has(cur); cur = up.get(cur) ?? null) {
      if (cur === id) return true;
      seen.add(cur);
    }
    return false;
  };
  for (const id of employeeIds) {
    let name = 'Pegawai';
    try {
      const emp = await getEmployeeInScope(actor, 'employee.write', id);
      name = emp.fullName;
      if (boss && emp.id === boss.id) { out.skipped.push({ name, reason: 'Tidak bisa menjadi atasan diri sendiri' }); continue; }
      if ((emp.supervisorId ?? null) === (boss?.id ?? null)) { out.skipped.push({ name, reason: boss ? 'Atasannya sudah sama' : 'Memang belum punya atasan' }); continue; }
      if (boss && loops(emp.id)) { out.skipped.push({ name, reason: `${boss.fullName} adalah bawahannya, rantai atasan akan berputar` }); continue; }
      await prisma.employee.update({ where: { id }, data: { supervisorId: boss?.id ?? null } });
      up.set(id, boss?.id ?? null);
      await audit(actor, { action: 'employee.supervisor_bulk', entityType: 'Employee', entityId: id, before: { supervisorId: emp.supervisorId ?? null }, after: { supervisorId: boss?.id ?? null } });
      out.done += 1;
    } catch (err) {
      out.skipped.push({ name, reason: (err as Error).message });
    }
  }
  return out;
}
