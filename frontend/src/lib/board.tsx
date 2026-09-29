"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { fetchBounties, fetchWindows, type Bounty, type Windows } from './bounties';

type Board = {
  bounties: Bounty[] | null;
  windows: Windows | null;
  height: number;
  error: string | null;
  reload: () => Promise<void>;
};

const BoardContext = createContext<Board | null>(null);
const REFRESH_MS = 30_000;

/** Loads every bounty once and shares it across pages; refreshes every 30s. */
export function BoardProvider({ children }: { children: ReactNode }) {
  const [bounties, setBounties] = useState<Bounty[] | null>(null);
  const [windows, setWindows] = useState<Windows | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [list, w] = await Promise.all([fetchBounties(), fetchWindows()]);
      setBounties(list);
      setWindows(w);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? 'Could not reach the Stacks API.');
    }
  }, []);

  useEffect(() => {
    void reload();
    const t = setInterval(reload, REFRESH_MS);
    return () => clearInterval(t);
  }, [reload]);

  return (
    <BoardContext.Provider value={{ bounties, windows, height: windows?.currentHeight ?? 0, error, reload }}>
      {children}
    </BoardContext.Provider>
  );
}

export function useBoard() {
  const ctx = useContext(BoardContext);
  if (!ctx) throw new Error('useBoard must be used inside <BoardProvider>');
  return ctx;
}
