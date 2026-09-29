# Blockwork

Post a task on Stacks with the STX reward locked in a Clarity contract. A worker claims it, submits a link to their work, and the poster approves to release payment. If either side goes quiet, a timeout lets the other recover the funds, so money is never stuck with the contract.

Built with [Scaffold Stacks](https://github.com/scaffold-stack/scaffold-stack) for the Scaffold Stacks 20 Builders Challenge.

- **Live app:** _TODO after Vercel deploy_
- **Contract (testnet):** [`ST1CT84KE73BCV45RS5BTMRWXGQM8FJXA3AW36PYS.bounty-board-v2`](https://explorer.hiro.so/address/ST1CT84KE73BCV45RS5BTMRWXGQM8FJXA3AW36PYS.bounty-board-v2?chain=testnet)

## Features

- **Marketplace** with live stats (STX in escrow, paid out, open bounties, builders), category filters, search, and sort by reward or deadline.
- **Bounty pages** with a lifecycle stepper, the actions available to *your* wallet, and an **on-chain activity timeline** where every step links to its transaction.
- **Builder profiles** (`/u/<address>`) with earnings and reputation badges computed only from contract history.
- **Leaderboard** of top earners and top sponsors.
- **Post flow** with categories, a claim deadline (1 day to 30 days, in Bitcoin blocks), and a live preview card.
- **Live Bitcoin block ticker**: deadlines and timeouts count Bitcoin blocks, so the UI shows the chain they depend on.

## How it works

```
post-bounty ──► OPEN ──claim-bounty──► IN PROGRESS ──submit-work──► IN REVIEW ──approve-work──► PAID
                 │  ▲                     │                             │
   cancel-bounty │  └─ abandon-claim ─────┤                             └─ claim-payout (after review window) ──► PAID
       (refund)  ▼     reopen-bounty ─────┘ (poster, after claim window)
             CANCELLED
```

| Function | Who | What it does |
|---|---|---|
| `post-bounty(title, details, category, reward, duration)` | anyone | Transfers `reward` µSTX into the contract; open for claims for `duration` Bitcoin blocks |
| `cancel-bounty(id)` | poster | Refunds an unclaimed bounty |
| `claim-bounty(id)` | anyone but the poster | Takes the task (before the deadline) |
| `abandon-claim(id)` | worker | Gives the task back |
| `submit-work(id, link)` | worker | Records a link to the finished work |
| `approve-work(id)` | poster | Pays the worker |
| `reopen-bounty(id)` | poster | Takes back a claim with no submission after 144 Bitcoin blocks (~1 day) |
| `claim-payout(id)` | worker | Collects payment if the poster hasn't reviewed within 144 Bitcoin blocks |
| `get-bounty`, `get-bounty-count`, `get-windows` | read-only | |

Design notes:

- **Payouts use Clarity 6 `as-contract?` with a `with-stx` allowance** capped at the bounty's reward, so a payout can never move more than that bounty holds.
- **Timeouts use `burn-block-height`** (Bitcoin blocks, ~10 min) rather than Stacks blocks, which are only seconds apart after Nakamoto.
- **Every wallet call uses post-condition deny mode.** Posting asserts you send exactly the reward; payouts and refunds assert the contract sends exactly the reward. The wallet shows the amount and rejects anything else.

## Stack

Clarity 6 (epoch 4.0) · Clarinet 3.24 · Scaffold Stacks 0.2.2 · Next.js 15 · Tailwind · Jotai · `@stacks/connect` v8

## Run it

Requires Rust, Node 20+, Clarinet 3.23+, `cargo install stacksdapp`.

```bash
stacksdapp check && stacksdapp test   # 16 simnet tests
stacksdapp dev --network testnet      # http://localhost:3000
```

To deploy your own copy: put a **testnet-only** mnemonic in `contracts/settings/Testnet.toml`, fund it from the [Hiro faucet](https://explorer.hiro.so/sandbox/faucet?chain=testnet), then `stacksdapp deploy --network testnet --yes --wait-confirm`.

The contract-level debug panel is at `/debug`.

## Tests

`contracts/tests/bounty-board.test.ts` covers the full claim → submit → approve flow with balance checks, every permission check (poster vs worker vs stranger), cancel/abandon, claim deadlines, duration bounds, and both timeouts using `simnet.mineEmptyBurnBlocks`.

## Feedback on Scaffold Stacks

**What worked well**
- `stacksdapp new` → `add` → `check` → `test` → `generate` is fast. The contract was type-checked and tested before any frontend existed, and the generated `contracts.ts` gave me typed-by-name read functions for free.
- `stacksdapp doctor` caught missing Clarinet immediately.
- Simnet tests with `mineEmptyBurnBlocks` made the timeout logic easy to verify without a devnet.

**Friction**
- **Generated calls hard-code `postConditionMode: 'allow'`.** For an escrow contract I wanted deny mode, so I wrote a small `useContractCall` hook (`frontend/src/lib/tx.ts`) that calls `request('stx_callContract')` directly and reuses the generated deployments. A `postConditionMode` option on the generated hooks would remove that.
- **The generated debug panel imports `@/components/Message`,** a template component. Deleting it while cleaning up the template broke `tsc`. Generated code shouldn't depend on template UI.
- **Read-only results are mixed shapes:** `cvToValue` returns plain values at the top level but `cvToJSON` `{ type, value }` objects inside tuples and optionals. I unwrap with a small helper (`plain()` in `lib/bounties.ts`).
- **The bundled Clarity cheat sheet still lists `as-contract`,** which doesn't exist in Clarity 6. The docs had to be checked for `as-contract?` + `with-stx`.
- **Auto-versioning renames the generated bindings.** Redeploying created `bounty-board-v2` and every generated function changed from `bountyBoard_*` to `bountyBoardV2_*`, breaking my imports. I now read the contract id from `deployments.json` by prefix and call read-only functions directly. A stable alias (e.g. always exporting the latest version under the base name) would help.
- No `stacksdapp remove` command. Removing the starter `counter` contract meant editing `Clarinet.toml` by hand.
- On a Mac without Homebrew there's no install path for Clarinet in the docs. I used the release binary from GitHub.
