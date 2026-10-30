'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, LocateFixed, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Field, fieldProps } from './field';
import { cn } from '@/lib/utils';
import { api, newKey } from './api-client';
import { capture, fmtClock, fmtDateLong, getLocation, reverseGeocode, serverClock, startCamera, stopCamera } from '@/lib/face-client';

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const out: string[] = [];
  let line = '';
  for (const w of text.split(' ')) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > max && line) { out.push(line); line = w; } else line = t;
  }
  if (line) out.push(line);
  return out;
}

/**
 * Absen foto: selfie berstempel jam server dan koordinat GPS, tanpa pengenalan wajah. Tidak memuat model wajah,
 * jadi kamera langsung menyala. GPS wajib: tombol ambil foto baru aktif setelah lokasi didapat.
 */
export function PhotoCheck({ employee, org, geocode, suggested }: { employee: { name: string; nip: string | null }; org: string; geocode: boolean; suggested: 'IN' | 'OUT' }) {
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const clock = useRef<Awaited<ReturnType<typeof serverClock>> | null>(null);
  const [status, setStatus] = useState('Menyiapkan kamera...');
  const [ready, setReady] = useState(false);
  const [gps, setGps] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [gpsMsg, setGpsMsg] = useState('Mengambil lokasi...');
  const [locating, setLocating] = useState(false);
  const [address, setAddress] = useState('');
  const [direction, setDirection] = useState<'IN' | 'OUT'>(suggested);
  const [shot, setShot] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ ok: boolean; title: string; message: string } | null>(null);

  async function locate() {
    setLocating(true);
    setGpsMsg('Mengambil lokasi...');
    try {
      const l = await getLocation(20000);
      setGps(l);
      setGpsMsg(`${l.lat.toFixed(6)}, ${l.lng.toFixed(6)} (akurasi sekitar ${l.accuracy} m)`);
      if (geocode) setAddress(await reverseGeocode(l.lat, l.lng));
    } catch (e) {
      setGps(null);
      setGpsMsg((e as Error).message);
    } finally {
      setLocating(false);
    }
  }

  useEffect(() => {
    const el = video.current;
    let stopped = false;
    (async () => {
      clock.current = await serverClock();
      void locate();
      try {
        await startCamera(video.current!);
        if (stopped) { stopCamera(video.current); return; }
        setReady(true);
        setStatus('Kamera siap. Ambil foto di tempat Anda absen.');
      } catch (e) {
        setStatus((e as Error).message);
      }
    })();
    return () => { stopped = true; stopCamera(el); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function take() {
    setFields({});
    if (!gps) { setFields({ gps: 'Lokasi GPS wajib. Aktifkan GPS lalu tekan Perbarui lokasi.' }); return; }
    const v = video.current!;
    const canvas = capture(v, { maxWidth: 960 });
    const ctx = canvas.getContext('2d')!;
    const c = clock.current!;
    const now = c.now();
    const W = canvas.width;
    const fs = Math.max(13, Math.round(W / 40));
    ctx.font = `${fs}px sans-serif`;
    const lines: { text: string; bold?: boolean; small?: boolean }[] = [
      { text: `Absen ${direction === 'IN' ? 'masuk' : 'pulang'}: ${employee.name}${employee.nip ? ` (${employee.nip})` : ''}`, bold: true },
      { text: `Waktu: ${fmtDateLong(now, c.tz)} ${fmtClock(now, c.tz)} ${c.label}` },
      { text: `Lokasi: ${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)} (±${gps.accuracy} m)` },
    ];
    if (address) wrap(ctx, address, W - fs * 2).slice(0, 3).forEach((t) => lines.push({ text: t, small: true }));
    if (note.trim()) wrap(ctx, `Ket: ${note.trim()}`, W - fs * 2).slice(0, 2).forEach((t) => lines.push({ text: t, small: true }));
    lines.push({ text: org, small: true });
    const lh = Math.round(fs * 1.35);
    const boxH = lh * lines.length + fs;
    const grad = ctx.createLinearGradient(0, canvas.height - boxH - fs, 0, canvas.height);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.25, 'rgba(0,0,0,.65)');
    grad.addColorStop(1, 'rgba(0,0,0,.8)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, canvas.height - boxH - fs, W, boxH + fs);
    let y = canvas.height - boxH + lh * 0.6;
    ctx.textBaseline = 'middle';
    for (const l of lines) {
      ctx.font = `${l.bold ? 'bold ' : ''}${l.small ? Math.round(fs * 0.85) : fs}px sans-serif`;
      ctx.fillStyle = l.bold ? '#ffd54f' : '#ffffff';
      ctx.fillText(l.text, fs, y);
      y += lh;
    }
    setShot(canvas.toDataURL('image/jpeg', 0.82));
    setStatus('Periksa foto lalu kirim.');
  }

  async function send() {
    if (!shot || !gps) return;
    setBusy(true);
    setFields({});
    try {
      const r = await api<{ outcome: string; message: string; time?: string; status?: string; lateMinutes?: number }>('POST', '/api/v1/attendance/foto', {
        direction, photo: shot, latitude: gps.lat, longitude: gps.lng, accuracyM: gps.accuracy, address: address || null, note: note.trim() || null,
        idempotencyKey: newKey(), clientTime: new Date().toISOString(),
      });
      const ok = r.outcome === 'SUCCESS';
      setResult({ ok, title: ok ? `Absen ${direction === 'IN' ? 'masuk' : 'pulang'} tercatat pukul ${r.time}` : 'Belum tercatat', message: ok ? (r.status === 'TERLAMBAT' ? `Terlambat ${r.lateMinutes} menit.` : 'Foto dan lokasi Anda tersimpan sebagai bukti absen.') : r.message });
      if (ok) { stopCamera(video.current); router.refresh(); }
    } catch (e) {
      const err = e as { message: string; fields?: Record<string, string> };
      setFields(err.fields || {});
      setResult({ ok: false, title: 'Gagal mengirim', message: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[7fr_5fr]">
      <div>
        <div className="camera-wrap mirror" hidden={!!shot}>
          <video ref={video} autoPlay muted playsInline aria-label="Pratinjau kamera" />
          <div className="camera-status" aria-live="polite">{status}</div>
        </div>
        {shot && <img src={shot} alt="Pratinjau foto dengan stempel waktu dan lokasi" className="w-full rounded-xl border" />}
      </div>
      <Card>
        <CardContent className="grid gap-4">
          <div>
            <div className="text-sm text-muted-foreground">Lokasi GPS (wajib)</div>
            <p className="text-sm" aria-live="polite">{gpsMsg}</p>
            {address && <p className="text-sm text-muted-foreground">{address}</p>}
            {fields.gps && <p className="text-sm font-medium text-destructive" role="alert">{fields.gps}</p>}
            <Button type="button" variant="outline" size="sm" className="mt-2" disabled={locating || !!result?.ok} onClick={locate}><LocateFixed />Perbarui lokasi</Button>
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Jenis absen</legend>
            <div className="grid grid-cols-2 gap-1 rounded-lg border bg-card p-1">
              {(['IN', 'OUT'] as const).map((d) => (
                <button key={d} type="button" aria-pressed={direction === d} disabled={!!shot} onClick={() => setDirection(d)}
                  className={cn('min-h-11 rounded-md text-sm font-medium transition-[color,background-color,transform] duration-150 ease-out motion-safe:active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60', direction === d ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground')}>
                  {d === 'IN' ? 'Masuk' : 'Pulang'}
                </button>
              ))}
            </div>
          </fieldset>
          <Field id="note" label="Keterangan (opsional)" error={fields.note}>
            <Input {...fieldProps('note', fields.note)} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} disabled={!!shot} placeholder="Mis. absen dari kantor cabang" />
          </Field>
          {!shot ? (
            <Button size="lg" className="h-12 text-base" disabled={!ready || !gps} onClick={take}><Camera />{gps ? 'Ambil foto' : 'Menunggu lokasi...'}</Button>
          ) : (
            <div className="grid gap-2">
              <Button size="lg" className="h-12 text-base" disabled={busy || !!result?.ok} onClick={send}>{busy ? 'Mengirim...' : 'Kirim absensi'}</Button>
              <Button variant="outline" disabled={busy || !!result?.ok} onClick={() => { setShot(null); setResult(null); setStatus('Kamera siap. Ambil foto di tempat Anda absen.'); }}><RotateCcw />Ulangi foto</Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">Foto, jam server, dan koordinat tersimpan sebagai bukti absen dan dilihat petugas kepegawaian.</p>
          <div aria-live="polite">
            {result && <Alert key={`${result.title}|${result.message}`} variant={result.ok ? 'success' : 'destructive'} className="enter-rise"><AlertTitle>{result.title}</AlertTitle><AlertDescription>{result.message}</AlertDescription></Alert>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
