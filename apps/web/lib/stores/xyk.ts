import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { Client, useClientStore } from "./client";
import { useCallback, useEffect, useMemo } from "react";
import { useWalletStore } from "./wallet";
import { Bool, PublicKey } from "o1js";
import { Balance, TokenId } from "@proto-kit/library";
import { isPendingTransaction } from "./balances";
import { PendingTransaction } from "@proto-kit/sequencer";
import { PoolKey } from "chain";
import { resolve } from "path";
import { useChainStore } from "./chain";

export interface XYKState {
  createPool: (
    client: Client,
    sender: string,
    tokenAId: string,
    tokenBId: string,
    tokenAAmount: string,
    tokenBAmount: string,
  ) => Promise<PendingTransaction>;
  addLiquidity: (
    client: Client,
    sender: string,
    tokenAId: string,
    tokenBId: string,
    tokenAAmount: string,
    tokenBAmountLimit: string,
  ) => Promise<PendingTransaction>;
  loadPool: (client: Client, key: string) => Promise<void>;
  pools: {
    [key: string]:
      | {
          loading: boolean;
          exists: boolean;
        }
      | undefined;
  };
}

export const useXYKStore = create<XYKState, [["zustand/immer", never]]>(
  immer((set) => ({
    pools: {},

    loadPool: async (client: Client, key: string) => {
      set((state) => {
        state.pools[key] = {
          loading: true,
          exists: state.pools[key]?.exists ?? false,
        };
      });
      const pool = (await client.query.runtime.XYK.pools.get(
        PoolKey.fromBase58(key),
      )) as Bool | undefined;

      await new Promise((resolve) => setTimeout(resolve, 500));

      set((state) => {
        state.pools[key] = {
          loading: false,
          exists: pool?.toBoolean() ?? false,
        };
      });
    },

    createPool: async (
      client: Client,
      sender: string,
      tokenAId: string,
      tokenBId: string,
      tokenAAmount: string,
      tokenBAmount: string,
    ) => {
      const xyk = client.runtime.resolve("XYK");
      const senderPublicKey = PublicKey.fromBase58(sender);

      const tx = await client.transaction(senderPublicKey, () => {
        xyk.createPoolSigned(
          TokenId.from(tokenAId),
          TokenId.from(tokenBId),
          Balance.from(tokenAAmount),
          Balance.from(tokenBAmount),
        );
      });

      await tx.sign();
      await tx.send();

      isPendingTransaction(tx.transaction);
      return tx.transaction;
    },

    addLiquidity: async (
      client: Client,
      sender: string,
      tokenAId: string,
      tokenBId: string,
      tokenAAmount: string,
      tokenBAmountLimit: string,
    ) => {
      const xyk = client.runtime.resolve("XYK");
      const senderPublicKey = PublicKey.fromBase58(sender);

      const tx = await client.transaction(senderPublicKey, () => {
        xyk.addLiquiditySigned(
          TokenId.from(tokenAId),
          TokenId.from(tokenBId),
          Balance.from(tokenAAmount),
          Balance.from(tokenBAmountLimit),
        );
      });

      await tx.sign();
      await tx.send();

      isPendingTransaction(tx.transaction);
      return tx.transaction;
    },
  })),
);

export const useCreatePool = () => {
  const client = useClientStore();
  const wallet = useWalletStore();
  const { createPool } = useXYKStore();

  return useCallback(
    async (
      tokenAId: string,
      tokenBId: string,
      tokenAAmount: string,
      tokenBAmount: string,
    ) => {
      if (!client.client || !wallet.wallet) return;
      const pendingTransaction = await createPool(
        client.client,
        wallet.wallet,
        tokenAId,
        tokenBId,
        tokenAAmount,
        tokenBAmount,
      );

      wallet.addPendingTransaction(pendingTransaction);
    },
    [client.client, wallet.wallet],
  );
};

export const useAddLiquidity = () => {
  const client = useClientStore();
  const wallet = useWalletStore();
  const { addLiquidity } = useXYKStore();

  return useCallback(
    async (
      tokenAId: string,
      tokenBId: string,
      tokenAAmount: string,
      tokenBAmountLimit: string,
    ) => {
      if (!client.client || !wallet.wallet) return;
      const pendingTransaction = await addLiquidity(
        client.client,
        wallet.wallet,
        tokenAId,
        tokenBId,
        tokenAAmount,
        tokenBAmountLimit,
      );

      wallet.addPendingTransaction(pendingTransaction);
    },
    [client.client, wallet.wallet],
  );
};

export const usePool = (key: string) => {
  const xyk = useXYKStore();
  return useMemo(() => xyk.pools[key], [xyk.pools, key]);
};

export const useObservePool = (key: string) => {
  const client = useClientStore();
  const { loadPool } = useXYKStore();
  const pool = usePool(key);
  const chain = useChainStore();

  useEffect(() => {
    if (!client.client) return;
    loadPool(client.client, key);
  }, [client.client, key, chain.block?.height]);

  return pool;
};
