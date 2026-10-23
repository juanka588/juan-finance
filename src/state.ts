import { DEFAULTS } from './defaults';
import type { Inputs } from './engine/types';

const STORAGE_KEY = 'juan-finance-inputs';

function encode(inp: Inputs): string {
  const bytes = new TextEncoder().encode(JSON.stringify(inp));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decode(s: string): Partial<Inputs> | null {
  try {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
  } catch {
    return null;
  }
}

export function loadInputs(): Inputs {
  const fromHash = location.hash.startsWith('#s=') ? decode(location.hash.slice(3)) : null;
  let stored: Partial<Inputs> | null = null;
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
  } catch {
    stored = null;
  }
  return { ...DEFAULTS, ...(fromHash ?? stored ?? {}) };
}

export function saveInputs(inp: Inputs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(inp));
  history.replaceState(null, '', `#s=${encode(inp)}`);
}
