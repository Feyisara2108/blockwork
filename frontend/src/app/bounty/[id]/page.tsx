"use client";
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useBoard } from '@/lib/board';
import {
  ACTIVITY_LABEL,
  CONTRACT_ID,
  blocksToTime,
  displayStatus,
  explorer,
  fetchActivity,
  timeAgo,
  type Activity,
} from '@/lib/bounties';
import { BountyActions } from '@/components/BountyActions';
import { deadlineText } from '@/components/BountyCard';
import { CategoryTag, Person, Skeleton, StatusPill, Stepper, Stx } from '@/components/ui';

export default function BountyPage() {
  const { id } = useParams<{ id: string }>();
  const bountyId = Number(id);
  const { bounties, height, reload } = useBoard();
  const [activity, setActivity] = useState<Activity[] | null>(null);

  const loadActivity = useCallback(async () => {
    try {
      const all = await fetchActivity();
      setActivity(all.filter(a => a.bountyId === bountyId));
    } catch {
      setActivity([]);
    }
  }, [bountyId]);

  useEffect(() => {
    void loadActivity();
  }, [loadActivity]);

  const onChanged = useCallback(() => {
    void reload();
    // The API indexes the new tx a few seconds after it confirms.
    setTimeout(() => void loadActivity(), 4000);
  }, [reload, loadActivity]);

  const b = bounties?.find(x => x.id === bountyId);

  if (bounties && !b) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-24 text-center">
        <p className="display text-[24px] font-semibold">Bounty #{id} doesn’t exist.</p>
        <Link href="/" className="btn mt-6">Back to bounties</Link>
      </main>
    );
  }

  const status = b ? displayStatus(b, height) : 'open';
  const safeLink = b?.submission && /^https?:\/\//i.test(b.submission) ? b.submission : null;

  return (
    <main className="mx-auto max-w-6xl px-4 pt-8 sm:px-6">
      <Link href="/#bounties" className="text-[14px] text-muted hover:text-fg">← All bounties</Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          {!b ? (
            <div className="space-y-4">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-10 w-3/4" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <CategoryTag category={b.category} />
                <StatusPill status={status} />
                <span className="font-mono text-[13px] text-dim">#{b.id}</span>
              </div>
              <h1 className="display mt-4 text-[32px] font-bold leading-tight sm:text-[40px]">{b.title}</h1>
              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[14px] text-muted">
                <span className="flex items-center gap-2">Posted by <Person address={b.poster} /></span>
                {b.worker && <span className="flex items-center gap-2">Builder <Person address={b.worker} /></span>}
              </div>

              <div className="card mt-8 p-6">
                <h2 className="text-[13px] font-medium uppercase tracking-wider text-dim">Brief</h2>
                <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed">
                  {b.details || <span className="text-dim">No details provided.</span>}
                </p>
              </div>

              {b.submission && (
                <div className="card mt-4 p-6">
                  <h2 className="text-[13px] font-medium uppercase tracking-wider text-dim">Submission</h2>
                  {safeLink ? (
                    <a href={safeLink} target="_blank" rel="noreferrer nofollow" className="mt-3 block break-all font-mono text-[14px] text-btc hover:underline">
                      {b.submission} ↗
                    </a>
                  ) : (
                    <p className="mt-3 break-all font-mono text-[14px]">{b.submission}</p>
                  )}
                  <p className="mt-2 text-[12px] text-dim">Recorded at Bitcoin block {b.submittedAt.toLocaleString()}</p>
                </div>
              )}
            </>
          )}

          <div className="mt-10">
            <h2 className="display text-[20px] font-semibold">On-chain activity</h2>
            <p className="mt-1 text-[14px] text-muted">Every step is a Stacks transaction. Click to verify it on the explorer.</p>
            <ol className="relative mt-6 space-y-6 border-l border-line pl-6">
              {activity === null &&
                [0, 1].map(i => (
                  <li key={i}><Skeleton className="h-10 w-2/3" /></li>
                ))}
              {activity?.length === 0 && <li className="text-[14px] text-dim">No activity indexed yet.</li>}
              {activity?.map((a, i) => (
                <li key={a.txid} className="relative">
                  <span
                    className={`absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-full border-2 border-bg ${
                      i === 0 ? 'bg-btc shadow-[0_0_12px_rgb(var(--btc)/0.8)]' : 'bg-dim'
                    }`}
                  />
                  <p className="text-[15px] font-medium">{ACTIVITY_LABEL[a.kind]}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
                    <Person address={a.sender} size={18} />
                    <span>{timeAgo(a.time)}</span>
                    <a href={explorer.tx(a.txid)} target="_blank" rel="noreferrer" className="font-mono text-dim hover:text-btc">
                      {a.txid.slice(0, 10)}… ↗
                    </a>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card overflow-hidden">
            <div className="border-b border-line bg-gradient-to-br from-btc/15 to-transparent p-6">
              <p className="text-[13px] text-muted">Reward</p>
              {b ? <Stx micro={b.reward} icon={28} className="mt-1 text-[36px] font-bold" /> : <Skeleton className="mt-2 h-10 w-32" />}
              <a
                href={explorer.address(CONTRACT_ID)}
                target="_blank"
                rel="noreferrer"
                className="mt-3 flex w-fit items-center gap-1.5 text-[12px] text-muted hover:text-btc"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z" /></svg>
                {b && (b.status === 'paid' ? 'Paid out from escrow' : b.status === 'cancelled' ? 'Refunded to poster' : 'Held in escrow by the contract')} ↗
              </a>
            </div>
            <div className="space-y-5 p-6">
              {b && <Stepper status={status} labels />}
              {b && (
                <dl className="grid grid-cols-2 gap-3 text-[13px]">
                  <div className="rounded-xl bg-raised p-3">
                    <dt className="text-dim">Deadline</dt>
                    <dd className="mt-0.5 font-medium">{deadlineText(b, height)}</dd>
                  </div>
                  <div className="rounded-xl bg-raised p-3">
                    <dt className="text-dim">Closes at</dt>
                    <dd className="mt-0.5 font-mono font-medium">
                      #{b.deadline.toLocaleString()}
                      {status === 'open' && <span className="text-dim"> ({blocksToTime(b.deadline - height)})</span>}
                    </dd>
                  </div>
                </dl>
              )}
              {b && <BountyActions bounty={b} onChanged={onChanged} />}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
