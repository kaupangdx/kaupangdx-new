import { VanillaProtocolModules } from "@proto-kit/library";
import { ModulesConfig } from "@proto-kit/common";
import {
  ProtocolModulesRecord,
  SettlementContractModule,
} from "@proto-kit/protocol";
import { GovernanceLifecycleTransactionHook } from "./governance-life-cycle";

export const modules = VanillaProtocolModules.with({
  GovernanceLifecycle: GovernanceLifecycleTransactionHook,
});

export const config: ModulesConfig<typeof modules> = {
  ...VanillaProtocolModules.defaultConfig(),
  TransactionFee: {
    ...VanillaProtocolModules.defaultConfig().TransactionFee,
    feeRecipient: process.env.PROTOKIT_TRANSACTION_FEE_RECIPIENT_PUBLIC_KEY!,
  },
  GovernanceLifecycle: {
    goverancePeriodDurationInBlocks: 100n,
    maximumGovernancePeriod: 3n,
  },
} satisfies ModulesConfig<typeof modules>;

export const settlementModules = {
  SettlementContractModule: SettlementContractModule.from(
    SettlementContractModule.settlementAndBridging()
  ),
} satisfies ProtocolModulesRecord;

export const settlementModulesConfig = {
  SettlementContractModule: {
    BridgeContract: {},
    SettlementContract: {},
    DispatchContract: {
      incomingMessagesMethods: {},
    },
  },
} satisfies ModulesConfig<typeof settlementModules>;

export default { modules, config, settlementModules, settlementModulesConfig };
