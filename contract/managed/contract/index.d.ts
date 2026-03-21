import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<PS> = {
  onChainRepayments(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  walletAgeInDays(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  totalVolumeUSD(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  defaultCount(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
}

export type ImpureCircuits<PS> = {
  attestCreditTier(context: __compactRuntime.CircuitContext<PS>,
                   borrower_0: { bytes: Uint8Array }): __compactRuntime.CircuitResults<PS, []>;
  getCreditTier(context: __compactRuntime.CircuitContext<PS>,
                borrower_0: { bytes: Uint8Array }): __compactRuntime.CircuitResults<PS, number>;
}

export type PureCircuits = {
}

export type Circuits<PS> = {
  attestCreditTier(context: __compactRuntime.CircuitContext<PS>,
                   borrower_0: { bytes: Uint8Array }): __compactRuntime.CircuitResults<PS, []>;
  getCreditTier(context: __compactRuntime.CircuitContext<PS>,
                borrower_0: { bytes: Uint8Array }): __compactRuntime.CircuitResults<PS, number>;
}

export type Ledger = {
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
