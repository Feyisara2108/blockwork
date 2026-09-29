"use client";
import Link from 'next/link';
import { useState } from 'react';
import { useBoard } from '@/lib/board';
import { people, shortAddr } from '@/lib/bounties';
import { Avatar, Person, Skeleton, Stx } from '@/components/ui';

type Board = 'earners' | 'sponsors';

export default function LeaderboardPage() {
  const { bounties } = useBoard();
  const [board, setBoard] = useState<Board>('earners');

  const ps = people(bounties ?? []);
  const rows =
    board === 'earners'
      ? ps.filter(p => p.earned > 0n).sort((a, b) => (b.earned > a.earned ? 1 : b.earned < a.earned ? -1 : b.completed - a.completed))
      : ps.filter(p => p.posted > 0).sort((a, b) => (b.postedValue > a.postedValue ? 1 : b.postedValue < a.postedValue ? -1 : 0));

  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);
  const amount = (p: (typeof rows)[number]) => (board === 'earners' ? p.earned : p.postedValue);
  const count = (p: (typeof rows)[number]) => (board === 'earners' ? `${p.completed} completed` : `${p.posted} posted`);

  return (
    <main className="mx-auto max-w-4xl px-4 pt-10 sm:px-6">
      <p className="eyebrow">Leaderboard</p>
      <h1 className="display mt-2 text-[36px] font-bold">Who’s shipping on Stacks.</h1>
      <p className="mt-2 text-[15px] text-muted">Ranked from paid-out bounties on the contract. Updates every block.</p>

      <div className="mt-8 inline-flex rounded-xl border border-line bg-surface p-1">
        {(['earners', 'sponsors'] as const).map(b => (
          <button
            key={b}
            onClick={() => setBoard(b)}
            className={`h-9 rounded-lg px-4 text-[14px] transition ${board === b ? 'bg-btc font-semibold text-black' : 'text-muted hover:text-fg'}`}
          >
            {b === 'earners' ? 'Top earners' : 'Top sponsors'}
          </button>
        ))}
      </div>

      {!bounties ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map(i => <Skeleton key={i} className="h-44 rounded-2xl" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="card mt-8 px-6 py-14 text-center text-[14px] text-muted">
          Nobody here yet. <Link href="/#bounties" className="text-btc hover:underline">Complete a bounty</Link> to take #1.
        </div>
      ) : (
        <>
          <ol className="mt-8 grid items-end gap-4 sm:grid-cols-3">
            {[1, 0, 2].map(i => {
              const p = podium[i];
              if (!p) return <li key={i} className="hidden sm:block" />;
              const first = i === 0;
              return (
                <li
                  key={p.address}
                  className={`card flex flex-col items-center p-6 text-center ${first ? 'border-btc/50 bg-gradient-to-b from-btc/15 to-surface sm:pb-10' : ''}`}
                >
                  <span className={`font-mono text-[13px] ${first ? 'text-btc' : 'text-dim'}`}>#{i + 1}</span>
                  <Link href={`/u/${p.address}`} className="mt-3">
                    <Avatar address={p.address} size={first ? 72 : 56} />
                  </Link>
                  <Link href={`/u/${p.address}`} className="mt-3 font-mono text-[14px] hover:text-btc">{shortAddr(p.address)}</Link>
                  <Stx micro={amount(p)} icon={18} className={`mt-2 font-semibold ${first ? 'text-[22px] text-btc' : 'text-[18px]'}`} />
                  <p className="mt-1 text-[12px] text-dim">{count(p)}</p>
                </li>
              );
            })}
          </ol>

          {rest.length > 0 && (
            <ol className="card mt-4 divide-y divide-line">
              {rest.map((p, i) => (
                <li key={p.address} className="flex items-center gap-4 px-5 py-3.5">
                  <span className="w-6 font-mono text-[13px] text-dim">{i + 4}</span>
                  <div className="flex-1"><Person address={p.address} size={28} /></div>
                  <span className="hidden text-[13px] text-dim sm:block">{count(p)}</span>
                  <Stx micro={amount(p)} icon={14} className="text-[14px]" />
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </main>
  );
}
