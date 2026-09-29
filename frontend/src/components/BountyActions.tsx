"use client";
import { useState } from 'react';
import { Cl, Pc, type ClarityValue, type PostCondition } from '@stacks/transactions';
import { useAtomValue } from 'jotai';
import { addressAtom } from '@/store/wallet';
import { useBoard } from '@/lib/board';
import { useContractCall } from '@/lib/tx';
import { CONTRACT_ID, blocksToTime, displayStatus, formatStx, type Bounty } from '@/lib/bounties';
import { TxNote } from './TxNote';

function Note({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl bg-raised p-3.5 text-[13px] leading-relaxed text-muted">{children}</p>;
}

/** The actions available to the connected wallet for this bounty. */
export function BountyActions({ bounty: b, onChanged }: { bounty: Bounty; onChanged: () => void }) {
  const me = useAtomValue(addressAtom);
  const { windows, height } = useBoard();
  const { state, send, busy } = useContractCall(onChanged);
  const [link, setLink] = useState('');

  const status = displayStatus(b, height);
  const isPoster = me === b.poster;
  const isWorker = !!me && me === b.worker;
  const claimDeadline = b.claimedAt + (windows?.claimWindow ?? 0);
  const reviewDeadline = b.submittedAt + (windows?.reviewWindow ?? 0);

  const act = (fn: string, extra: ClarityValue[] = [], pcs: PostCondition[] = []) => send(fn, [Cl.uint(b.id), ...extra], pcs);
  // Payouts and refunds assert the contract sends exactly this bounty's reward.
  const payout = [Pc.principal(CONTRACT_ID).willSendEq(b.reward).ustx()];

  let body: React.ReactNode = null;

  if (!me && (status === 'open' || status === 'claimed' || status === 'submitted')) {
    body = <Note>Connect a Stacks wallet (set to Testnet) to claim or manage this bounty.</Note>;
  } else if (status === 'open') {
    body = isPoster ? (
      <>
        <Note>Waiting for a builder. You can cancel for a full refund until someone claims it.</Note>
        <button className="btn-danger w-full" disabled={busy} onClick={() => act('cancel-bounty', [], payout)}>
          Cancel and refund {formatStx(b.reward)} STX
        </button>
      </>
    ) : (
      <>
        <Note>
          Claiming gives you ~{blocksToTime(windows?.claimWindow ?? 144)} to submit. If you can’t finish, drop the claim so
          someone else can pick it up.
        </Note>
        <button className="btn-primary w-full" disabled={busy} onClick={() => act('claim-bounty')}>
          Claim this bounty
        </button>
      </>
    );
  } else if (status === 'expired') {
    body = isPoster ? (
      <>
        <Note>The claim deadline passed with no taker. Cancel to get your STX back.</Note>
        <button className="btn-danger w-full" disabled={busy} onClick={() => act('cancel-bounty', [], payout)}>
          Refund {formatStx(b.reward)} STX
        </button>
      </>
    ) : (
      <Note>This bounty is past its deadline and no longer accepts claims.</Note>
    );
  } else if (status === 'claimed') {
    if (isWorker)
      body = (
        <form
          className="space-y-3"
          onSubmit={e => {
            e.preventDefault();
            if (link.trim()) void act('submit-work', [Cl.stringAscii(link.trim())]);
          }}
        >
          <label className="label" htmlFor="link">Link to your work</label>
          <input
            id="link"
            className="input font-mono text-[13px]"
            placeholder="https://github.com/you/repo/pull/1"
            maxLength={200}
            value={link}
            onChange={e => setLink(e.target.value.replace(/[^\x20-\x7e]/g, ''))}
          />
          <p className="text-[12px] text-dim">
            Submit by Bitcoin block {claimDeadline.toLocaleString()} (~{blocksToTime(claimDeadline - height)} left).
          </p>
          <button type="submit" className="btn-primary w-full" disabled={busy || !link.trim()}>Submit work</button>
          <button type="button" className="btn w-full" disabled={busy} onClick={() => act('abandon-claim')}>Drop claim</button>
        </form>
      );
    else if (isPoster)
      body =
        height >= claimDeadline ? (
          <>
            <Note>The builder didn’t submit within the claim window. Reopen it for someone else.</Note>
            <button className="btn w-full" disabled={busy} onClick={() => act('reopen-bounty')}>Reopen bounty</button>
          </>
        ) : (
          <Note>
            A builder is working on this. If nothing is submitted by Bitcoin block {claimDeadline.toLocaleString()} (~
            {blocksToTime(claimDeadline - height)}), you can reopen it.
          </Note>
        );
    else body = <Note>Someone has claimed this bounty and is working on it.</Note>;
  } else if (status === 'submitted') {
    if (isPoster)
      body = (
        <>
          <Note>Review the submission. Approving pays the builder from escrow immediately.</Note>
          <button className="btn-primary w-full" disabled={busy} onClick={() => act('approve-work', [], payout)}>
            Approve and pay {formatStx(b.reward)} STX
          </button>
        </>
      );
    else if (isWorker)
      body =
        height >= reviewDeadline ? (
          <>
            <Note>The poster didn’t review in time. You can collect the reward yourself.</Note>
            <button className="btn-primary w-full" disabled={busy} onClick={() => act('claim-payout', [], payout)}>
              Collect {formatStx(b.reward)} STX
            </button>
          </>
        ) : (
          <Note>
            Submitted. If the poster doesn’t respond by Bitcoin block {reviewDeadline.toLocaleString()} (~
            {blocksToTime(reviewDeadline - height)}), you can collect the reward yourself.
          </Note>
        );
    else body = <Note>Work has been submitted and is waiting for the poster’s review.</Note>;
  } else if (status === 'paid') {
    body = <Note>This bounty is complete. The reward was paid out of escrow.</Note>;
  } else {
    body = <Note>The poster cancelled this bounty and was refunded.</Note>;
  }

  return (
    <div className="space-y-3">
      {body}
      <TxNote state={state} />
    </div>
  );
}
