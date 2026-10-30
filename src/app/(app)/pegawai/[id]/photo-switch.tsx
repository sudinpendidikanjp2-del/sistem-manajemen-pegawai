'use client';

import { Switch } from '@/components/ui/switch';
import { api, useAction } from '@/components/app/api-client';

/** Izin absen foto dan GPS tanpa pengenalan wajah untuk satu pegawai. */
export function PhotoAttendanceSwitch({ id, name, enabled, canEdit }: { id: string; name: string; enabled: boolean; canEdit: boolean }) {
  const { pending, run } = useAction();
  if (!canEdit) return <span>{enabled ? 'Diizinkan' : 'Tidak diizinkan'}</span>;
  return (
    <span className="flex items-center gap-3">
      <Switch checked={enabled} disabled={pending} aria-label={`Izinkan absen foto untuk ${name}`}
        onCheckedChange={(v) => run(() => api('PUT', `/api/v1/employees/${id}/photo-attendance`, { enabled: v }), { success: v ? 'Absen foto diizinkan.' : 'Absen foto dicabut.' })} />
      <span className="text-muted-foreground">{enabled ? 'Diizinkan' : 'Tidak diizinkan'}</span>
    </span>
  );
}
