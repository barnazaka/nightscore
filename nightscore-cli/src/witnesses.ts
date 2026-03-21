import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';
import type { Ledger, Witnesses } from '../../contract/managed/contract/index.js';

export type CreditProfile = {
  onChainRepayments: number;
  walletAgeInDays: number;
  totalVolumeUSD: number;
  defaultCount: number;
};

export const DEFAULT_CREDIT_PROFILE: CreditProfile = {
  onChainRepayments: 0,
  walletAgeInDays: 0,
  totalVolumeUSD: 0,
  defaultCount: 0,
};

export const createWitnesses = (profile: CreditProfile): Witnesses<CreditProfile> => ({
  onChainRepayments(
    context: __compactRuntime.WitnessContext<Ledger, CreditProfile>
  ): [CreditProfile, bigint] {
    return [context.privateState, BigInt(context.privateState.onChainRepayments)];
  },

  walletAgeInDays(
    context: __compactRuntime.WitnessContext<Ledger, CreditProfile>
  ): [CreditProfile, bigint] {
    return [context.privateState, BigInt(context.privateState.walletAgeInDays)];
  },

  totalVolumeUSD(
    context: __compactRuntime.WitnessContext<Ledger, CreditProfile>
  ): [CreditProfile, bigint] {
    return [context.privateState, BigInt(context.privateState.totalVolumeUSD)];
  },

  defaultCount(
    context: __compactRuntime.WitnessContext<Ledger, CreditProfile>
  ): [CreditProfile, bigint] {
    return [context.privateState, BigInt(context.privateState.defaultCount)];
  },
});
