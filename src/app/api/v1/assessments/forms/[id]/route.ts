import { z } from 'zod';
import { body, route } from '@/lib/api';
import { deleteForm, updateForm } from '@/lib/services/assessment-forms';

export const PUT = route<{ id: string }>({ perm: 'assess.manage' }, async ({ req, actor, params }) => {
  await updateForm(actor, params.id, await body(req, z.unknown()));
  return { ok: true };
});

export const DELETE = route<{ id: string }>({ perm: 'assess.manage' }, async ({ actor, params }) => {
  await deleteForm(actor, params.id);
  return { ok: true };
});
