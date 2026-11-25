import { z } from 'zod';
import { INDICATOR_GROUPS, PASS_SCORE, type IndicatorGroup } from './indicators';

/** Formulir penilaian: kelompok indikator dan batas nilai Baik. `id` kosong berarti formulir bawaan di kode. */
export interface FormDef {
  id: string | null;
  name: string;
  passScore: number;
  groups: IndicatorGroup[];
}

export const DEFAULT_FORM: FormDef = { id: null, name: 'Formulir bawaan', passScore: PASS_SCORE, groups: INDICATOR_GROUPS };

export const formKeys = (f: FormDef) => f.groups.flatMap((g) => g.items.map((i) => i.key));

const keySchema = z.string().trim().regex(/^[a-z0-9_-]{1,24}$/, 'Kode indikator tidak valid');

export const formInput = z.object({
  name: z.string().trim().min(3, 'Minimal 3 karakter').max(100, 'Maksimal 100 karakter'),
  description: z.string().trim().max(300, 'Maksimal 300 karakter').nullish().transform((v) => v || null),
  passScore: z.coerce.number().int().min(1, 'Minimal 1').max(100, 'Maksimal 100').default(PASS_SCORE),
  groups: z.array(z.object({
    key: keySchema,
    title: z.string().trim().min(1, 'Judul kelompok wajib diisi').max(120, 'Maksimal 120 karakter'),
    items: z.array(z.object({ key: keySchema, text: z.string().trim().min(1, 'Indikator wajib diisi').max(300, 'Maksimal 300 karakter') })).min(1, 'Setiap kelompok minimal 1 indikator').max(40, 'Maksimal 40 indikator per kelompok'),
  })).min(1, 'Minimal 1 kelompok').max(10, 'Maksimal 10 kelompok'),
}).superRefine((v, ctx) => {
  const keys = v.groups.flatMap((g) => g.items.map((i) => i.key));
  if (new Set(keys).size !== keys.length) ctx.addIssue({ code: 'custom', message: 'Kode indikator ada yang kembar', path: ['groups'] });
  if (keys.length > 60) ctx.addIssue({ code: 'custom', message: 'Maksimal 60 indikator per formulir', path: ['groups'] });
  if (new Set(v.groups.map((g) => g.key)).size !== v.groups.length) ctx.addIssue({ code: 'custom', message: 'Kode kelompok ada yang kembar', path: ['groups'] });
});

/** Baca formulir dari JSON tersimpan; JSON rusak atau kosong jatuh ke formulir bawaan. */
export function readForm(json: unknown, fallback: FormDef = DEFAULT_FORM): FormDef {
  if (!json || typeof json !== 'object') return fallback;
  const j = json as Partial<FormDef>;
  if (!Array.isArray(j.groups) || !j.groups.length) return fallback;
  return { id: j.id ?? null, name: j.name ?? fallback.name, passScore: typeof j.passScore === 'number' ? j.passScore : PASS_SCORE, groups: j.groups };
}
