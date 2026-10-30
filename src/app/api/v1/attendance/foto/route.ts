import { z } from 'zod';
import { body, route } from '@/lib/api';
import { photoAttendance } from '@/lib/services/attendance';

export const POST = route({ perm: 'attendance.self' }, async ({ req, actor }) => photoAttendance(actor, await body(req, z.unknown()), req.headers.get('user-agent')));
