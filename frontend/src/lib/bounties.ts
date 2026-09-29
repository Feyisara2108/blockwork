import { Cl, cvToValue, fetchCallReadOnlyFunction, type ClarityValue } from '@stacks/transactions';
import deployments from '@/generated/deployments.json';
import { getReadOnlyNetwork, scaffoldConfig } from '@/scaffold.config';

// Auto-versioned redeploys rename the contract (bounty-board-v2, -v3…), so pick
// whichever bounty-board entry deploy wrote rather than hard-coding a name.
const deployed = Object.entries((deployments as any)?.contracts ?? {}).find(([name]) =>
  name.startsWith('bounty-board'),
) as [string, { contract_id: string }] | undefined;

export const CONTRACT_ID: string = deployed?.[1].contract_id ?? '';
const [CONTRACT_ADDRESS, CONTRACT_NAME] = CONTRACT_ID.split('.');

export const MIN_REWARD_STX = 0.1;
export const MINUTES_PER_BURN_BLOCK = 10;

// ── types ─────────────────────────────────────────────────

export type Status = 'open' | 'claimed' | 'submitted' | 'paid' | 'cancelled';
/** Status as shown in the UI: an open bounty past its deadline is 'expired'. */
export type DisplayStatus = Status | 'expired';
const STATUSES: Status[] = ['open', 'claimed', 'submitted', 'paid', 'cancelled'];

export const STATUS_LABEL: Record<DisplayStatus, string> = {
  open: 'Open',
  claimed: 'In progress',
  submitted: 'In review',
  paid: 'Paid',
  cancelled: 'Cancelled',
  expired: 'Expired',
};

export const CATEGORIES = [
  { key: 'dev', label: 'Development' },
  { key: 'design', label: 'Design' },
  { key: 'content', label: 'Content' },
  { key: 'research', label: 'Research' },
  { key: 'community', label: 'Community' },
  { key: 'other', label: 'Other' },
] as const;
export type Category = (typeof CATEGORIES)[number]['key'];
export const categoryLabel = (c: string) => CATEGORIES.find(x => x.key === c)?.label ?? 'Other';

export const DURATIONS = [
  { blocks: 144, label: '1 day' },
  { blocks: 432, label: '3 days' },
  { blocks: 1008, label: '1 week' },
  { blocks: 2016, label: '2 weeks' },
  { blocks: 4320, label: '30 days' },
];

export type Bounty = {
  id: number;
  poster: string;
  title: string;
  details: string;
  category: string;
  reward: bigint; // micro-STX
  status: Status;
  worker: string | null;
  submission: string | null;
  createdAt: number;
  deadline: number;
  claimedAt: number;
  submittedAt: number;
};

export type Windows = { claimWindow: number; reviewWindow: number; currentHeight: number };

export function displayStatus(b: Bounty, height: number): DisplayStatus {
  return b.status === 'open' && height > 0 && height >= b.deadline ? 'expired' : b.status;
}

// ── reads ─────────────────────────────────────────────────

async function readOnly(functionName: string, functionArgs: ClarityValue[] = []) {
  const cv = await fetchCallReadOnlyFunction({
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName,
    functionArgs,
    network: getReadOnlyNetwork(),
    senderAddress: CONTRACT_ADDRESS,
  });
  return cvToValue(cv);
}

/**
 * cvToValue returns tuple fields as cvToJSON shapes ({ type, value }) and nests
 * optionals one level deeper. Peel every { value } wrapper down to a plain value.
 */
function plain(raw: unknown): any {
  let v: any = raw;
  while (v !== null && typeof v === 'object' && 'value' in v) v = v.value;
  return v ?? null;
}
const num = (raw: unknown) => Number(plain(raw) ?? 0);

function toBounty(id: number, raw: any): Bounty {
  return {
    id,
    poster: plain(raw.poster),
    title: plain(raw.title),
    details: plain(raw.details) ?? '',
    category: plain(raw.category) ?? 'other',
    reward: BigInt(plain(raw.reward) ?? 0),
    status: STATUSES[num(raw.status)] ?? 'open',
    worker: plain(raw.worker),
    submission: plain(raw.submission),
    createdAt: num(raw['created-at']),
    deadline: num(raw.deadline),
    claimedAt: num(raw['claimed-at']),
    submittedAt: num(raw['submitted-at']),
  };
}

export async function fetchBounties(): Promise<Bounty[]> {
  if (!CONTRACT_ID) return [];
  const count = num(await readOnly('get-bounty-count'));
  const ids = Array.from({ length: count }, (_, i) => count - i); // newest first
  const rows = await Promise.all(ids.map(id => readOnly('get-bounty', [Cl.uint(id)])));
  return rows.flatMap((raw, i) => (raw ? [toBounty(ids[i], plain(raw) ?? raw)] : []));
}

export async function fetchWindows(): Promise<Windows | null> {
  if (!CONTRACT_ID) return null;
  const raw: any = await readOnly('get-windows');
  return {
    claimWindow: num(raw['claim-window']),
    reviewWindow: num(raw['review-window']),
    currentHeight: num(raw['current-height']),
  };
}

