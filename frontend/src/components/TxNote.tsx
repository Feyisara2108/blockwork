import type { TxState } from '@/lib/tx'
import { explorer } from '@/lib/bounties'

/** Inline status for an in-flight transaction. */
export function TxNote({ state, success = 'Confirmed on-chain.' }: { state: TxState; success?: string }) {
  if (state.phase === 'idle') return null

  const link = 'txid' in state && state.txid && (
    <a className="underline underline-offset-2 hover:text-fg" href={explorer.tx(state.txid)} target="_blank" rel="noreferrer">
      View transaction ↗
    </a>
  )

  const styles = {
    signing: 'border-line bg-raised text-muted',
    pending: 'border-warn/30 bg-warn/5 text-warn',
    success: 'border-good/30 bg-good/5 text-good',
    failed: 'border-bad/30 bg-bad/5 text-bad',
  }[state.phase]

  const text = {
    signing: 'Confirm the transaction in your wallet…',
    pending: 'Broadcast. Waiting for the next Stacks block…',
    success,
    failed: 'message' in state ? state.message : 'Failed.',
  }[state.phase]

  return (
    <div className={`flex flex-col gap-1 rounded-xl border px-3.5 py-3 text-[13px] ${styles}`}>
      <span className="flex items-center gap-2">
        {(state.phase === 'signing' || state.phase === 'pending') && (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        {text}
      </span>
      {link}
    </div>
  )
}
