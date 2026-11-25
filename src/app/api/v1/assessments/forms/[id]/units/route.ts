import { z } from 'zod';
import { body, route } from '@/lib/api';
import { setFormUnits } from '@/lib/services/assessment-forms';

export const PUT = route<{ id: string }>({ perm: 'assess.manage' }, async ({ req, actor, params }) => setFormUnits(actor, params.id, await body(req, z.unknown())));
