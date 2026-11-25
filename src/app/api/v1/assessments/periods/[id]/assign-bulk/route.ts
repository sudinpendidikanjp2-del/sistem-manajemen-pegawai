import { z } from 'zod';
import { body, route } from '@/lib/api';
import { bulkAssign } from '@/lib/services/assessment-mapping';

export const POST = route<{ id: string }>({ perm: 'assess.manage', rate: { key: 'assessbulk', limit: 60, windowMs: 600_000 } }, async ({ req, actor, params }) => bulkAssign(actor, params.id, await body(req, z.unknown())));
