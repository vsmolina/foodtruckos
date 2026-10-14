'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

// One ticking clock for the whole board — never a setInterval per card.
const NowContext = createContext<number>(Date.now());

export function TimerProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return <NowContext.Provider value={now}>{children}</NowContext.Provider>;
}

export function useNow(): number {
  return useContext(NowContext);
}
