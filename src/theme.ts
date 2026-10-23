import { useEffect, useState } from 'react';

// Reference palette (dataviz skill): categorical slots in fixed order, chart chrome per mode.
const LIGHT = {
  series: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
  surface: '#fcfcfb',
  grid: '#e1e0d9',
  axis: '#c3c2b7',
  muted: '#898781',
  text: '#0b0b0b',
  text2: '#52514e',
};
const DARK: typeof LIGHT = {
  series: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
  surface: '#1a1a19',
  grid: '#2c2c2a',
  axis: '#383835',
  muted: '#898781',
  text: '#f0efec',
  text2: '#c3c2b7',
};
export type Theme = typeof LIGHT;

const query = () => window.matchMedia('(prefers-color-scheme: dark)');

export function useTheme(): Theme {
  const [dark, setDark] = useState(() => query().matches);
  useEffect(() => {
    const mq = query();
    const onChange = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return dark ? DARK : LIGHT;
}

/** Scenario ids are 'a'..'h' and keep their colour slot when other scenarios are removed. */
export const slotOf = (id: string) => (id.charCodeAt(0) - 97) % 8;
