'use client';

import { useSyncExternalStore } from 'react';

// Status pemasangan aplikasi (PWA), dibagi ke semua komponen lewat satu penyimpanan di modul ini.
interface InstallPrompt extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
interface State { canInstall: boolean; installed: boolean; ios: boolean; help: boolean }

let deferred: InstallPrompt | null = null;
let state: State = { canInstall: false, installed: false, ios: false, help: false };
const listeners = new Set<() => void>();
const SERVER: State = { canInstall: false, installed: false, ios: false, help: false };
const emit = (next: Partial<State>) => { state = { ...state, ...next }; listeners.forEach((l) => l()); };

const standalone = () => typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

let started = false;
/** Pasang pendengar sekali: peristiwa pemasangan, dan deteksi iOS yang tidak punya peristiwa itu. */
export function initPwa() {
  if (started || typeof window === 'undefined') return;
  started = true;
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1);
  emit({ installed: standalone(), ios: ios && !standalone() });
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as InstallPrompt; emit({ canInstall: true }); });
  window.addEventListener('appinstalled', () => { deferred = null; emit({ canInstall: false, installed: true, ios: false }); });
}

/** Petunjuk pemasangan manual (iOS tidak punya dialog pasang bawaan). Dialognya dirender PwaRegister yang selalu terpasang. */
export const showIosHelp = (open: boolean) => emit({ help: open });

export async function promptInstall() {
  if (!deferred) return false;
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  emit({ canInstall: false, installed: outcome === 'accepted' });
  return outcome === 'accepted';
}

export function usePwa() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state, () => SERVER);
}
