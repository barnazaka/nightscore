import {
  deployContract,
  findDeployedContract,
} from '@midnight-ntwrk/midnight-js-contracts';
import { ContractAddress } from '@midnight-ntwrk/midnight-js-types';
import { createWitnesses, CreditProfile, DEFAULT_CREDIT_PROFILE } from './witnesses.js';
import { Contract } from '../contract/managed/nightscore_contract.cjs';

const contract = new Contract(createWitnesses(DEFAULT_CREDIT_PROFILE));

export type NightScoreProviders = {
  privateStateProvider: any;
  publicDataProvider: any;
  zkConfigProvider: any;
  walletProvider: any;
  midnightProvider: any;
};

export const deployNightScore = async (
  providers: NightScoreProviders,
  creditProfile: CreditProfile
) => {
  const witnesses = createWitnesses(creditProfile);
  const contractWithWitnesses = new Contract(witnesses);

  return await deployContract(providers, {
    contract: contractWithWitnesses,
    privateStateKey: 'nightscore',
    initialPrivateState: creditProfile,
  });
};

export const joinNightScore = async (
  providers: NightScoreProviders,
  contractAddress: string,
  creditProfile: CreditProfile
) => {
  const witnesses = createWitnesses(creditProfile);
  const contractWithWitnesses = new Contract(witnesses);

  return await findDeployedContract(providers, {
    contractAddress: contractAddress as ContractAddress,
    contract: contractWithWitnesses,
    privateStateKey: 'nightscore',
    initialPrivateState: creditProfile,
  });
};
