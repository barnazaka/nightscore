import { setNetworkId, getNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { WebSocket } from 'ws';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Buffer } from 'buffer';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import * as ledger from '@midnight-ntwrk/ledger-v8';
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd';
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk-shielded';
import {
  createKeystore,
  InMemoryTransactionHistoryStorage,
  PublicKey,
  UnshieldedWallet,
} from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import * as contracts from '@midnight-ntwrk/midnight-js-contracts';

setNetworkId('preprod');

// @ts-expect-error Required for wallet sync in Node.js
globalThis.WebSocket = WebSocket;

export const CONFIG = {
  indexer: 'https://indexer.preprod.midnight.network/api/v3/graphql',
  indexerWS: 'wss://indexer.preprod.midnight.network/api/v3/graphql/ws',
  node: 'https://rpc.preprod.midnight.network',
  proofServer: 'http://127.0.0.1:6300',
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const zkConfigPath = path.resolve(
  __dirname, '..', 'contract', 'managed', 'nightscore'
);

export async function loadContract() {
  const contractPath = path.join(zkConfigPath, 'contract', 'index.js');
  const NightScore = await import(pathToFileURL(contractPath).href);
  const compiledContract = (contracts as any).CompiledContract.make(
    'nightscore',
    NightScore.Contract
  );
  return { compiledContract, NightScore };
}

export function deriveKeys(seed: string) {
  const hdWallet = HDWallet.fromSeed(Buffer.from(seed, 'hex'));
  if (hdWallet.type !== 'seedOk') throw new Error('Invalid seed');
  const result = (hdWallet as any).hdWallet
    .selectAccount(0)
    .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
    .deriveKeysAt(0);
  if (result.type !== 'keysDerived') throw new Error('Key derivation failed');
  return result.keys;
}

export async function createWallet(seed: string) {
  const keys = deriveKeys(seed);
  const networkId = getNetworkId();
  const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
  const dustSecretKey = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);
  const unshieldedKeystore = createKeystore(keys[Roles.NightExternal], networkId);

  const walletConfig = {
    networkId,
    indexerClientConnection: {
      indexerHttpUrl: CONFIG.indexer,
      indexerWsUrl: CONFIG.indexerWS,
    },
    provingServerUrl: new URL(CONFIG.proofServer),
    relayURL: new URL(CONFIG.node.replace(/^http/, 'ws')),
  };

  const wallet = await (WalletFacade as any).init({
    configuration: walletConfig,
    shielded: (config: any) =>
      ShieldedWallet(config).startWithSecretKeys(shieldedSecretKeys),
    unshielded: (config: any) =>
      UnshieldedWallet({
        ...config,
        txHistoryStorage: new InMemoryTransactionHistoryStorage(),
      }).startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore)),
    dust: (config: any) =>
      DustWallet({
        ...config,
        costParameters: {
          additionalFeeOverhead: 300_000_000_000_000n,
          feeBlocksMargin: 5,
        },
      }).startWithSecretKey(
        dustSecretKey,
        ledger.LedgerParameters.initialParameters().dust
      ),
  });

  return { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore };
}

export function signTransactionIntents(tx: any, signFn: any, proofMarker: any): void {
  if (!tx.intents || tx.intents.size === 0) return;
  for (const segment of tx.intents.keys()) {
    const intent = tx.intents.get(segment);
    if (!intent) continue;
    const cloned = (ledger.Intent as any).deserialize(
      'signature',
      proofMarker,
      'pre-binding',
      intent.serialize()
    );
    const sigData = cloned.signatureData(segment);
    const signature = signFn(sigData);
    if (cloned.fallibleUnshieldedOffer) {
      const sigs = cloned.fallibleUnshieldedOffer.inputs.map(
        (_: any, i: number) =>
          cloned.fallibleUnshieldedOffer.signatures.at(i) ?? signature
      );
      cloned.fallibleUnshieldedOffer =
        cloned.fallibleUnshieldedOffer.addSignatures(sigs);
    }
    if (cloned.guaranteedUnshieldedOffer) {
      const sigs = cloned.guaranteedUnshieldedOffer.inputs.map(
        (_: any, i: number) =>
          cloned.guaranteedUnshieldedOffer.signatures.at(i) ?? signature
      );
      cloned.guaranteedUnshieldedOffer =
        cloned.guaranteedUnshieldedOffer.addSignatures(sigs);
    }
    tx.intents.set(segment, cloned);
  }
}

export async function createProviders(walletCtx: any) {
  // Use waitForSyncedState instead of Rx observable to avoid missing the sync event
  const state = await walletCtx.wallet.waitForSyncedState();

  const walletProvider = {
    getCoinPublicKey: () => (state as any).shielded.coinPublicKey.toHexString(),
    getEncryptionPublicKey: () =>
      (state as any).shielded.encryptionPublicKey.toHexString(),
    async balanceTx(tx: any, ttl?: Date) {
      const recipe = await walletCtx.wallet.balanceUnboundTransaction(
        tx,
        {
          shieldedSecretKeys: walletCtx.shieldedSecretKeys,
          dustSecretKey: walletCtx.dustSecretKey,
        },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) }
      );
      const signFn = (payload: any) =>
        walletCtx.unshieldedKeystore.signData(payload);
      signTransactionIntents(recipe.baseTransaction, signFn, 'proof');
      if (recipe.balancingTransaction) {
        signTransactionIntents(recipe.balancingTransaction, signFn, 'pre-proof');
      }
      return walletCtx.wallet.finalizeRecipe(recipe);
    },
    submitTx: (tx: any) => walletCtx.wallet.submitTransaction(tx),
  };

  return {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: 'nightscore-state',
      walletProvider,
    } as any),
    publicDataProvider: indexerPublicDataProvider(CONFIG.indexer, CONFIG.indexerWS),
    zkConfigProvider: new NodeZkConfigProvider(zkConfigPath),
    proofProvider: httpClientProofProvider(
      CONFIG.proofServer,
      new NodeZkConfigProvider(zkConfigPath) as any
    ),
    walletProvider,
    midnightProvider: walletProvider,
  };
}