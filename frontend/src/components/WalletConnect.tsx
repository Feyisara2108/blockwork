"use client";
import { useState, useEffect, type ReactNode } from 'react';
import { connect, disconnect, isConnected, getLocalStorage } from '@stacks/connect';
import { addressAtom, isMountedAtom } from '../store/wallet';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';

function getStoredStxAddress() {
  const stored = getLocalStorage();
  if (!stored) return null;

  return (
    stored.addresses?.stx?.find(entry => entry.address.startsWith('S'))?.address ??
    stored.addresses?.stx?.[0]?.address ??
    null
  );
}

function getResponseStxAddress(addresses: Array<{ address: string; symbol?: string }>) {
  return (
    addresses.find(entry => entry.symbol === 'STX')?.address ??
    addresses.find(entry => entry.address.startsWith('S'))?.address ??
    addresses[0]?.address ??
    null
  );
}

/** Syncs Leather/Xverse connection state into Jotai atoms for the app. */
export function WalletProvider({ children }: { children: ReactNode }) {
  const [, setAddress] = useAtom(addressAtom);
  const [, setMounted] = useAtom(isMountedAtom);

  useEffect(() => {
    const syncWalletState = () => {
      if (!isConnected()) {
        setAddress(null);
        return;
      }

      setAddress(getStoredStxAddress());
    };

    setMounted(true);
    syncWalletState();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncWalletState();
      }
    };

    window.addEventListener('focus', syncWalletState);
    window.addEventListener('storage', syncWalletState);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', syncWalletState);
      window.removeEventListener('storage', syncWalletState);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [setAddress, setMounted]);

  return <>{children}</>;
}

export function WalletConnect() {
  const address = useAtomValue(addressAtom);
  const isMounted = useAtomValue(isMountedAtom);
  const setAddress = useSetAtom(addressAtom);
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const response = await connect();
      const addr = getResponseStxAddress(response.addresses);
      setAddress(addr);
    } catch (e) {
      console.error('[scaffold-stacks] connection failed:', e);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    disconnect();
    setAddress(null);
  };

  // 1. Prevents SSR Flash: Render nothing or a skeleton until client-side mount
  if (!isMounted) return <div className='h-8 w-32' />;

  // 2. Disconnected UI
  if (!address) {
    return (
      <button
        onClick={handleConnect}
        disabled={connecting}
        className='btn btn-sm'
      >
        {connecting ? 'Connecting…' : 'Connect wallet'}
      </button>
    );
  }

  // 3. Connected UI
  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
  return (
    <div className='flex items-center gap-2'>
      <span className='rounded-lg border border-line bg-surface px-2.5 h-8 inline-flex items-center font-mono text-[12px] text-muted'>
        {short}
      </span>
      <button onClick={handleDisconnect} className='text-[13px] text-dim hover:text-fg'>
        Disconnect
      </button>
    </div>
  );
}
