import { WitnessContext } from '@midnight-ntwrk/compact-runtime';
import type { Ledger } from '../contract/managed/nightscore_contract.cjs';

// This is the private financial profile that lives ONLY on the client
// It is passed into witness functions and never serialized to the chain
export type CreditProfile = {
  onChainRepayments: number;   // number of successful loan repayments
  walletAgeInDays: number;     // days since wallet first transaction
  totalVolumeUSD: number;      // lifetime on-chain volume in USD
  defaultCount: number;        // number of liquidations or missed payments
};

export const DEFAULT_CREDIT_PROFILE: CreditProfile = {
  onChainRepayments: 0,
  walletAgeInDays: 0,
  totalVolumeUSD: 0,
  defaultCount: 0,
};

// Each function name must exactly match the witness name in the Compact contract
export const createWitnesses = (profile: CreditProfile) => ({
  onChainRepayments: async (
    context: WitnessContext<Ledger, CreditProfile>
  ): Promise<[CreditProfile, bigint]> => {
    return [context.privateState, BigInt(context.privateState.onChainRepayments)];
  },

  walletAgeInDays: async (
    context: WitnessContext<Ledger, CreditProfile>
  ): Promise<[CreditProfile, bigint]> => {
    return [context.privateState, BigInt(context.privateState.walletAgeInDays)];
  },

  totalVolumeUSD: async (
    context: WitnessContext<Ledger, CreditProfile>
  ): Promise<[CreditProfile, bigint]> => {
    return [context.privateState, BigInt(context.privateState.totalVolumeUSD)];
  },

  defaultCount: async (
    context: WitnessContext<Ledger, CreditProfile>
  ): Promise<[CreditProfile, bigint]> => {
    return [context.privateState, BigInt(context.privateState.defaultCount)];
  },
});
