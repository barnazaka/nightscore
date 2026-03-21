import readline from 'readline';
import { deployNightScore, joinNightScore } from './managed-api.js';
import { CreditProfile } from './witnesses.js';
import { buildProviders } from './providers.js';

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
  const defaults = parseInt(await prompt('  Number of past defaults/liquidations: '));

  return {
    onChainRepayments: repayments,
    walletAgeInDays: age,
    totalVolumeUSD: volume,
    defaultCount: defaults,
  };
}

async function main() {
  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log('  ║         NightScore Credit Oracle          ║');
  console.log('  ║   Privacy-Preserving Credit Attestation   ║');
  console.log('  ╚══════════════════════════════════════════╝');
  console.log('');
  console.log('  [1] Attest my credit tier to the ledger');
  console.log('  [2] Check an address credit tier');
  console.log('  [3] Exit');
  console.log('');

  const choice = await prompt('  Choose: ');

  const providers = await buildProviders();

  if (choice === '1') {
    const profile = await collectCreditProfile();
    const contractAddress = await prompt('\n  Contract address (leave blank to deploy new): ');

    let deployed;
    if (contractAddress.trim() === '') {
      console.log('\n  Deploying NightScore contract...');
      deployed = await deployNightScore(providers, profile);
      console.log(`\n  Contract deployed at: ${deployed.deployTxData.public.contractAddress}`);
    } else {
      deployed = await joinNightScore(providers, contractAddress.trim(), profile);
    }

    const borrowerKey = await prompt('\n  Your public key: ');
    console.log('\n  Generating ZK proof of creditworthiness...');
    console.log('  (Your actual financial data stays on this device)\n');

    await deployed.callTx.attestCreditTier(borrowerKey);

    console.log('  ✓ Credit attestation written to Midnight ledger');
    console.log('  ✓ Any DeFi protocol can now verify your tier');
    console.log('  ✓ Your raw financial data was never exposed\n');

  } else if (choice === '2') {
    const contractAddress = await prompt('\n  Contract address: ');
    const profile = { onChainRepayments: 0, walletAgeInDays: 0, totalVolumeUSD: 0, defaultCount: 0 };
    const deployed = await joinNightScore(providers, contractAddress, profile);
    const borrowerKey = await prompt('  Borrower public key to check: ');

    const tier = await deployed.callTx.getCreditTier(borrowerKey);
    console.log(`\n  Credit Tier: ${TIER_LABELS[Number(tier)] ?? 'Unknown'}\n`);
  }

  rl.close();
}

main().catch(console.error);
