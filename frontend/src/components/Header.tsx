"use client";
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { WalletConnect } from './WalletConnect'
import { useBoard } from '@/lib/board'
import { explorer } from '@/lib/bounties'

export function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
      <rect x="2" y="2" width="11" height="11" rx="2.5" fill="rgb(var(--btc))" />
      <rect x="15" y="2" width="11" height="11" rx="2.5" fill="rgb(var(--btc) / 0.45)" />
      <rect x="2" y="15" width="11" height="11" rx="2.5" fill="rgb(var(--btc) / 0.45)" />
      <rect x="15" y="15" width="11" height="11" rx="2.5" fill="rgb(var(--btc) / 0.2)" />
    </svg>
  )
}

const NAV = [
  { href: '/', label: 'Bounties' },
  { href: '/leaderboard', label: 'Leaderboard' },
]

function BlockTicker() {
  const { height } = useBoard()
  if (!height) return null
  return (
    <a
      href={explorer.block(height)}
      target="_blank"
      rel="noreferrer"
      title="Latest Bitcoin block seen by Stacks testnet. Deadlines and timeouts count these blocks."
      className="hidden items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5 font-mono text-[12px] text-muted hover:text-fg md:inline-flex"
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-btc opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-btc" />
      </span>
      BTC #{height.toLocaleString()}
    </a>
  )
}

export default function Header() {
  const path = usePathname()
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo />
          <span className="display text-[17px] font-semibold">Blockwork</span>
        </Link>
        <nav className="hidden items-center gap-1 sm:flex">
          {NAV.map(n => (
            <Link
              key={n.href}
              href={n.href}
              className={`rounded-lg px-3 py-1.5 text-[14px] transition ${
                path === n.href ? 'bg-raised text-fg' : 'text-muted hover:text-fg'
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <BlockTicker />
          <Link href="/post" className="btn-primary btn-sm hidden sm:inline-flex">
            Post a bounty
          </Link>
          <WalletConnect />
        </div>
      </div>
    </header>
  )
}
