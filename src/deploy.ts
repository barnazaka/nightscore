import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Buffer } from 'buffer';
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { toHex } from '@midnight-ntwrk/midnight-js-utils';
import { generateRandomSeed } from '@midnight-ntwrk/wallet-sdk-hd';
import * as ledger from '@midnight-ntwrk/ledger';
import {
  createWallet,
  createProviders,
  loadContract,
  registerForDust,
  waitForSync,
  waitForFunds,
  zkConfigPath,
  CONFIG,
} from './utils.js';

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║        Deploy NightScore to Midnight Preprod             ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  if (!fs.existsSync(path.join(zkConfigPath, 'contract', 'index.js'))) {
    console.error('Contract not compiled. Run: npm run compile');
    process.exit(1);
  }

  const rl = createInterface({ input: stdin, output: stdout });

  try {
    // ── Step 1: Wallet ──────────────────────────────────────────────────
    console.log('─── Step 1: Wallet Setup ──────────────────────────────────────\n');
    const choice = await rl.question('  [1] Create new wallet\n  [2] Restore from seed\n  > ');

    const seed =
      choice.trim() === '2'
        ? await rl.question('\n  Enter your 64-character seed: ')
        : toHex(Buffer.from(generateRandomSeed()));

    if (choice.trim() !== '2') {
      console.log(`\n  ⚠️  SAVE THIS SEED:\n  ${seed}\n`);
    }

    console.log('  Building wallet...');
    const walletCtx = await createWallet(seed);

    const address = walletCtx.unshieldedKeystore.getBech32Address();
    console.log(`\n  Unshielded Address: ${address}`);
    console.log(`\n  Fund with tNight from: https://faucet.preprod.midnight.network/\n`);

    console.log('  Syncing with Preprod network (may take 2-5 minutes)...');
    const syncedState = await waitForSync(walletCtx.wallet);
    console.log('  ✅ Synced!\n');

    const balance = (syncedState as any).unshielded.balances[ledger.unshieldedToken().raw] ?? 0n;
    console.log(`  Balance: ${balance.toLocaleString()} tNight`);

    // ── Step 2: Fund ────────────────────────────────────────────────────
    if ((balance as bigint) === 0n) {
      console.log('\n─── Step 2: Fund Your Wallet ──────────────────────────────────\n');
      console.log(`  Visit: https://faucet.preprod.midnight.network/`);
      console.log(`  Address: ${address}\n`);
      console.log('  Waiting for funds...');
      const funded = await waitForFunds(walletCtx.wallet);
      console.log(`  ✅ Funds received: ${funded.toLocaleString()} tNight\n`);
    }

    // ── Step 3: DUST ────────────────────────────────────────────────────
    console.log('\n─── Step 3: DUST Token Setup ──────────────────────────────────\n');
    await registerForDust(walletCtx);

    // ── Step 4: Deploy ──────────────────────────────────────────────────
    console.log('\n─── Step 4: Deploy Contract ───────────────────────────────────\n');
    const providers = await createProviders(walletCtx);
    const { compiledContract } = await loadContract();

    console.log('  Deploying NightScore contract...');
    console.log('  (ZK proof generation takes 30-60 seconds)\n');

    const deployed = await deployContract(providers, {
      compiledContract,
      privateStateId: 'nightscorePrivateState',
      initialPrivateState: {},
    });

    const contractAddress = (deployed as any).deployTxData.public.contractAddress;
    console.log('  ✅ Contract deployed!\n');
    console.log(`  Address: ${contractAddress}\n`);

    fs.writeFileSync(
      'deployment.json',
      JSON.stringify({ contractAddress, seed, network: 'preprod', deployedAt: new Date().toISOString() }, null, 2)
    );
    console.log('  Saved to deployment.json');
    console.log('  Run: npm run interact\n');

    await walletCtx.wallet.stop();
  } catch (err) {
    console.error('\n  ❌ Failed:', err);
  } finally {
    rl.close();
  }
}

main().catch(console.error);