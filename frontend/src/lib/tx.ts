"use client";
import { useCallback, useEffect, useState } from 'react';
import { request } from '@stacks/connect';
import type { ClarityValue, PostCondition } from '@stacks/transactions';
import { scaffoldConfig } from '@/scaffold.config';
import { CONTRACT_ID } from './bounties';

export type TxState =
  | { phase: 'idle' }
  | { phase: 'signing' }
  | { phase: 'pending'; txid: string }
  | { phase: 'success'; txid: string; result?: string }
  | { phase: 'failed'; txid?: string; message: string };

const POLL_MS = 4000;

/**
 * Calls a bounty-board function through the wallet in post-condition *deny* mode.
 * The generated hooks always send 'allow'; for calls that move STX we want the
 * wallet to show exact amounts and reject anything else.
 */
export function useContractCall(onConfirmed?: () => void) {
  const [state, setState] = useState<TxState>({ phase: 'idle' });

  const send = useCallback(
    async (functionName: string, functionArgs: ClarityValue[], postConditions: PostCondition[] = []) => {
      setState({ phase: 'signing' });
      try {
        const res = await request('stx_callContract', {
          contract: CONTRACT_ID as `${string}.${string}`,
          functionName,
          functionArgs,
          postConditions,
          postConditionMode: 'deny',
          network: scaffoldConfig.targetNetwork,
        });
        if (!res?.txid) throw new Error('Wallet did not return a transaction id.');
        setState({ phase: 'pending', txid: res.txid });
      } catch (e: any) {
        const message = String(e?.message ?? e ?? '');
        // Closing the wallet popup is not an error worth showing.
        if (/cancel|reject|denied|user/i.test(message)) setState({ phase: 'idle' });
        else setState({ phase: 'failed', message: message || 'Could not send transaction.' });
      }
    },
    [],
  );

  const txid = state.phase === 'pending' ? state.txid : null;

  useEffect(() => {
    if (!txid) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const headers: Record<string, string> = scaffoldConfig.hiroApiKey
      ? { 'x-api-key': scaffoldConfig.hiroApiKey }
      : {};

    const poll = async () => {
      try {
        const r = await fetch(`${scaffoldConfig.nodeUrl}/extended/v1/tx/${txid}`, { headers, cache: 'no-store' });
        if (r.ok) {
          const tx = await r.json();
          if (!alive) return;
          if (tx.tx_status === 'success') {
            setState({ phase: 'success', txid, result: tx.tx_result?.repr });
            onConfirmed?.();
            return;
          }
          if (String(tx.tx_status).startsWith('abort')) {
            setState({ phase: 'failed', txid, message: explainAbort(tx.tx_result?.repr) });
            return;
          }
        }
      } catch {
        // network blip — keep polling
      }
      if (alive) timer = setTimeout(poll, POLL_MS);
    };
    timer = setTimeout(poll, POLL_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [txid, onConfirmed]);

  const reset = useCallback(() => setState({ phase: 'idle' }), []);
  const busy = state.phase === 'signing' || state.phase === 'pending';
  return { state, send, reset, busy };
}

const ERRORS: Record<string, string> = {
  u100: 'Bounty not found.',
  u101: 'Only the poster can do that.',
  u102: 'Only the worker who claimed this can do that.',
  u103: 'The bounty changed state before your transaction landed.',
  u104: "You can't claim your own bounty.",
  u105: 'Reward is below the 0.1 STX minimum.',
  u106: 'Title is required.',
  u107: 'Submission link is required.',
  u108: 'The waiting period has not passed yet.',
  u109: 'This bounty is past its deadline and no longer accepts claims.',
  u110: 'Pick a duration between 1 hour and 30 days.',
};

function explainAbort(repr?: string): string {
  const code = repr?.match(/u\d+/)?.[0];
  return (code && ERRORS[code]) || `Transaction failed${repr ? `: ${repr}` : '.'}`;
}
