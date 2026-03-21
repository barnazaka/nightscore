import readline from 'readline';
import { createWitnesses, DEFAULT_CREDIT_PROFILE, CreditProfile } from './witnesses.js';
import { Contract } from '../../contract/managed/contract/index.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const prompt = (q: string): Promise<string> =>
  new Promise((res) => rl.question(q, res));

const TIER_LABELS: Record<number, string> = {
  0: 'UNQUALIFIED',
  1: 'BRONZE  (eligible for micro-loans up to $500)',
  2: 'SILVER  (eligible for loans up to $5,000)',
  3: 'GOLD    (eligible for loans up to $50,000)',
};

async function collectCreditProfile(): Promise<CreditProfile> {
  console.log('\n  Your financial data never leaves this device.');
  console.log('  Only the ZK proof of your credit tier is written on-chain.\n');

  const repayments = parseInt(await prompt('  On-chain loan repayments completed: '));
  const age = parseInt(await prompt('  Wallet age in days: '));
  const volume = parseInt(await prompt('  Total on-chain volume (USD): '));
  const numDefaults = parseInt(await prompt('  Number of past defaults/liquidations: '));

  return {
    onChainRepayments: repayments,
    walletAgeInDays: age,
    totalVolumeUSD: volume,
    defaultCount: numDefaults,
  };
}

async function main() {
  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log('  ║         NightScore Credit Oracle          ║');
  console.log('  ║   Privacy-Preserving Credit Attestation   ║');
  console.log('  ╚══════════════════════════════════════════╝');
  console.log('');

  const profile = await collectCreditProfile();
  const witnesses = createWitnesses(profile);
  const contract = new Contract(witnesses);

  console.log('\n  Contract instantiated with your private credit profile.');
  console.log('  Witnesses wired. Ready to connect to Midnight network.\n');
  console.log('  Credit profile loaded:');
  console.log(`    Repayments:  ${profile.onChainRepayments}`);
  console.log(`    Wallet age:  ${profile.walletAgeInDays} days`);
  console.log(`    Volume:      $${profile.totalVolumeUSD}`);
  console.log(`    Defaults:    ${profile.defaultCount}`);
  console.log('');
  console.log('  Your raw data stays here. Only the ZK proof goes on-chain.\n');

  rl.close();
}

main().catch(console.error);
