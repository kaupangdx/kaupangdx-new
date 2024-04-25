import { Balance } from "@proto-kit/library";
import { BalancesSnapshot } from "./balances-snapshot";
import { Faucet } from "./faucet";
import { ModulesConfig } from "@proto-kit/common";

export const modules = {
  Balances: BalancesSnapshot,
  Faucet,
};

export const config: ModulesConfig<typeof modules> = {
  Balances: {
    totalSupply: Balance.from(10_000),
  },
  Faucet: {},
};

export default {
  modules,
  config,
};
