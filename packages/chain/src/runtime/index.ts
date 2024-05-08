import { Balance, VanillaRuntimeModules } from "@proto-kit/library";
import { Faucet } from "./faucet";
import { ModulesConfig } from "@proto-kit/common";
import { Locks } from "./locks";
import { Balances } from "./balances";
import { SetDelegateProposal } from "./governance/set-delegate-proposal";
import { OutgoingMessages } from "./outgoing-messages";
import { TokenRegistry } from "./token-registry";
import { XYK } from "./xyk/xyk";

export const modules = {
  Faucet,
  Locks,
  Balances: Balances,
  SetDelegateProposal,
  OutgoingMessages,
  TokenRegistry,
  XYK,
};

export const config: ModulesConfig<
  ReturnType<typeof VanillaRuntimeModules.with<typeof modules>>
> = {
  Balances: {
    totalSupply: Balance.from(1_000_000_000),
  },
  Faucet: {},
  Locks: {},
  SetDelegateProposal: {
    stakeTokenId: 0n,
    maximumAllowedConvictionMultiplier: 3n,
    precisionDivider: 1000000n, // equivalent to 0,000001%
    minimalRequiredWeightPercentageToPropose: 1n,
  },
  OutgoingMessages: {},
  TokenRegistry: {},
  XYK: {
    feeDivider: 1000n,
    fee: 3n, //
  },
};

export default {
  modules,
  config,
};
