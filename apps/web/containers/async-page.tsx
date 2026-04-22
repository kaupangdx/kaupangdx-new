"use client";

import { Home as HomeComponent } from "@/components/home";
import { Wallet } from "@/components/wallet/wallet";
import { useEffect } from "react";
import { useNotifyTransactions, useWalletStore } from "@/lib/stores/wallet";
import {
  useBalancesStore,
  useFaucet,
  useObserveBalance,
} from "@/lib/stores/balances";
import { useChainStore, usePollBlockHeight } from "@/lib/stores/chain";
import { tokens } from "@/tokens";
import { useClientStore } from "@/lib/stores/client";
import { AddLiquidityForm } from "./xyk/add-liquidity-form";
import { RemoveLiquidityForm } from "./xyk/remove-liquidity-form";
import { SwapForm } from "./xyk/swap-form";
import { TransferForm } from "./wallet/transfer-form";

export default function Home() {
  const {
    connectWallet,
    wallet,
    observeWalletChange,
    initializeWallet,
    walletInstalled,
  } = useWalletStore();
  const client = useClientStore();

  const {
    balances,
    loading: balancesLoading,
    clearBalances,
  } = useBalancesStore();
  const { block } = useChainStore();
  usePollBlockHeight();

  useNotifyTransactions();

  useEffect(() => {
    wallet && clearBalances(wallet);
  }, [wallet]);
  Object.keys(tokens).forEach((tokenId) => {
    useObserveBalance(tokenId, wallet);
  });

  useEffect(() => {
    client.start();
    observeWalletChange();
    initializeWallet();
  }, []);

  const ownBalances = wallet ? balances[wallet] : {};

  const loading =
    balancesLoading && !!(wallet && balances[wallet]?.["0"] === undefined);

  const faucet = useFaucet();

  return (
    <>
      <HomeComponent
        swapForm={<SwapForm />}
        transferForm={<TransferForm />}
        addLiquidityForm={<AddLiquidityForm />}
        removeLiquidityForm={<RemoveLiquidityForm />}
        wallet={
          <Wallet
            loading={loading}
            blockHeight={block?.height}
            address={wallet}
            balances={ownBalances}
            walletInstalled={walletInstalled}
            onConnectWallet={async () => {
              await connectWallet();
            }}
            forceIsWalletOpen={!!wallet}
            onFaucetDrip={() => client.client && wallet && faucet()}
          />
        }
      />
    </>
  );
}
