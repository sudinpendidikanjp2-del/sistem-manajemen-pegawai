import { z } from 'zod';
import { body, route } from '@/lib/api';
import { bulkEmployees } from '@/lib/services/bulk';

// Izin tiap aksi diperiksa di layanan (hapus: employee.delete; aksi akun: user.manage; absen foto: employee.write).
export const POST = route({ perm: ['employee.delete', 'user.manage', 'employee.write'], rate: { key: 'bulkemp', limit: 30, windowMs: 600_000 } }, async ({ req, actor }) => bulkEmployees(actor, await body(req, z.unknown())));
