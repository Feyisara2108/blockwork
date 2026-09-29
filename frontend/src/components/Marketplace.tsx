"use client";
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useAtomValue } from 'jotai';
import { addressAtom } from '@/store/wallet';
import { useBoard } from '@/lib/board';
import { CATEGORIES, displayStatus, formatStx, people, type Bounty } from '@/lib/bounties';
import { BountyCard } from './BountyCard';
import { Avatar, Person, Skeleton, Stx } from './ui';

type Tab = 'open' | 'active' | 'done' | 'all' | 'mine';
type Sort = 'new' | 'reward' | 'ending';

const TABS: { key: Tab; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'active', label: 'In progress' },
  { key: 'done', label: 'Completed' },
  { key: 'all', label: 'All' },
  { key: 'mine', label: 'Mine' },
];

function inTab(b: Bounty, tab: Tab, height: number, me: string | null) {
  const s = displayStatus(b, height);
  switch (tab) {
    case 'open': return s === 'open';
    case 'active': return s === 'claimed' || s === 'submitted';
    case 'done': return s === 'paid' || s === 'cancelled' || s === 'expired';
    case 'mine': return !!me && (b.poster === me || b.worker === me);
    default: return true;
  }
}

export function Marketplace() {
  const me = useAtomValue(addressAtom);
  const { bounties, height, error, reload } = useBoard();
  const [tab, setTab] = useState<Tab>('open');
  const [cat, setCat] = useState<string>('all');
  const [sort, setSort] = useState<Sort>('new');
  const [q, setQ] = useState('');

  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    const out = (bounties ?? []).filter(
      b =>
        inTab(b, tab, height, me) &&
        (cat === 'all' || b.category === cat) &&
        (!query || b.title.toLowerCase().includes(query) || b.details.toLowerCase().includes(query)),
    );
    if (sort === 'reward') out.sort((a, b) => (b.reward > a.reward ? 1 : b.reward < a.reward ? -1 : 0));
    if (sort === 'ending') out.sort((a, b) => a.deadline - b.deadline);
    return out;
  }, [bounties, tab, cat, sort, q, height, me]);

  return (
    <section id="bounties" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-20 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Bounties</p>
          <h2 className="display mt-2 text-[28px] font-semibold">Pick something to ship.</h2>
        </div>
        <div className="flex gap-2">
          <input className="input h-10 w-full py-0 sm:w-56" placeholder="Search bounties" value={q} onChange={e => setQ(e.target.value)} />
          <select className="input h-10 w-auto py-0" value={sort} onChange={e => setSort(e.target.value as Sort)} aria-label="Sort">
            <option value="new">Newest</option>
            <option value="reward">Highest reward</option>
            <option value="ending">Ending soon</option>
          </select>
        </div>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_300px]">
        <div>
          <div className="flex flex-wrap items-center gap-2 border-b border-line pb-4">
            {TABS.filter(t => t.key !== 'mine' || me).map(t => {
              const count = (bounties ?? []).filter(b => inTab(b, t.key, height, me)).length;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`h-9 rounded-lg px-3 text-[14px] transition ${
                    tab === t.key ? 'bg-fg font-medium text-bg' : 'text-muted hover:bg-raised hover:text-fg'
                  }`}
                >
                  {t.label} <span className="ml-1 font-mono text-[12px] opacity-60">{count}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {[{ key: 'all', label: 'All categories' }, ...CATEGORIES].map(c => (
              <button
                key={c.key}
                onClick={() => setCat(c.key)}
                className={`h-8 rounded-full border px-3 text-[13px] transition ${
                  cat === c.key ? 'border-btc bg-btc/10 text-btc' : 'border-line text-muted hover:border-dim hover:text-fg'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {error && (
            <div className="mt-6 rounded-xl border border-bad/30 bg-bad/5 p-4 text-[14px] text-bad">
              {error} <button className="underline" onClick={() => void reload()}>Retry</button>
            </div>
          )}

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {bounties === null
              ? [0, 1, 2, 3].map(i => (
                  <div key={i} className="card space-y-4 p-5">
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-1.5 w-full" />
                    <Skeleton className="h-6 w-1/3" />
                  </div>
                ))
              : list.map(b => <BountyCard key={b.id} bounty={b} height={height} />)}
          </div>

          {bounties && list.length === 0 && (
            <div className="card mt-2 flex flex-col items-center gap-3 px-6 py-14 text-center">
              <p className="display text-[18px] font-semibold">Nothing here yet.</p>
              <p className="max-w-sm text-[14px] text-muted">
                {tab === 'open' ? 'No open bounties match. Post one and lock the reward so builders know it’s real.' : 'Try another tab or category.'}
              </p>
              <Link href="/post" className="btn-primary btn-sm mt-2">Post a bounty</Link>
            </div>
          )}
        </div>

        <Sidebar />
      </div>
    </section>
  );
}

function Sidebar() {
  const me = useAtomValue(addressAtom);
  const { bounties } = useBoard();
  const all = bounties ?? [];
  const earners = people(all).filter(p => p.earned > 0n).sort((a, b) => (b.earned > a.earned ? 1 : -1)).slice(0, 5);
  const payouts = all.filter(b => b.status === 'paid' && b.worker).slice(0, 4);
  const mine = me ? people(all).find(p => p.address === me) : null;

  return (
    <aside className="space-y-4">
      {me && (
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <Avatar address={me} size={36} />
            <div className="min-w-0">
              <p className="text-[13px] text-dim">Your reputation</p>
              <Link href={`/u/${me}`} className="text-[14px] font-medium hover:text-btc">View profile →</Link>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-[13px]">
            <div className="rounded-xl bg-raised p-3">
              <p className="text-dim">Earned</p>
              <p className="mt-0.5 font-mono text-[16px] font-semibold">{formatStx(mine?.earned ?? 0n)}</p>
            </div>
            <div className="rounded-xl bg-raised p-3">
              <p className="text-dim">Completed</p>
              <p className="mt-0.5 font-mono text-[16px] font-semibold">{mine?.completed ?? 0}</p>
            </div>
          </div>
        </div>
      )}

      <div className="card p-5">
        <div className="flex items-center justify-between">
          <h3 className="display text-[15px] font-semibold">Top earners</h3>
          <Link href="/leaderboard" className="text-[13px] text-muted hover:text-btc">All →</Link>
        </div>
        <ol className="mt-4 space-y-3">
          {earners.length === 0 && <li className="text-[13px] text-dim">No payouts yet. Be the first.</li>}
          {earners.map((p, i) => (
            <li key={p.address} className="flex items-center gap-3">
              <span className={`w-4 font-mono text-[12px] ${i === 0 ? 'text-btc' : 'text-dim'}`}>{i + 1}</span>
              <div className="min-w-0 flex-1"><Person address={p.address} size={24} /></div>
              <Stx micro={p.earned} icon={14} className="text-[13px]" />
            </li>
          ))}
        </ol>
      </div>

      <div className="card p-5">
        <h3 className="display text-[15px] font-semibold">Recent payouts</h3>
        <ul className="mt-4 space-y-4">
          {payouts.length === 0 && <li className="text-[13px] text-dim">Nothing paid out yet.</li>}
          {payouts.map(b => (
            <li key={b.id}>
              <Link href={`/bounty/${b.id}`} className="line-clamp-1 text-[14px] hover:text-btc">{b.title}</Link>
              <div className="mt-1 flex items-center justify-between">
                <Person address={b.worker!} size={18} />
                <Stx micro={b.reward} icon={14} className="text-[13px] text-btc" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