// ── activity (from the Hiro API's transaction history) ────

export type ActivityKind =
  | 'post-bounty'
  | 'claim-bounty'
  | 'abandon-claim'
  | 'submit-work'
  | 'approve-work'
  | 'cancel-bounty'
  | 'reopen-bounty'
  | 'claim-payout';

export type Activity = {
  kind: ActivityKind;
  bountyId: number;
  sender: string;
  txid: string;
  time: string; // ISO
};

export const ACTIVITY_LABEL: Record<ActivityKind, string> = {
  'post-bounty': 'Posted and locked the reward',
  'claim-bounty': 'Claimed the bounty',
  'abandon-claim': 'Dropped the claim',
  'submit-work': 'Submitted work',
  'approve-work': 'Approved and paid out',
  'cancel-bounty': 'Cancelled and refunded',
  'reopen-bounty': 'Reopened after the claim window',
  'claim-payout': 'Collected payment after the review window',
};

const headers = (): Record<string, string> =>
  scaffoldConfig.hiroApiKey ? { 'x-api-key': scaffoldConfig.hiroApiKey } : {};

export async function fetchActivity(pages = 4): Promise<Activity[]> {
  if (!CONTRACT_ID) return [];
  const out: Activity[] = [];
  for (let page = 0; page < pages; page++) {
    const r = await fetch(
      `${scaffoldConfig.nodeUrl}/extended/v1/address/${CONTRACT_ID}/transactions?limit=50&offset=${page * 50}`,
      { headers: headers(), cache: 'no-store' },
    );
    if (!r.ok) break;
    const { results = [], total = 0 } = await r.json();
    for (const tx of results) {
      if (tx.tx_type !== 'contract_call' || tx.tx_status !== 'success') continue;
      const kind = tx.contract_call?.function_name as ActivityKind;
      if (!(kind in ACTIVITY_LABEL)) continue;
      const idRepr = kind === 'post-bounty' ? tx.tx_result?.repr : tx.contract_call?.function_args?.[0]?.repr;
      const bountyId = Number(String(idRepr ?? '').match(/u(\d+)/)?.[1] ?? NaN);
      if (!Number.isFinite(bountyId)) continue;
      out.push({
        kind,
        bountyId,
        sender: tx.sender_address,
        txid: tx.tx_id,
        time: tx.block_time_iso ?? tx.burn_block_time_iso ?? '',
      });
    }
    if ((page + 1) * 50 >= total) break;
  }
  return out; // newest first
}

// ── aggregates ────────────────────────────────────────────

export type Person = { address: string; earned: bigint; completed: number; posted: number; postedValue: bigint };

export function people(bounties: Bounty[]): Person[] {
  const map = new Map<string, Person>();
  const get = (a: string) => {
    if (!map.has(a)) map.set(a, { address: a, earned: 0n, completed: 0, posted: 0, postedValue: 0n });
    return map.get(a)!;
  };
  for (const b of bounties) {
    if (b.status !== 'cancelled') {
      const p = get(b.poster);
      p.posted += 1;
      p.postedValue += b.reward;
    }
    if (b.status === 'paid' && b.worker) {
      const w = get(b.worker);
      w.earned += b.reward;
      w.completed += 1;
    }
  }
  return [...map.values()];
}

export function totals(bounties: Bounty[]) {
  let escrow = 0n;
  let paid = 0n;
  for (const b of bounties) {
    if (b.status === 'open' || b.status === 'claimed' || b.status === 'submitted') escrow += b.reward;
    if (b.status === 'paid') paid += b.reward;
  }
  const builders = new Set(bounties.flatMap(b => [b.poster, b.worker].filter(Boolean) as string[])).size;
  return { escrow, paid, builders, count: bounties.length, open: bounties.filter(b => b.status === 'open').length };
}

// ── formatting ────────────────────────────────────────────

export function formatStx(micro: bigint): string {
  const whole = micro / 1_000_000n;
  const frac = (micro % 1_000_000n).toString().padStart(6, '0').replace(/0+$/, '').slice(0, 2);
  return frac ? `${whole.toLocaleString()}.${frac}` : whole.toLocaleString();
}

export function toMicroStx(input: string): bigint | null {
  const m = input.trim().match(/^(\d+)(?:\.(\d{1,6}))?$/);
  if (!m) return null;
  return BigInt(m[1]) * 1_000_000n + BigInt((m[2] ?? '').padEnd(6, '0') || '0');
}

export const shortAddr = (a: string) => `${a.slice(0, 5)}…${a.slice(-4)}`;

export function blocksToTime(blocks: number): string {
  const mins = Math.max(blocks, 0) * MINUTES_PER_BURN_BLOCK;
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  return hours < 48 ? `${hours}h` : `${Math.round(hours / 24)}d`;
}

export function timeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (!Number.isFinite(s)) return '';
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const chain = scaffoldConfig.explorerChainQuery;
export const explorer = {
  tx: (txid: string) => `https://explorer.hiro.so/txid/${txid}${chain}`,
  address: (addr: string) => `https://explorer.hiro.so/address/${addr}${chain}`,
  block: (h: number) => `https://mempool.space/testnet4/block/${h}`,
};
