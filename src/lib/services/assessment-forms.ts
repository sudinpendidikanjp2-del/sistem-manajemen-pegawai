import { z } from 'zod';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '../db';
import { audit } from '../audit';
import { assertCan, scopeOf, type Actor } from '../auth/actor';
import { conflict, forbidden, notFound, unprocessable } from '../errors';
import { DEFAULT_FORM, formInput, readForm, type FormDef } from '../assessment/forms';

function assertManage(actor: Actor) {
  assertCan(actor, 'assess.manage');
  if (!scopeOf(actor, 'assess.manage')!.all) throw forbidden('Formulir penilaian hanya dikelola oleh pengelola dengan cakupan seluruh unit.');
}

const toDef = (f: { id: string; name: string; passScore: number; groups: unknown }): FormDef => ({ ...readForm({ groups: f.groups, name: f.name, passScore: f.passScore }), id: f.id, name: f.name, passScore: f.passScore });

/**
 * Formulir untuk tiap unit: unit itu sendiri, lalu induknya naik ke atas (bila induk diatur "termasuk sub-unit").
 * Unit tanpa formulir memakai formulir bawaan.
 */
export async function resolveForms(unitIds: (string | null)[]): Promise<Map<string | null, FormDef>> {
  const out = new Map<string | null, FormDef>();
  const [units, links] = await Promise.all([
    prisma.organizationUnit.findMany({ where: { deletedAt: null }, select: { id: true, parentId: true } }),
    prisma.assessmentFormUnit.findMany({ include: { form: true } }),
  ]);
  const parent = new Map(units.map((u) => [u.id, u.parentId]));
  const byUnit = new Map(links.map((l) => [l.unitId, l]));
  for (const id of new Set(unitIds)) {
    let found: FormDef = DEFAULT_FORM;
    let cur: string | null = id;
    let direct = true;
    const seen = new Set<string>();
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      const l = byUnit.get(cur);
      if (l && (direct || l.includeSubunits)) { found = toDef(l.form); break; }
      cur = parent.get(cur) ?? null;
      direct = false;
    }
    out.set(id, found);
  }
  return out;
}

export async function formForUnit(unitId: string | null) {
  return (await resolveForms([unitId])).get(unitId)!;
}

export async function listForms(actor: Actor) {
  assertCan(actor, 'assess.manage');
  const [forms, units] = await Promise.all([
    prisma.assessmentForm.findMany({ orderBy: { name: 'asc' }, include: { units: true } }),
    prisma.organizationUnit.findMany({ where: { deletedAt: null }, select: { id: true, name: true } }),
  ]);
  const name = new Map(units.map((u) => [u.id, u.name]));
  return forms.map((f) => {
    const def = toDef(f);
    return {
      id: f.id, name: f.name, description: f.description, passScore: f.passScore, updatedAt: f.updatedAt,
      groups: def.groups.length, indicators: def.groups.reduce((n, g) => n + g.items.length, 0),
      units: f.units.map((u) => ({ id: u.unitId, name: name.get(u.unitId) ?? '-', includeSubunits: u.includeSubunits })),
    };
  });
}

export async function getForm(actor: Actor, id: string) {
  assertCan(actor, 'assess.manage');
  const f = await prisma.assessmentForm.findUnique({ where: { id }, include: { units: true } });
  if (!f) throw notFound('Formulir tidak ditemukan.');
  return { ...toDef(f), description: f.description, units: f.units.map((u) => ({ unitId: u.unitId, includeSubunits: u.includeSubunits })) };
}

export async function createForm(actor: Actor, raw: unknown) {
  assertManage(actor);
  const v = formInput.parse(raw);
  if (await prisma.assessmentForm.findFirst({ where: { name: { equals: v.name, mode: 'insensitive' } } })) throw conflict('Nama formulir sudah dipakai.', { name: 'Sudah dipakai' });
  const f = await prisma.assessmentForm.create({ data: { name: v.name, description: v.description, passScore: v.passScore, groups: v.groups as Prisma.InputJsonValue, createdById: actor.userId } });
  await audit(actor, { action: 'assessment_form.create', entityType: 'AssessmentForm', entityId: f.id, meta: { name: v.name } });
  return { id: f.id };
}

/** Penilaian yang sudah dikirim menyimpan salinan formulirnya, jadi mengubah formulir tidak merusak hasil lama. */
export async function updateForm(actor: Actor, id: string, raw: unknown) {
  assertManage(actor);
  const v = formInput.parse(raw);
  if (!(await prisma.assessmentForm.findUnique({ where: { id } }))) throw notFound('Formulir tidak ditemukan.');
  if (await prisma.assessmentForm.findFirst({ where: { id: { not: id }, name: { equals: v.name, mode: 'insensitive' } } })) throw conflict('Nama formulir sudah dipakai.', { name: 'Sudah dipakai' });
  await prisma.assessmentForm.update({ where: { id }, data: { name: v.name, description: v.description, passScore: v.passScore, groups: v.groups as Prisma.InputJsonValue } });
  await audit(actor, { action: 'assessment_form.update', entityType: 'AssessmentForm', entityId: id, meta: { name: v.name } });
}

export async function deleteForm(actor: Actor, id: string) {
  assertManage(actor);
  const f = await prisma.assessmentForm.findUnique({ where: { id } });
  if (!f) throw notFound('Formulir tidak ditemukan.');
  await prisma.assessmentForm.delete({ where: { id } });
  await audit(actor, { action: 'assessment_form.delete', entityType: 'AssessmentForm', entityId: id, meta: { name: f.name } });
}

export const formUnitsInput = z.object({ unitIds: z.array(z.string().uuid()).max(500), includeSubunits: z.boolean().default(true) });

/** Tetapkan unit yang memakai formulir ini. Unit yang sebelumnya memakai formulir lain dipindahkan ke sini. */
export async function setFormUnits(actor: Actor, id: string, raw: unknown) {
  assertManage(actor);
  const v = formUnitsInput.parse(raw);
  const f = await prisma.assessmentForm.findUnique({ where: { id } });
  if (!f) throw notFound('Formulir tidak ditemukan.');
  const ids = [...new Set(v.unitIds)];
  const valid = await prisma.organizationUnit.count({ where: { id: { in: ids }, deletedAt: null } });
  if (valid !== ids.length) throw unprocessable('Ada unit yang tidak ditemukan.', { unitIds: 'Unit tidak valid' });
  const moved = await prisma.assessmentFormUnit.count({ where: { unitId: { in: ids }, formId: { not: id } } });
  await prisma.$transaction([
    prisma.assessmentFormUnit.deleteMany({ where: { OR: [{ formId: id }, { unitId: { in: ids } }] } }),
    prisma.assessmentFormUnit.createMany({ data: ids.map((unitId) => ({ formId: id, unitId, includeSubunits: v.includeSubunits })) }),
  ]);
  await audit(actor, { action: 'assessment_form.units', entityType: 'AssessmentForm', entityId: id, meta: { name: f.name, units: ids.length, moved, includeSubunits: v.includeSubunits } });
  return { units: ids.length, moved };
}
