// Formulir penilaian per unit kerja dan pemetaan penilai per orang. Data fiktif.
import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { openPeriod, periodResults, submitAssessment, getAssignment } from '@/lib/services/assessment';
import { createForm, deleteForm, formForUnit, setFormUnits, updateForm } from '@/lib/services/assessment-forms';
import { bulkAssign, personMap, removeAssignments } from '@/lib/services/assessment-mapping';
import { DEFAULT_FORM, formKeys } from '@/lib/assessment/forms';
import { todayIn } from '@/lib/time';
import { actorOf, seedFixture } from './helpers';

let f: Awaited<ReturnType<typeof seedFixture>>;
let periodId: string;
let formId: string;
const month = todayIn('Asia/Jakarta').slice(0, 7);
const groups = [
  { key: 'g1', title: 'Pelayanan', items: [{ key: 'a1', text: 'Ramah kepada tamu' }, { key: 'a2', text: 'Tepat waktu' }] },
  { key: 'g2', title: 'Kebersihan', items: [{ key: 'b1', text: 'Area kerja bersih' }] },
];

beforeAll(async () => {
  f = await seedFixture();
  const admin = await actorOf(f.users.admin.id);
  periodId = (await openPeriod(admin, { month, peerCount: 0 })).id;
  formId = (await createForm(admin, { name: 'Formulir Unit A', description: 'Uji', passScore: 80, groups })).id;
});

describe('formulir per unit', () => {
  it('menolak kode indikator kembar dan nama ganda', async () => {
    const admin = await actorOf(f.users.admin.id);
    const dup = [{ key: 'g1', title: 'X', items: [{ key: 'a', text: 'satu' }, { key: 'a', text: 'dua' }] }];
    await expect(createForm(admin, { name: 'Kembar', groups: dup })).rejects.toBeTruthy();
    await expect(createForm(admin, { name: 'formulir unit a', groups })).rejects.toMatchObject({ status: 409 });
  });

  it('unit tanpa formulir memakai bawaan; sub-unit ikut bila diatur', async () => {
    const admin = await actorOf(f.users.admin.id);
    expect((await formForUnit(f.unitA.id)).id).toBeNull();
    await setFormUnits(admin, formId, { unitIds: [f.unitA.id], includeSubunits: true });
    expect((await formForUnit(f.unitA.id)).id).toBe(formId);
    expect((await formForUnit(f.unitA1.id)).id).toBe(formId);
    expect((await formForUnit(f.unitB.id)).id).toBeNull();
    await setFormUnits(admin, formId, { unitIds: [f.unitA.id], includeSubunits: false });
    expect((await formForUnit(f.unitA1.id)).id).toBeNull();
    await setFormUnits(admin, formId, { unitIds: [f.unitA.id], includeSubunits: true });
  });

  it('pegawai unit A dinilai dengan formulir unit; unit B dengan formulir bawaan', async () => {
    const admin = await actorOf(f.users.admin.id);
    await bulkAssign(admin, periodId, { targetIds: [f.stafA.id], assessorIds: [f.stafB.id] });
    await bulkAssign(admin, periodId, { targetIds: [f.stafB.id], assessorIds: [f.stafA.id] });
    const a = await prisma.assessmentAssignment.findFirstOrThrow({ where: { periodId, targetEmployeeId: f.stafA.id, assessorEmployeeId: f.stafB.id } });
    const b = await prisma.assessmentAssignment.findFirstOrThrow({ where: { periodId, targetEmployeeId: f.stafB.id, assessorEmployeeId: f.stafA.id } });
    const assessorB = await actorOf(f.users.stafBUser.id);
    const assessorA = await actorOf(f.users.stafAUser.id);
    const ga = await getAssignment(assessorB, a.id);
    expect(formKeys(ga.form)).toEqual(['a1', 'a2', 'b1']);
    expect(formKeys((await getAssignment(assessorA, b.id)).form)).toEqual(formKeys(DEFAULT_FORM));
    // Indikator bawaan tidak diterima untuk formulir unit.
    await expect(submitAssessment(assessorB, a.id, { scores: Object.fromEntries(formKeys(DEFAULT_FORM).map((k) => [k, 90])) })).rejects.toMatchObject({ status: 422 });
    const r = await submitAssessment(assessorB, a.id, { scores: { a1: 90, a2: 70, b1: 80 } });
    expect(r.average).toBe(80);
    expect(r.predicate).toBe('Baik');
    const saved = await prisma.assessmentAssignment.findUniqueOrThrow({ where: { id: a.id } });
    expect((saved.formSnapshot as { name: string }).name).toBe('Formulir Unit A');
  });

  it('mengubah formulir tidak merusak hasil yang sudah dikirim', async () => {
    const admin = await actorOf(f.users.admin.id);
    await updateForm(admin, formId, { name: 'Formulir Unit A', passScore: 95, groups: [{ key: 'g9', title: 'Baru', items: [{ key: 'z1', text: 'Indikator baru' }] }] });
    const { results } = await periodResults(admin, periodId);
    const row = results.find((x) => x.employee.id === f.stafA.id)!;
    expect(row.average).toBe(80);
    expect(row.predicate).toBe('Baik');
    expect(row.form.passScore).toBe(80);
    expect(Object.keys(row.final).sort()).toEqual(['a1', 'a2', 'b1']);
  });

  it('hapus formulir mengembalikan unit ke bawaan', async () => {
    const admin = await actorOf(f.users.admin.id);
    await deleteForm(admin, formId);
    expect((await formForUnit(f.unitA.id)).id).toBeNull();
    expect(await prisma.assessmentFormUnit.count()).toBe(0);
  });

  it('pengelola unit tertentu tidak boleh membuat formulir', async () => {
    const op = await actorOf(f.users.operatorB.id);
    await expect(createForm(op, { name: 'Tidak boleh', groups })).rejects.toBeTruthy();
  });
});

