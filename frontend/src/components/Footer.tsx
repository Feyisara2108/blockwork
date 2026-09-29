import Link from 'next/link'
import { CONTRACT_ID, explorer } from '@/lib/bounties'
import { Logo } from './Header'

export default function Footer() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <Logo />
          <div>
            <p className="display text-[15px] font-semibold">Blockwork</p>
            <p className="text-[13px] text-dim">Escrowed bounties on Stacks, settled by Bitcoin blocks.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-muted">
          {CONTRACT_ID && (
            <a className="font-mono hover:text-btc" href={explorer.address(CONTRACT_ID)} target="_blank" rel="noreferrer">
              Contract ↗
            </a>
          )}
          <a className="hover:text-btc" href="https://github.com/scaffold-stack/scaffold-stack" target="_blank" rel="noreferrer">
            Built with Scaffold Stacks
          </a>
          <Link className="hover:text-btc" href="/debug">Debug panel</Link>
        </div>
      </div>
    </footer>
  )
}
