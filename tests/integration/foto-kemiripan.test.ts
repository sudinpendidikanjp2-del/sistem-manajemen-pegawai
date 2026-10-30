// Aturan selisih wajah mirip dan absen foto + GPS. Data fiktif.
import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { enrollFace } from '@/lib/services/biometrics';
import { faceAttendance, photoAttendance } from '@/lib/services/attendance';
import { bulkEmployees } from '@/lib/services/bulk';
import { actorOf, seedFixture } from './helpers';

let f: Awaited<ReturnType<typeof seedFixture>>;
const base = Array.from({ length: 128 }, (_, i) => Math.sin(i * 1.3) / 5);
const dir = Array.from({ length: 128 }, (_, i) => Math.cos(i * 0.7));
const norm = Math.sqrt(dir.reduce((a, x) => a + x * x, 0));
/** Titik di garis A→B; t=0 persis A, t=1 persis B (jarak A–B = 0,6). */
const along = (t: number) => base.map((x, i) => x + (dir[i] / norm) * 0.6 * t);
const jitter = (d: number[], k: number) => d.map((x, i) => x + Math.cos(i + k) / 1000);
const q = { score: 0.95, faceWidthPx: 220, brightness: 120 };
const jpeg = `data:image/jpeg;base64,${Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1]), Buffer.alloc(120, 7), Buffer.from([0xff, 0xd9])]).toString('base64')}`;
let n = 0;
const key = () => `uji-fm-${String(++n).padStart(5, '0')}`;
const consent = { consentAccepted: true, consentVersion: '1' };

beforeAll(async () => {
  f = await seedFixture();
  const a = await actorOf(f.users.stafAUser.id);
  const b = await actorOf(f.users.stafBUser.id);
  await enrollFace(a, f.stafA.id, { descriptors: [along(0), jitter(along(0), 1), jitter(along(0), 2)], ...consent });
  await enrollFace(b, f.stafB.id, { descriptors: [along(1), jitter(along(1), 1), jitter(along(1), 2)], ...consent });
});

describe('selisih dengan pegawai yang wajahnya mirip', () => {
  it('wajah yang jelas lebih dekat ke satu pegawai tetap berhasil', async () => {
    const a = await actorOf(f.users.stafAUser.id);
    const r = await faceAttendance(a, 'FACE_SELF', { direction: 'IN', descriptor: jitter(along(0), 5), quality: q, idempotencyKey: key() }, 'vitest');
    expect(r.outcome).toBe('SUCCESS');
    const ev = await prisma.attendanceEvent.findUniqueOrThrow({ where: { id: r.eventId }, include: { verification: true } });
    expect(ev.verification?.runnerUpDistance).toBeGreaterThan(0.5);
  });

  it('wajah di tengah dua pegawai ditolak karena tidak bisa dipastikan', async () => {
    const b = await actorOf(f.users.stafBUser.id);
    const r = await faceAttendance(b, 'FACE_SELF', { direction: 'IN', descriptor: along(0.53), quality: q, idempotencyKey: key() }, 'vitest');
    expect(r.outcome).toBe('NOT_RECOGNIZED');
    expect(r.message).toMatch(/mirip dengan pegawai lain/);
  });
});

describe('absen foto dan GPS', () => {
  const body = () => ({ direction: 'IN', photo: jpeg, latitude: -6.2, longitude: 106.8, accuracyM: 12, idempotencyKey: key() });

  it('ditolak bila belum diizinkan untuk pegawai itu', async () => {
    const b = await actorOf(f.users.stafBUser.id);
    const r = await photoAttendance(b, body(), 'vitest');
    expect(r.outcome).toBe('DEVICE_NOT_ALLOWED');
  });

  it('lokasi GPS wajib', async () => {
    const b = await actorOf(f.users.stafBUser.id);
    await expect(photoAttendance(b, { ...body(), latitude: undefined, longitude: undefined }, 'vitest')).rejects.toThrow();
  });

  it('setelah diizinkan lewat aksi massal, tercatat dengan metode PHOTO dan koordinat', async () => {
    const admin = await actorOf(f.users.admin.id);
    const out = await bulkEmployees(admin, { action: 'photo-on', ids: [f.stafB.id] });
    expect(out.done).toBe(1);
    const b = await actorOf(f.users.stafBUser.id);
    const r = await photoAttendance(b, body(), 'vitest');
    expect(r.outcome).toBe('SUCCESS');
    const ev = await prisma.attendanceEvent.findUniqueOrThrow({ where: { id: r.eventId } });
    expect(ev.method).toBe('PHOTO');
    expect(Number(ev.latitude)).toBeCloseTo(-6.2, 3);
    expect(Number(ev.longitude)).toBeCloseTo(106.8, 3);
  });

  it('dicabut lagi lewat aksi massal', async () => {
    const admin = await actorOf(f.users.admin.id);
    await bulkEmployees(admin, { action: 'photo-off', ids: [f.stafB.id] });
    const b = await actorOf(f.users.stafBUser.id);
    const r = await photoAttendance(b, { ...body(), direction: 'OUT' }, 'vitest');
    expect(r.outcome).toBe('DEVICE_NOT_ALLOWED');
  });
});