describe('pemetaan per orang', () => {
  it('banyak penilai untuk satu pegawai, melewati diri sendiri dan duplikat', async () => {
    const admin = await actorOf(f.users.admin.id);
    const r = await bulkAssign(admin, periodId, { targetIds: [f.kabidA.id], assessorIds: [f.stafA.id, f.stafB.id, f.kabidA.id] });
    expect(r.created).toBe(2);
    expect(r.skipped.diriSendiri).toBe(1);
    const again = await bulkAssign(admin, periodId, { targetIds: [f.kabidA.id], assessorIds: [f.stafA.id] });
    expect(again.created).toBe(0);
    expect(again.skipped.sudahAda).toBe(1);
  });

  it('satu penilai untuk banyak pegawai, dan tampilan dua arah', async () => {
    const admin = await actorOf(f.users.admin.id);
    await bulkAssign(admin, periodId, { targetIds: [f.stafA.id, f.stafB.id], assessorIds: [f.kabidA.id] });
    const m = await personMap(admin, periodId, f.kabidA.id);
    expect(m.assesses.map((x) => x.target.id).sort()).toEqual([f.stafA.id, f.stafB.id].sort());
    expect(m.assessedBy).toHaveLength(2);
  });

  it('atasan hanya satu orang dan satu per pegawai', async () => {
    const admin = await actorOf(f.users.admin.id);
    await expect(bulkAssign(admin, periodId, { targetIds: [f.stafB.id], assessorIds: [f.stafA.id, f.kabidA.id], role: 'ATASAN' })).rejects.toMatchObject({ status: 422 });
    const first = await bulkAssign(admin, periodId, { targetIds: [f.kabidA.id], assessorIds: [f.stafB.id], role: 'ATASAN' });
    expect(first.created + first.skipped.sudahAda).toBe(1);
  });

  it('hapus banyak penugasan: yang sudah dinilai dilewati', async () => {
    const admin = await actorOf(f.users.admin.id);
    const all = await prisma.assessmentAssignment.findMany({ where: { periodId } });
    const r = await removeAssignments(admin, periodId, { ids: all.map((a) => a.id) });
    const kept = all.filter((a) => a.status === 'SUBMITTED').length;
    expect(r.skipped).toBe(kept);
    expect(r.removed).toBe(all.length - kept);
  });
});
