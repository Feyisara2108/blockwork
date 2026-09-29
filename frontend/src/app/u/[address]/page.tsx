"use client";
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useAtomValue } from 'jotai';
import { addressAtom } from '@/store/wallet';
import { useBoard } from '@/lib/board';
import { explorer, formatStx, people, type Person as P } from '@/lib/bounties';
import { BountyCard } from '@/components/BountyCard';
import { Avatar, Skeleton, StxIcon } from '@/components/ui';

type Badge = { name: string; desc: string; earned: boolean };

function badges(p: P | undefined, rank: number | null): Badge[] {
  const earned = p?.earned ?? 0n;
  const completed = p?.completed ?? 0;
  const posted = p?.posted ?? 0;
  return [
    { name: 'First payout', desc: 'Got paid for a bounty', earned: completed >= 1 },
    { name: 'Veteran', desc: 'Completed 3+ bounties', earned: completed >= 3 },
    { name: '10 STX club', desc: 'Earned 10+ STX', earned: earned >= 10_000_000n },
    { name: 'Sponsor', desc: 'Posted a bounty', earned: posted >= 1 },
    { name: 'Patron', desc: 'Posted 25+ STX in bounties', earned: (p?.postedValue ?? 0n) >= 25_000_000n },
    { name: 'Top 3', desc: 'Top 3 earner on the board', earned: rank !== null && rank < 3 },
  ];
}

export default function ProfilePage() {
  const { address } = useParams<{ address: string }>();
  const me = useAtomValue(addressAtom);
  const { bounties, height } = useBoard();
  const [tab, setTab] = useState<'worked' | 'posted'>('worked');
  const [copied, setCopied] = useState(false);

  const all = bounties ?? [];
  const ranked = people(all).filter(p => p.earned > 0n).sort((a, b) => (b.earned > a.earned ? 1 : -1));
  const rank = ranked.findIndex(p => p.address === address);
  const p = people(all).find(x => x.address === address);
  const worked = all.filter(b => b.worker === address);
  const posted = all.filter(b => b.poster === address);
  const shown = tab === 'worked' ? worked : posted;
  const bs = badges(p, rank >= 0 ? rank : null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const stats = [
    { label: 'Earned', value: formatStx(p?.earned ?? 0n), stx: true },
    { label: 'Completed', value: String(p?.completed ?? 0) },
    { label: 'Bounties posted', value: String(p?.posted ?? 0) },
    { label: 'Posted value', value: formatStx(p?.postedValue ?? 0n), stx: true },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
      <div className="card relative overflow-hidden p-6 sm:p-8">
        <div className="grid-bg absolute inset-0 opacity-60" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          <Avatar address={address} size={88} />
          <div className="min-w-0 flex-1">
            <p className="eyebrow">{address === me ? 'Your profile' : 'Builder profile'}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="break-all font-mono text-[18px] font-semibold sm:text-[20px]">{address}</h1>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn btn-sm" onClick={copy}>{copied ? 'Copied' : 'Copy address'}</button>
              <a className="btn btn-sm" href={explorer.address(address)} target="_blank" rel="noreferrer">Explorer ↗</a>
              {rank >= 0 && (
                <span className="inline-flex h-8 items-center rounded-lg bg-btc/10 px-3 text-[13px] font-medium text-btc ring-1 ring-inset ring-btc/30">
                  #{rank + 1} earner
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map(s => (
          <div key={s.label} className="card p-5">
            <dt className="text-[12px] text-dim">{s.label}</dt>
            <dd className="mt-1 flex items-center gap-2 font-mono text-[22px] font-semibold">
              {!bounties ? <Skeleton className="h-7 w-14" /> : (
                <>
                  {s.stx && <StxIcon size={18} />}
                  {s.value}
                </>
              )}
            </dd>
          </div>
        ))}
      </dl>

      <section className="mt-10">
        <h2 className="display text-[20px] font-semibold">Reputation</h2>
        <p className="mt-1 text-[14px] text-muted">Computed from on-chain bounty history. Nothing self-reported.</p>
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {bs.map(b => (
            <li
              key={b.name}
              className={`rounded-2xl border p-4 text-center transition ${
                b.earned ? 'border-btc/40 bg-btc/5' : 'border-line bg-surface opacity-45'
              }`}
            >
              <span
                className={`mx-auto flex h-11 w-11 items-center justify-center rounded-xl ${
                  b.earned ? 'bg-btc text-black shadow-[0_0_24px_-4px_rgb(var(--btc)/0.7)]' : 'bg-raised text-dim'
                }`}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round">
                  <path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z" />
                </svg>
              </span>
              <p className="mt-3 text-[13px] font-semibold">{b.name}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-dim">{b.desc}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <div className="flex gap-2 border-b border-line pb-4">
          {(['worked', 'posted'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`h-9 rounded-lg px-3 text-[14px] ${tab === t ? 'bg-fg font-medium text-bg' : 'text-muted hover:bg-raised hover:text-fg'}`}
            >
              {t === 'worked' ? 'Worked on' : 'Posted'} <span className="ml-1 font-mono text-[12px] opacity-60">{t === 'worked' ? worked.length : posted.length}</span>
            </button>
          ))}
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {shown.map(b => <BountyCard key={b.id} bounty={b} height={height} />)}
        </div>
        {bounties && shown.length === 0 && (
          <div className="card mt-2 px-6 py-12 text-center text-[14px] text-muted">
            {tab === 'worked' ? 'No bounties worked on yet.' : 'No bounties posted yet.'}{' '}
            <Link href={tab === 'worked' ? '/#bounties' : '/post'} className="text-btc hover:underline">
              {tab === 'worked' ? 'Find one →' : 'Post one →'}
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
