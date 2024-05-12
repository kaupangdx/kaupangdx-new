import { create } from "zustand";
import { Client, useClientStore } from "./client";
import { immer } from "zustand/middleware/immer";
import { PendingTransaction, UnsignedTransaction } from "@proto-kit/sequencer";
import { Balance, BalancesKey, TokenId } from "@proto-kit/library";
import { PublicKey } from "o1js";
import { useCallback, useEffect, useMemo } from "react";
import { useChainStore } from "./chain";
import { useWalletStore } from "./wallet";

export interface BalancesState {
  loading: boolean;
  balances: {
    // address
    [key: string]:
      | {
          // tokenId
          [key: string]: string | undefined;
        }
      | undefined;
  };
  totalSupply: {
    [key: string]: string | undefined;
  };
  loadBalance: (
    client: Client,
    tokenId: string,
    address: string,
  ) => Promise<void>;
  clearBalances: (address?: string) => void;
  faucet: (client: Client, address: string) => Promise<PendingTransaction>;
  loadTotalSupply: (client: Client, tokenId: string) => Promise<void>;
}

export function isPendingTransaction(
  transaction: PendingTransaction | UnsignedTransaction | undefined,
): asserts transaction is PendingTransaction {
  if (!(transaction instanceof PendingTransaction))
    throw new Error("Transaction is not a PendingTransaction");
}

export const tokenId = TokenId.from(0);

export const useBalancesStore = create<
  BalancesState,
  [["zustand/immer", never]]
>(
  immer((set) => ({
    loading: Boolean(false),
    balances: {},
    totalSupply: {},
    async loadTotalSupply(client: Client, tokenId: string) {
      set((state) => {
        state.loading = true;
      });

      const totalSupply = await client.query.runtime.Balances.totalSupply.get(
        TokenId.from(tokenId),
      );

      set((state) => {
        state.loading = false;
        state.totalSupply = {
          ...state.totalSupply,
          [tokenId]: totalSupply?.toString() ?? "0",
        };
      });
    },
    clearBalances(address) {
      set((state) => {
        if (address) {
          delete state.balances[address];
        } else {
          state.balances = {};
        }
      });
    },
    async loadBalance(client: Client, tokenId: string, address: string) {
      set((state) => {
        state.loading = true;
      });

      const key = BalancesKey.from(
        TokenId.from(tokenId),
        PublicKey.fromBase58(address),
      );

      const balance = await client.query.runtime.Balances.balances.get(key);

      set((state) => {
        state.loading = false;
        state.balances = {
          ...state.balances,
          [address]: {
            ...state.balances[address],
            [tokenId]: balance?.toString() ?? "0",
          },
        };
      });
    },
    async faucet(client: Client, address: string) {
      const faucet = client.runtime.resolve("Faucet");
      const sender = PublicKey.fromBase58(address);

      const tx = await client.transaction(sender, () => {
        faucet.dripBundle();
      });

      await tx.sign();
      await tx.send();

      isPendingTransaction(tx.transaction);
      return tx.transaction;
    },
  })),
);

export const useBalance = (address?: string, tokenId?: string) => {
  const balances = useBalancesStore();

  return useMemo(() => {
    if (!address || !tokenId) return;

    return balances.balances[address]?.[tokenId];
  }, [balances.balances, address, tokenId]);
};

export const useObserveBalance = (tokenId?: string, address?: string) => {
  const client = useClientStore();
  const chain = useChainStore();
  const balances = useBalancesStore();
  const balance = useBalance(address, tokenId);

  useEffect(() => {
    if (!client.client || !address || !tokenId) return;

    balances.loadBalance(client.client, tokenId, address);
  }, [client.client, chain.block?.height, address]);

  return balance;
};

export const useFaucet = () => {
  const client = useClientStore();
  const balances = useBalancesStore();
  const wallet = useWalletStore();

  return useCallback(async () => {
    if (!client.client || !wallet.wallet) return;

    const pendingTransaction = await balances.faucet(
      client.client,
      wallet.wallet,
    );

    wallet.addPendingTransaction(pendingTransaction);
  }, [client.client, wallet.wallet]);
};

export const useTotalSupply = (tokenId?: string) => {
  const balances = useBalancesStore();

  return useMemo(() => {
    if (!tokenId) return "0";
    return balances.totalSupply[tokenId];
  }, [tokenId, balances]);
};

export const useObserveTotalSupply = (tokenId?: string) => {
  const client = useClientStore();
  const balances = useBalancesStore();
  const totalSupply = useTotalSupply(tokenId);
  const chain = useChainStore();

  useEffect(() => {
    if (!client.client || !tokenId) return;

    balances.loadTotalSupply(client.client, tokenId);
  }, [client.client, tokenId, chain.block?.height]);

  return totalSupply;
};
