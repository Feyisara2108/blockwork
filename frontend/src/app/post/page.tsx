"use client";
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Cl, Pc } from '@stacks/transactions';
import { useAtomValue } from 'jotai';
import { addressAtom } from '@/store/wallet';
import { useBoard } from '@/lib/board';
import { useContractCall } from '@/lib/tx';
import { CATEGORIES, DURATIONS, MIN_REWARD_STX, toMicroStx, type Bounty } from '@/lib/bounties';
import { BountyCard } from '@/components/BountyCard';
import { TxNote } from '@/components/TxNote';

const TITLE_MAX = 80;
const DETAILS_MAX = 500;
const QUICK = ['1', '5', '10', '25'];

export default function PostPage() {
  const me = useAtomValue(addressAtom);
  const { height, reload } = useBoard();
  const { state, send, busy } = useContractCall(reload);
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [category, setCategory] = useState<string>('dev');
  const [reward, setReward] = useState('');
  const [duration, setDuration] = useState(1008);

  const micro = toMicroStx(reward);
  const rewardError =
    reward && (micro === null ? 'Enter a number, up to 6 decimals.' : micro < BigInt(MIN_REWARD_STX * 1e6) ? `Minimum is ${MIN_REWARD_STX} STX.` : null);
  const canSubmit = !!me && title.trim() && micro !== null && !rewardError && !busy;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !me || micro === null) return;
    void send(
      'post-bounty',
      [Cl.stringUtf8(title.trim()), Cl.stringUtf8(details.trim()), Cl.stringAscii(category), Cl.uint(micro), Cl.uint(duration)],
      [Pc.principal(me).willSendEq(micro).ustx()],
    );
  };

  const preview: Bounty = {
    id: 0,
    poster: me ?? 'ST000000000000000000002AMW42H',
    title: title || 'Your bounty title',
    details: details || 'Describe what done looks like and how the builder should submit.',
    category,
    reward: micro ?? 0n,
    status: 'open',
    worker: null,
    submission: null,
    createdAt: height,
    deadline: height + duration,
    claimedAt: 0,
    submittedAt: 0,
  };

  const newId = state.phase === 'success' ? state.result?.match(/u(\d+)/)?.[1] : null;

  return (
    <main className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
      <p className="eyebrow">New bounty</p>
      <h1 className="display mt-2 text-[36px] font-bold">Post a bounty</h1>
      <p className="mt-2 max-w-xl text-[15px] text-muted">
        The reward moves into the contract when you post. Builders can see it’s real before they start.
      </p>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_380px]">
        {state.phase === 'success' ? (
          <div className="card flex flex-col items-start gap-4 p-8">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-good/10 text-good ring-1 ring-inset ring-good/30">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12l4 4L19 6" /></svg>
            </span>
            <h2 className="display text-[24px] font-semibold">Bounty posted. The reward is in escrow.</h2>
            <TxNote state={state} success="Confirmed on-chain." />
            <div className="flex gap-3">
              {newId && <Link href={`/bounty/${newId}`} className="btn-primary">View bounty #{newId}</Link>}
              <Link href="/#bounties" className="btn">All bounties</Link>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="card space-y-6 p-6 sm:p-8">
            <div>
              <label className="label" htmlFor="title">Title</label>
              <input id="title" className="input" maxLength={TITLE_MAX} placeholder="Write simnet tests for my SIP-010 token" value={title} onChange={e => setTitle(e.target.value)} />
            </div>

            <div>
              <span className="label">Category</span>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(c => (
                  <button
                    type="button"
                    key={c.key}
                    onClick={() => setCategory(c.key)}
                    className={`h-9 rounded-lg border px-3 text-[13px] transition ${
                      category === c.key ? 'border-btc bg-btc/10 text-btc' : 'border-line text-muted hover:text-fg'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label" htmlFor="details">
                Brief <span className="font-normal text-dim">{details.length}/{DETAILS_MAX}</span>
              </label>
              <textarea id="details" className="input min-h-[120px] resize-y" maxLength={DETAILS_MAX} placeholder="What counts as done, and what the builder should submit." value={details} onChange={e => setDetails(e.target.value)} />
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="reward">Reward</label>
                <div className="relative">
                  <input id="reward" className="input pr-14 font-mono" inputMode="decimal" placeholder="10" value={reward} onChange={e => setReward(e.target.value)} />
                  <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px] text-dim">STX</span>
                </div>
                <div className="mt-2 flex gap-1.5">
                  {QUICK.map(q => (
                    <button type="button" key={q} onClick={() => setReward(q)} className="h-7 rounded-md border border-line px-2 font-mono text-[12px] text-muted hover:border-btc hover:text-btc">
                      {q}
                    </button>
                  ))}
                </div>
                {rewardError && <p className="mt-1.5 text-[12px] text-bad">{rewardError}</p>}
              </div>
              <div>
                <label className="label" htmlFor="duration">Open for claims</label>
                <select id="duration" className="input" value={duration} onChange={e => setDuration(Number(e.target.value))}>
                  {DURATIONS.map(d => (
                    <option key={d.blocks} value={d.blocks}>{d.label} ({d.blocks} Bitcoin blocks)</option>
                  ))}
                </select>
                <p className="mt-2 text-[12px] text-dim">After this, no one can claim it and you can refund yourself.</p>
              </div>
            </div>

            <div className="border-t border-line pt-6">
              <button type="submit" className="btn-primary w-full sm:w-auto" disabled={!canSubmit}>
                {me ? `Post and lock ${reward && !rewardError ? `${reward} STX` : 'reward'}` : 'Connect a wallet to post'}
              </button>
              <div className="mt-4"><TxNote state={state} /></div>
            </div>
          </form>
        )}

        <div className="lg:sticky lg:top-24 lg:self-start">
          <p className="mb-3 text-[13px] text-dim">Preview</p>
          <div className="pointer-events-none">
            <BountyCard bounty={preview} height={height} />
          </div>
          <ul className="mt-6 space-y-2 text-[13px] text-muted">
            <li>· Your wallet shows the exact amount leaving your account. Nothing else can move.</li>
            <li>· Cancel for a full refund any time before someone claims it.</li>
            <li>· If a builder goes quiet for ~1 day after claiming, you can reopen it.</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
