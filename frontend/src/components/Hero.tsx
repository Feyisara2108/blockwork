"use client";
import Link from 'next/link';
import { useBoard } from '@/lib/board';
import { formatStx, totals } from '@/lib/bounties';
import { Skeleton, StxIcon } from './ui';

/** A short chain of Bitcoin blocks ending at the live height. */
function BlockChain({ height }: { height: number }) {
  const blocks = height ? [4, 3, 2, 1, 0].map(d => height - d) : [];
  return (
    <div className="relative">
      <div className="grid-bg absolute -inset-10" />
      <div className="relative flex items-center gap-2 sm:gap-3">
        {height === 0
          ? [0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-16 rounded-xl sm:h-20 sm:w-20" />)
          : blocks.map((h, i) => {
              const last = i === blocks.length - 1;
              return (
                <div key={h} className="flex items-center gap-2 sm:gap-3">
                  <div
                    className={`flex h-16 w-16 flex-col justify-between rounded-xl border p-2 font-mono sm:h-20 sm:w-20 sm:p-2.5 ${
                      last
                        ? 'animate-block-in border-btc bg-btc text-black shadow-[0_0_40px_-6px_rgb(var(--btc)/0.8)]'
                        : 'border-line bg-surface text-dim'
                    }`}
                    style={{ opacity: last ? 1 : 0.35 + i * 0.15 }}
                  >
                    <span className="text-[9px] uppercase tracking-wider">{last ? 'latest' : 'block'}</span>
                    <span className="text-[11px] font-semibold sm:text-[13px]">{h.toLocaleString()}</span>
                  </div>
                  {!last && <span className={`h-px w-2 sm:w-3 ${i === blocks.length - 2 ? 'bg-btc' : 'bg-line'}`} />}
                </div>
              );
            })}
      </div>
    </div>
  );
}

export function Hero() {
  const { bounties, height } = useBoard();
  const t = bounties ? totals(bounties) : null;

  const stats = [
    { label: 'Locked in escrow', value: t && `${formatStx(t.escrow)}`, stx: true },
    { label: 'Paid to builders', value: t && `${formatStx(t.paid)}`, stx: true },
    { label: 'Open bounties', value: t && String(t.open) },
    { label: 'Builders', value: t && String(t.builders) },
  ];

  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-12 pt-14 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:pt-20">
        <div>
          <p className="eyebrow">Bitcoin-secured bounties · Stacks testnet</p>
          <h1 className="display mt-4 text-[40px] font-bold leading-[1.05] sm:text-[56px]">
            Get paid for work.
            <br />
            <span className="text-btc">The money is already locked.</span>
          </h1>
          <p className="mt-5 max-w-lg text-[16px] leading-relaxed text-muted">
            Every reward sits in a Clarity contract from the moment a bounty is posted. Claim a task, ship it, and get
            paid on approval. Deadlines and timeouts are counted in Bitcoin blocks, so no one can stall you out of your
            money.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#bounties" className="btn-primary">Browse bounties</a>
            <Link href="/post" className="btn">Post a bounty</Link>
          </div>
        </div>
        <div className="flex justify-center lg:justify-end">
          <BlockChain height={height} />
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <dl className="grid grid-cols-2 overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-4 [&>div]:bg-surface" style={{ gap: 1 }}>
          {stats.map(s => (
            <div key={s.label} className="px-5 py-4">
              <dt className="text-[12px] text-dim">{s.label}</dt>
              <dd className="mt-1 flex items-center gap-2 font-mono text-[24px] font-semibold tabular-nums">
                {s.value === null ? <Skeleton className="h-7 w-16" /> : (
                  <>
                    {s.stx && <StxIcon size={20} />}
                    {s.value}
                    {s.stx && <span className="text-[14px] text-dim">STX</span>}
                  </>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

const STEPS = [
  {
    title: 'Lock',
    body: 'The poster sends the reward to the contract. It stays there until the work is approved or the bounty is refunded.',
    icon: <path d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z" />,
  },
  {
    title: 'Claim',
    body: 'A builder takes the task. They have ~1 day of Bitcoin blocks to submit before the poster can reopen it.',
    icon: <path d="M5 12l4 4L19 6" />,
  },
  {
    title: 'Submit',
    body: 'The builder posts a link to the finished work. It is recorded on-chain with the block it landed in.',
    icon: <path d="M4 12h12M12 6l6 6-6 6" />,
  },
  {
    title: 'Get paid',
    body: 'The poster approves and the contract pays out. If they go silent for ~1 day, the builder can collect anyway.',
    icon: <path d="M12 3v18M16 7H10a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6H7" />,
  },
];

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-20 sm:px-6">
      <p className="eyebrow">How it works</p>
      <h2 className="display mt-2 text-[28px] font-semibold">Four steps, all enforced by the contract.</h2>
      <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <li key={s.title} className="card relative p-5">
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-btc/10 text-btc ring-1 ring-inset ring-btc/25">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {s.icon}
                </svg>
              </span>
              <span className="font-mono text-[12px] text-dim">0{i + 1}</span>
            </div>
            <h3 className="display mt-4 text-[17px] font-semibold">{s.title}</h3>
            <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
