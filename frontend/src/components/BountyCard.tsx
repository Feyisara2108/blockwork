"use client";
import Link from 'next/link';
import { blocksToTime, displayStatus, type Bounty } from '@/lib/bounties';
import { CategoryTag, Person, StatusPill, Stepper, Stx } from './ui';

export function deadlineText(b: Bounty, height: number) {
  const s = displayStatus(b, height);
  if (s === 'open') return `Closes in ${blocksToTime(b.deadline - height)}`;
  if (s === 'expired') return 'Claims closed';
  if (s === 'claimed') return 'Worker is on it';
  if (s === 'submitted') return 'Awaiting review';
  if (s === 'paid') return 'Completed';
  return 'Refunded';
}

export function BountyCard({ bounty: b, height }: { bounty: Bounty; height: number }) {
  const status = displayStatus(b, height);
  const faded = status === 'cancelled' || status === 'expired';
  return (
    <div
      className={`group relative flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 transition
        hover:-translate-y-0.5 hover:border-btc/50 hover:shadow-[0_12px_40px_-16px_rgb(var(--btc)/0.35)] ${faded ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center justify-between gap-3">
        <CategoryTag category={b.category} />
        <StatusPill status={status} />
      </div>

      <div className="min-h-[76px]">
        <h3 className="display line-clamp-2 text-[18px] font-semibold leading-snug group-hover:text-btc">
          {/* Stretched link: the whole card is clickable without nesting the poster link inside it. */}
          <Link href={`/bounty/${b.id}`} className="after:absolute after:inset-0 after:rounded-2xl focus:outline-none">
            {b.title}
          </Link>
        </h3>
        {b.details && <p className="mt-1.5 line-clamp-2 text-[14px] leading-relaxed text-muted">{b.details}</p>}
      </div>

      <Stepper status={status} />

      <div className="flex items-end justify-between gap-3">
        <div className="space-y-1.5">
          <span className="relative z-10"><Person address={b.poster} size={20} /></span>
          <p className="font-mono text-[12px] text-dim">
            #{b.id} · {deadlineText(b, height)}
          </p>
        </div>
        <Stx micro={b.reward} icon={20} className="text-[20px] font-semibold" />
      </div>
    </div>
  );
}
