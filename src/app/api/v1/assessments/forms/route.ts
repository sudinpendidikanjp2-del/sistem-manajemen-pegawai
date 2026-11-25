import { z } from 'zod';
import { body, route } from '@/lib/api';
import { createForm } from '@/lib/services/assessment-forms';

export const POST = route({ perm: 'assess.manage' }, async ({ req, actor }) => createForm(actor, await body(req, z.unknown())));
