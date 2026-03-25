import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import * as fs from 'node:fs';
import * as Rx from 'rxjs';
import { findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import {
  createWallet,
  createProviders,
  loadContract
} from './utils.js';

const TIER_LABELS: Record<number, string> = {
  0: 'UNQUALIFIED',
  1: 'BRONZE',
  2: 'SILVER',
  3: 'GOLD',
};

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║           NightScore Contract CLI (Preprod)             ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  if (!fs.existsSync('deployment.json')) {
    console.error('No deployment.json found! Run `npm run deploy` first.\n');
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync('deployment.json', 'utf-8'));
  console.log(`  Contract: ${deployment.contractAddress}\n`);
  const rl = createInterface({ input: stdin, output: stdout });

  try {
    const seedInput = await rl.question('  Enter your wallet seed (leave empty to use deployment.json): ');
    const seed = seedInput.trim() || deployment.seed;

    console.log('\n  Connecting to Midnight Preprod...');
    const walletCtx = await createWallet(seed.trim());
    const providers = await createProviders(walletCtx);
    const { NightScore, compiledContract } = await loadContract();

    console.log('  Joining contract...');
    const contract: any = await findDeployedContract(providers, {
      contractAddress: deployment.contractAddress,
      compiledContract,
      privateStateId: 'nightscoreState',
      initialPrivateState: {},
    } as any);

    const state = await Rx.firstValueFrom(walletCtx.wallet.state().pipe(Rx.filter((s: any) => s.isSynced)));
    const borrowerAddress = (state as any).shielded.coinPublicKey.toHexString();

    const currentTier = await (contract.callTx as any).getCreditTier(borrowerAddress);
    console.log(`  Current Tier: ${TIER_LABELS[currentTier as number] || 'UNKNOWN'}\n`);

    console.log('\n  [1] Register/Update credit score\n  [2] Read current tier\n  [3] Exit');
    const choice = await rl.question('  > ');

    if (choice.trim() === '1') {
      const repayments = parseInt(await rl.question('  On-chain loan repayments: '));
      const age = parseInt(await rl.question('  Wallet age in days: '));
      const volume = parseInt(await rl.question('  Total volume (USD): '));
      const defaults = parseInt(await rl.question('  Number of defaults: '));

      console.log('\n  Generating ZK proof and submitting transaction...');
      const tx = await contract.callTx.attestCreditTier(borrowerAddress, {
        onChainRepayments: () => repayments,
        walletAgeInDays: () => age,
        totalVolumeUSD: () => BigInt(volume),
        defaultCount: () => defaults,
      });

      console.log(`  ✅ Tier attested!`);
      console.log(`  Transaction: ${tx.public.txId}\n`);
    }

    await walletCtx.wallet.stop();
  } finally {
    rl.close();
  }
}

main().catch(console.error);
