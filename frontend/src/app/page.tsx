import { Hero, HowItWorks } from '@/components/Hero';
import { Marketplace } from '@/components/Marketplace';

export default function Home() {
  return (
    <main>
      <Hero />
      <Marketplace />
      <HowItWorks />
    </main>
  );
}
