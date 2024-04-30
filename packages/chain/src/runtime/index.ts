import { Balance, TokenId, VanillaRuntimeModules } from "@proto-kit/library";
import { BalancesSnapshot } from "./balances-snapshot-simple";
import { Faucet } from "./faucet";
import { ModulesConfig } from "@proto-kit/common";
import { BlockHeight, Locks } from "./locks";
import { RuntimeModulesRecord } from "@proto-kit/module";
import { Balances } from "./balances";
import { SetDelegateProposal } from "./governance/set-delegate-proposal";

export const modules = {
  Faucet,
  Locks,
  Balances: Balances,
  SetDelegateProposal,
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
    minimalRequiredWeightToPropose: 10000n,
  },
};

export default {
  modules,
  config,
};
