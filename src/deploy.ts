import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as Rx from 'rxjs';
import { Buffer } from 'buffer';
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { toHex } from '@midnight-ntwrk/midnight-js-utils';
import { unshieldedToken } from '@midnight-ntwrk/ledger-v8';
import { generateRandomSeed } from '@midnight-ntwrk/wallet-sdk-hd';
import {
  createWallet,
  createProviders,
  loadContract,
  zkConfigPath
} from './utils.js';

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║        Deploy NightScore to Midnight Preprod             ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  if (!fs.existsSync(path.join(zkConfigPath, 'contract', 'index.js'))) {
    console.error('Contract not compiled! Run: npm run compile');
    process.exit(1);
  }

  const rl = createInterface({ input: stdin, output: stdout });

  try {
    console.log('─── Step 1: Wallet Setup ──────────────────────────────────────\n');
    const choice = await rl.question('  [1] Create new wallet\n  [2] Restore from seed\n  > ');
    const seed = choice.trim() === '2'
      ? await rl.question('\n  Enter your 64-character seed: ')
      : toHex(Buffer.from(generateRandomSeed()));

    if (choice.trim() !== '2') {
      console.log(`\n  ⚠️  SAVE THIS SEED:\n  ${seed}\n`);
    }

    console.log('  Creating wallet...');
    const walletCtx = await createWallet(seed);
    console.log('  Syncing with network...');
    const state = await Rx.firstValueFrom(
      walletCtx.wallet.state().pipe(
        Rx.throttleTime(5000),
        Rx.filter((s: any) => s.isSynced)
      )
    );

    const address = walletCtx.unshieldedKeystore.getBech32Address();
    const balance = (state as any).unshielded.balances[unshieldedToken().raw] ?? 0n;
    console.log(`\n  Wallet Address: ${address}`);
    console.log(`  Balance: ${balance.toLocaleString()} tNight\n`);

    if (balance === 0n) {
      console.log('─── Step 2: Fund Your Wallet ──────────────────────────────────\n');
      console.log('  Visit: https://faucet.preprod.midnight.network/');
      console.log(`  Address: ${address}\n`);
      console.log('  Waiting for funds...');
      await Rx.firstValueFrom(
        walletCtx.wallet.state().pipe(
          Rx.throttleTime(10000),
          Rx.filter((s: any) => s.isSynced),
          Rx.map((s: any) => s.unshielded.balances[unshieldedToken().raw] ?? 0n),
          Rx.filter((b) => (b as bigint) > 0n),
        ),
      );
      console.log('  Funds received!\n');
    }

    console.log('─── Step 3: DUST Token Setup ──────────────────────────────────\n');
    const dustState = await Rx.firstValueFrom(
      walletCtx.wallet.state().pipe(Rx.filter((s: any) => s.isSynced))
    );
    if ((dustState as any).dust.walletBalance(new Date()) === 0n) {
      const nightUtxos = (dustState as any).unshielded.availableCoins.filter(
        (c: any) => !c.meta?.registeredForDustGeneration
      );

      if (nightUtxos.length > 0) {
        console.log('  Registering for DUST generation...');
        const recipe = await walletCtx.wallet.registerNightUtxosForDustGeneration(
          nightUtxos,
          walletCtx.unshieldedKeystore.getPublicKey(),
          (payload: any) => walletCtx.unshieldedKeystore.signData(payload),
        );
        await walletCtx.wallet.submitTransaction(
          await walletCtx.wallet.finalizeRecipe(recipe)
        );
      }
      console.log('  Waiting for DUST tokens...');
      await Rx.firstValueFrom(
        walletCtx.wallet.state().pipe(
          Rx.throttleTime(5000),
          Rx.filter((s: any) => s.isSynced),
          Rx.filter((s: any) => (s as any).dust.walletBalance(new Date()) > 0n)
        ),
      );
    }
    console.log('  DUST tokens ready!\n');

    console.log('─── Step 4: Deploy Contract ───────────────────────────────────\n');
    const providers = await createProviders(walletCtx);
    const { compiledContract } = await loadContract();

    const deployed = await deployContract(providers, {
      compiledContract,
      privateStateId: 'nightscoreState',
      initialPrivateState: {},
      args: []
    } as any);

    const contractAddress = (deployed as any).deployTxData.public.contractAddress;
    console.log(`  ✅ Contract deployed: ${contractAddress}\n`);

    fs.writeFileSync('deployment.json', JSON.stringify({ contractAddress, seed, network: 'preprod' }, null, 2));

    await walletCtx.wallet.stop();
  } finally {
    rl.close();
  }
}
main().catch(console.error);
