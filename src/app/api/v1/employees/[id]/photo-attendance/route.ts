import { z } from 'zod';
import { body, route } from '@/lib/api';
import { setPhotoAttendance } from '@/lib/services/bulk';

export const PUT = route<{ id: string }>({ perm: 'employee.write' }, async ({ req, actor, params }) => {
  const v = await body(req, z.object({ enabled: z.boolean() }));
  const r = await setPhotoAttendance(actor, [params.id], v.enabled);
  return { ok: true, changed: r.done > 0 };
});
