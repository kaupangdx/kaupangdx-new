import { Balance, TokenId, VanillaRuntimeModules } from "@proto-kit/library";
import { BalancesSnapshot } from "./balances-snapshot-simple";
import { Faucet } from "./faucet";
import { ModulesConfig } from "@proto-kit/common";
import { BlockHeight, Locks } from "./locks";
import { RuntimeModulesRecord } from "@proto-kit/module";
import { Balances } from "./balances";
import { SetDelegateProposal } from "./governance/set-delegate-proposal";
import { OutgoingMessages } from "./outgoing-messages";

export const modules = {
  Faucet,
  Locks,
  Balances: Balances,
  SetDelegateProposal,
  OutgoingMessages,
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
};

export default {
  modules,
  config,
};
