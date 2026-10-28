'use client';

import { useEffect } from 'react';
import { Download, Share, SquarePlus } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { initPwa, showIosHelp, usePwa } from '@/lib/pwa';

/**
 * Mendaftarkan service worker (hanya produksi, agar cache tidak mengganggu pengembangan), menyiapkan status pasang
 * aplikasi, dan menampilkan petunjuk pemasangan untuk iOS. Dirender sekali di layout akar.
 */
export function PwaRegister() {
  const { help } = usePwa();
  useEffect(() => {
    initPwa();
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined);
  }, []);
  return (
    <Dialog open={help} onOpenChange={showIosHelp}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Pasang SIMPEG di iPhone atau iPad</DialogTitle>
          <DialogDescription>Buka halaman ini di Safari, lalu:</DialogDescription>
        </DialogHeader>
        <ol className="grid gap-3 text-sm">
          <li className="flex items-center gap-3"><Share className="size-5 shrink-0 text-primary" aria-hidden />Ketuk tombol Bagikan di bilah Safari.</li>
          <li className="flex items-center gap-3"><SquarePlus className="size-5 shrink-0 text-primary" aria-hidden />Pilih Tambah ke Layar Utama.</li>
          <li className="flex items-center gap-3"><Download className="size-5 shrink-0 text-primary" aria-hidden />Ketuk Tambah. SIMPEG muncul sebagai aplikasi di layar utama.</li>
        </ol>
      </DialogContent>
    </Dialog>
  );
}
