'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import type { Circle, Map as LeafletMap, Marker } from 'leaflet';
import { Crosshair, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Props {
  lat: number | null;
  lng: number | null;
  /** Radius dalam meter, digambar sebagai lingkaran di sekitar pin. */
  radiusM?: number | null;
  onChange: (lat: number, lng: number) => void;
}

// Pusat peta bawaan saat koordinat belum diisi: Jakarta Pusat.
const DEFAULT_CENTER: [number, number] = [-6.1754, 106.8272];
const round = (n: number) => Math.round(n * 1e6) / 1e6;

const PIN = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="44" viewBox="0 0 34 44"><path d="M17 43C17 43 3 28 3 16a14 14 0 0 1 28 0c0 12-14 27-14 27z" fill="#0e1b3d" stroke="#fff" stroke-width="2"/><circle cx="17" cy="16" r="5.5" fill="#f2b11e"/></svg>`;

/**
 * Pilih titik koordinat di peta OpenStreetMap: ketuk peta atau seret pin. Tersedia juga tombol lokasi saya dan
 * pencarian nama tempat (OpenStreetMap Nominatim, hanya saat tombol Cari ditekan). Ubin peta diambil peramban dari
 * tile.openstreetmap.org, jadi perangkat yang membuka halaman ini perlu internet.
 */
export function LocationPicker({ lat, lng, radiusM, onChange }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const circle = useRef<Circle | null>(null);
  const change = useRef(onChange);
  const [query, setQuery] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { change.current = onChange; }, [onChange]);

  // Peta dibuat sekali; Leaflet butuh window sehingga dimuat di sini, bukan di sisi server.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !box.current || map.current) return;
      const has = lat != null && lng != null;
      const m = L.map(box.current, { center: has ? [lat, lng] : DEFAULT_CENTER, zoom: has ? 17 : 12, scrollWheelZoom: true });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>' }).addTo(m);
      const icon = L.divIcon({ html: PIN, className: 'location-pin', iconSize: [34, 44], iconAnchor: [17, 43] });
      const place = (a: number, b: number) => {
        if (!marker.current) {
          marker.current = L.marker([a, b], { icon, draggable: true, keyboard: true, title: 'Titik kantor, seret untuk memindahkan' }).addTo(m);
          marker.current.on('dragend', () => { const p = marker.current!.getLatLng(); circle.current?.setLatLng(p); change.current(round(p.lat), round(p.lng)); });
        } else marker.current.setLatLng([a, b]);
        if (!circle.current) circle.current = L.circle([a, b], { radius: radiusM ?? 0, color: '#0e1b3d', weight: 2, fillColor: '#2a78d6', fillOpacity: 0.12 }).addTo(m);
        else circle.current.setLatLng([a, b]);
      };
      if (has) place(lat, lng);
      m.on('click', (e) => { place(e.latlng.lat, e.latlng.lng); change.current(round(e.latlng.lat), round(e.latlng.lng)); });
      map.current = m;
      (m as LeafletMap & { _place?: typeof place })._place = place;
    })();
    return () => { cancelled = true; map.current?.remove(); map.current = null; marker.current = null; circle.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Koordinat atau radius yang diubah dari kolom angka diikuti pin dan lingkaran.
  useEffect(() => {
    const m = map.current as (LeafletMap & { _place?: (a: number, b: number) => void }) | null;
    if (!m || lat == null || lng == null) return;
    const cur = marker.current?.getLatLng();
    if (!cur || Math.abs(cur.lat - lat) > 1e-7 || Math.abs(cur.lng - lng) > 1e-7) { m._place?.(lat, lng); m.panTo([lat, lng]); }
  }, [lat, lng]);
  useEffect(() => { circle.current?.setRadius(radiusM && radiusM > 0 ? radiusM : 0); }, [radiusM]);

  function jump(a: number, b: number, zoom = 17) {
    const m = map.current as (LeafletMap & { _place?: (a: number, b: number) => void }) | null;
    if (!m) return;
    m._place?.(a, b);
    m.setView([a, b], zoom);
    change.current(round(a), round(b));
  }

  function locate() {
    if (!navigator.geolocation) { setNote('Peramban ini tidak mendukung lokasi.'); return; }
    setBusy(true);
    setNote('Mengambil lokasi perangkat...');
    navigator.geolocation.getCurrentPosition(
      (p) => { jump(p.coords.latitude, p.coords.longitude); setNote(`Lokasi perangkat dipakai (akurasi sekitar ${Math.round(p.coords.accuracy)} m). Seret pin bila perlu.`); setBusy(false); },
      () => { setNote('Lokasi tidak bisa diambil. Izinkan akses lokasi di peramban, atau ketuk peta.'); setBusy(false); },
      { enableHighAccuracy: true, timeout: 20_000 },
    );
  }

  async function search() {
    const q = query.trim();
    if (q.length < 3) { setNote('Ketik minimal 3 huruf nama tempat atau alamat.'); return; }
    setBusy(true);
    setNote('Mencari...');
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=id&q=${encodeURIComponent(q)}`, { headers: { Accept: 'application/json' } });
      const list = (await r.json()) as { lat: string; lon: string; display_name: string }[];
      if (!list.length) setNote('Tempat tidak ditemukan. Coba kata kunci lain atau ketuk langsung di peta.');
      else { jump(Number(list[0].lat), Number(list[0].lon)); setNote(`Ditemukan: ${list[0].display_name}. Seret pin untuk menyesuaikan.`); }
    } catch {
      setNote('Pencarian gagal. Periksa koneksi internet, atau ketuk langsung di peta.');
    } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <form className="flex min-w-0 flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); void search(); }}>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari nama tempat atau alamat" aria-label="Cari tempat di peta" className="pl-9" />
          </div>
          <Button type="submit" variant="outline" disabled={busy}>Cari</Button>
        </form>
        <Button type="button" variant="outline" onClick={locate} disabled={busy}><Crosshair />Lokasi saya</Button>
      </div>
      <div ref={box} className="h-80 w-full overflow-hidden rounded-lg border bg-muted sm:h-96" role="application" aria-label="Peta untuk menentukan titik koordinat kantor" />
      <p className="text-sm text-muted-foreground" aria-live="polite">{note ?? 'Ketuk peta untuk menaruh pin, atau seret pin ke titik yang tepat. Lingkaran menunjukkan radius yang diizinkan.'}</p>
    </div>
  );
}
