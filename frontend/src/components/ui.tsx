"use client";
import Link from 'next/link';
import { useAtomValue } from 'jotai';
import { addressAtom } from '@/store/wallet';
import {
  STATUS_LABEL,
  categoryLabel,
  formatStx,
  shortAddr,
  type DisplayStatus,
} from '@/lib/bounties';

// ── Identicon: deterministic 5×5 mirrored avatar from an address ──

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function Avatar({ address, size = 28 }: { address: string; size?: number }) {
  const h = hash(address);
  const hue = h % 360;
  const fg = `hsl(${hue} 80% 60%)`;
  const bg = `hsl(${(hue + 40) % 360} 35% 16%)`;
  const cells: [number, number][] = [];
  let bits = hash(address + 'x');
  for (let y = 0; y < 5; y++)
    for (let x = 0; x < 3; x++) {
      if (bits & 1) {
        cells.push([x, y]);
        if (x < 2) cells.push([4 - x, y]);
      }
      bits >>>= 1;
      if (bits === 0) bits = hash(address + y + x);
    }
  return (
    <svg width={size} height={size} viewBox="-1 -1 7 7" className="shrink-0 rounded-lg" aria-hidden>
      <rect x="-1" y="-1" width="7" height="7" fill={bg} />
      {cells.map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="1.02" height="1.02" fill={fg} />
      ))}
    </svg>
  );
}

/** Address with avatar, linking to the in-app profile. */
export function Person({ address, size = 22, showAvatar = true }: { address: string; size?: number; showAvatar?: boolean }) {
  const me = useAtomValue(addressAtom);
  return (
    <Link href={`/u/${address}`} className="group inline-flex items-center gap-2 text-fg" onClick={e => e.stopPropagation()}>
      {showAvatar && <Avatar address={address} size={size} />}
      <span className="font-mono text-[13px] group-hover:text-btc">{address === me ? 'You' : shortAddr(address)}</span>
    </Link>
  );
}

// ── STX amount with the Stacks mark ──

export function StxIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="shrink-0">
      <circle cx="12" cy="12" r="12" fill="rgb(var(--stx))" />
      <path d="M7 9.2h10M7 14.8h10M9.5 6.2 12 9.2l2.5-3M9.5 17.8 12 14.8l2.5 3" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function Stx({ micro, className = '', icon = 16 }: { micro: bigint; className?: string; icon?: number }) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono tabular-nums ${className}`}>
      <StxIcon size={icon} />
      {formatStx(micro)}
      <span className="text-dim">STX</span>
    </span>
  );
}

// ── status + category ──

const STATUS_STYLE: Record<DisplayStatus, string> = {
  open: 'text-good bg-good/10 ring-good/25',
  claimed: 'text-warn bg-warn/10 ring-warn/25',
  submitted: 'text-info bg-info/10 ring-info/25',
  paid: 'text-btc bg-btc/10 ring-btc/25',
  cancelled: 'text-dim bg-raised ring-line',
  expired: 'text-dim bg-raised ring-line',
};

export function StatusPill({ status }: { status: DisplayStatus }) {
  return (
    <span className={`inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium ring-1 ring-inset ${STATUS_STYLE[status]}`}>
      <span className={`h-1.5 w-1.5 rounded-full bg-current ${status === 'open' ? 'animate-pulse' : ''}`} />
      {STATUS_LABEL[status]}
    </span>
  );
}

const CATEGORY_STYLE: Record<string, string> = {
  dev: 'text-[#a5b4fc] bg-[#6366f1]/15',
  design: 'text-[#f9a8d4] bg-[#ec4899]/15',
  content: 'text-[#fcd34d] bg-[#f59e0b]/15',
  research: 'text-[#67e8f9] bg-[#06b6d4]/15',
  community: 'text-[#86efac] bg-[#22c55e]/15',
  other: 'text-muted bg-raised',
};

export function CategoryTag({ category }: { category: string }) {
  return (
    <span className={`inline-flex h-6 items-center rounded-md px-2 text-[12px] font-medium ${CATEGORY_STYLE[category] ?? CATEGORY_STYLE.other}`}>
      {categoryLabel(category)}
    </span>
  );
}

// ── lifecycle stepper ──

const STEPS = ['Open', 'Claimed', 'Review', 'Paid'];
const STEP_INDEX: Record<DisplayStatus, number> = { open: 0, expired: 0, claimed: 1, submitted: 2, paid: 3, cancelled: -1 };

export function Stepper({ status, labels = false }: { status: DisplayStatus; labels?: boolean }) {
  const at = STEP_INDEX[status];
  return (
    <div className="w-full">
      <div className="flex items-center gap-1">
        {STEPS.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full ${
              at < 0 ? 'bg-line' : i <= at ? (at === 3 ? 'bg-btc' : 'bg-btc/80') : 'bg-line'
            }`}
          />
        ))}
      </div>
      {labels && (
        <div className="mt-2 grid grid-cols-4 text-[11px] text-dim">
          {STEPS.map((s, i) => (
            <span key={s} className={`${i === 0 ? '' : i === 3 ? 'text-right' : 'text-center'} ${i <= at ? 'text-muted' : ''}`}>
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <span className={`block animate-pulse rounded-md bg-raised ${className}`} />;
}
