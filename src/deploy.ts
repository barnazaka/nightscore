import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Buffer } from 'buffer';
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { toHex } from '@midnight-ntwrk/midnight-js-utils';
import { unshieldedToken } from '@midnight-ntwrk/ledger-v8';
import { generateRandomSeed } from '@midnight-ntwrk/wallet-sdk-hd';
import * as Rx from 'rxjs';
import {
  createWallet,
  createProviders,
  loadContract,
  zkConfigPath,
} from './utils.js';

async function waitForSync(wallet: any, label: string): Promise<any> {
  console.log(`  Waiting for ${label} to sync (this can take 2-5 minutes for a new wallet)...`);
  
  let lastLog = Date.now();
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Wallet sync timed out after 10 minutes. Check your internet connection and try again.'));
    }, 10 * 60 * 1000);

    wallet.state().pipe(
      Rx.tap((s: any) => {
        // Log progress every 15 seconds so you know it's still working
        if (Date.now() - lastLog > 15000) {
          const shielded = s.shielded?.state?.progress;
          const dust = s.dust?.state?.progress;
          const unshielded = s.unshielded?.progress;
          console.log(`  Still syncing... shielded: ${shielded?.isStrictlyComplete?.() ? 'done' : 'syncing'} | dust: ${dust?.isStrictlyComplete?.() ? 'done' : 'syncing'} | unshielded: ${unshielded?.isStrictlyComplete?.() ? 'done' : 'syncing'}`);
          lastLog = Date.now();
        }
      }),
      Rx.filter((s: any) => s.isSynced),
      Rx.take(1),
    ).subscribe({
      next: (s) => {
        clearTimeout(timeout);
        resolve(s);
      },
      error: (e) => {
        clearTimeout(timeout);
        reject(e);
      },
    });
  });
}

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

    const seed =
      choice.trim() === '2'
        ? await rl.question('\n  Enter your 64-character seed: ')
        : toHex(Buffer.from(generateRandomSeed()));

    if (choice.trim() !== '2') {
      console.log(`\n  ⚠️  SAVE THIS SEED (Required for interactions):\n  ${seed}\n`);
    }

    console.log('  Creating wallet...');
    const walletCtx = await createWallet(seed);

    const state = await waitForSync(walletCtx.wallet, 'Preprod');

    const address = walletCtx.unshieldedKeystore.getBech32Address();
    const balance = (state as any).unshielded.balances[unshieldedToken().raw] ?? 0n;

    console.log(`\n  ✅ Synced!`);
    console.log(`  Wallet Address: ${address}`);
    console.log(`  Balance: ${balance.toLocaleString()} tNight\n`);

    if ((balance as bigint) === 0n) {
      console.log('─── Step 2: Fund Your Wallet ──────────────────────────────────\n');
      console.log('  Visit: https://faucet.preprod.midnight.network/');
      console.log(`  Paste this address: ${address}\n`);
      console.log('  Waiting for funds to arrive...');

      let funded = false;
      while (!funded) {
        await new Promise((r) => setTimeout(r, 10000));
        const s = await waitForSync(walletCtx.wallet, 'balance update');
        const b = (s as any).unshielded.balances[unshieldedToken().raw] ?? 0n;
        if ((b as bigint) > 0n) {
          funded = true;
          console.log(`  Funds received: ${b.toLocaleString()} tNight\n`);
        } else {
          console.log('  No funds yet, checking again in 10 seconds...');
        }
      }
    }

    console.log('─── Step 3: DUST Token Setup ──────────────────────────────────\n');
    const dustState = await waitForSync(walletCtx.wallet, 'DUST');

    if ((dustState as any).dust.walletBalance(new Date()) === 0n) {
      const nightUtxos = (dustState as any).unshielded.availableCoins.filter(
        (c: any) => !c.meta?.registeredForDustGeneration
      );

      if (nightUtxos.length > 0) {
        console.log('  Registering for DUST generation...');
        const recipe = await walletCtx.wallet.registerNightUtxosForDustGeneration(
          nightUtxos,
          walletCtx.unshieldedKeystore.getPublicKey(),
          (payload: any) => walletCtx.unshieldedKeystore.signData(payload)
        );
        await walletCtx.wallet.submitTransaction(
          await walletCtx.wallet.finalizeRecipe(recipe)
        );
        console.log('  Registered. Waiting for DUST to be minted...');
      } else {
        console.log('  No UTXOs available for DUST registration yet.');
        console.log('  Make sure your wallet has tNight balance first.');
      }

      let hasDust = false;
      let dustAttempts = 0;
      while (!hasDust && dustAttempts < 30) {
        await new Promise((r) => setTimeout(r, 10000));
        const s = await waitForSync(walletCtx.wallet, 'DUST balance');
        if ((s as any).dust.walletBalance(new Date()) > 0n) {
          hasDust = true;
        } else {
          dustAttempts++;
          console.log(`  Still waiting for DUST... (attempt ${dustAttempts}/30)`);
        }
      }

      if (!hasDust) {
        throw new Error('DUST tokens never arrived. Try again later.');
      }
    }
    console.log('  DUST tokens ready!\n');

    console.log('─── Step 4: Deploy Contract ───────────────────────────────────\n');
    const providers = await createProviders(walletCtx);
    const { compiledContract } = await loadContract();

    console.log('  Submitting deployment transaction...');
    console.log('  (ZK proof generation takes 30-60 seconds, please wait)\n');

    const deployed = await deployContract(providers, {
      compiledContract,
      privateStateId: 'nightscoreState',
      initialPrivateState: {},
      args: [],
    } as any);

    const contractAddress = (deployed as any).deployTxData.public.contractAddress;
    console.log('\n  ✅ Contract successfully deployed!');
    console.log(`  📍 Address: ${contractAddress}\n`);

    fs.writeFileSync(
      'deployment.json',
      JSON.stringify(
        {
          contractAddress,
          seed,
          network: 'preprod',
          deployedAt: new Date().toISOString(),
        },
        null,
        2
      )
    );
    console.log('  Saved to deployment.json');
    console.log('  Run npm run interact to register a credit score.\n');

    await walletCtx.wallet.stop();
  } catch (error) {
    console.error('\n  ❌ Deployment failed:');
    console.error(error);
  } finally {
    rl.close();
  }
}

main().catch(console.error);