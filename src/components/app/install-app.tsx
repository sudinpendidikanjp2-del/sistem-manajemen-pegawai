'use client';

import { Download } from 'lucide-react';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { promptInstall, showIosHelp, usePwa } from '@/lib/pwa';

/** Item menu "Pasang aplikasi". Di Android dan desktop memicu dialog bawaan peramban; di iOS menampilkan langkah manual. */
export function InstallAppMenuItem() {
  const { canInstall, ios, installed } = usePwa();
  if (installed || (!canInstall && !ios)) return null;
  return <DropdownMenuItem onSelect={() => { if (canInstall) void promptInstall(); else showIosHelp(true); }}><Download />Pasang aplikasi</DropdownMenuItem>;
}
