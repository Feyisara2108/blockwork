import type { ReactNode } from 'react';
import './globals.css';
import { WalletProvider } from '../components/WalletConnect';
import Header from '../components/Header';
import Footer from '@/components/Footer';
import { BoardProvider } from '@/lib/board';

export const metadata = {
  title: 'Blockwork · Escrowed bounties on Stacks',
  description: 'Post tasks with the STX reward locked in a Clarity contract. Deadlines and timeouts are counted in Bitcoin blocks.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <WalletProvider>
          <BoardProvider>
            <Header />
            {children}
            <Footer />
          </BoardProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
