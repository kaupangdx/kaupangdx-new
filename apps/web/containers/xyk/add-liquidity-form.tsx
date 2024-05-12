import { Form } from "@/components/ui/form";
import { AddLiquidityForm as AddLiquidityFormComponent } from "@/components/xyk/add-liquidity-form";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useAddLiquidity,
  useCreatePool,
  useObservePool,
  usePool,
} from "@/lib/stores/xyk";
import BigNumber from "bignumber.js";
import { LPTokenId, PoolKey, TokenPair } from "chain";
import { TokenId } from "@proto-kit/library";
import {
  useBalancesStore,
  useObserveBalance,
  useObserveTotalSupply,
} from "@/lib/stores/balances";
import { precision, removeTrailingZeroes } from "@/components/ui/balance";
import { useWalletStore } from "@/lib/stores/wallet";
import { usePoolKey } from "@/lib/xyk/usePoolKey";
import { useSpotPrice } from "@/lib/xyk/useSpotPrice";

export function addPrecision(value: string) {
  return new BigNumber(value).times(10 ** precision).toString();
}

export function removePrecision(value: string) {
  return new BigNumber(value).div(10 ** precision).toString();
}

export function AddLiquidityForm() {
  const [loading, setLoading] = useState(false);
  const createPool = useCreatePool();
  const addLiquidity = useAddLiquidity();
  const { wallet } = useWalletStore();

  const balanceARef = useRef("0");
  const balanceBRef = useRef("0");

  const formSchema = z
    .object({
      tokenA_token: z
        .string({
          required_error: "Token A is required",
          invalid_type_error: "Token A is required",
        })
        .min(1, { message: "Token A is required" }),
      tokenA_amount: z
        .string()
        .min(1, { message: "Token A amount is required" }),
      tokenB_token: z
        .string({
          required_error: "Token B is required",
          invalid_type_error: "Token B is required",
        })
        .min(1, { message: "Token B is required" }),
      tokenB_amount: z
        .string()
        .min(1, { message: "Token B amount is required" }),
      tokenLP_amount: z.any(),
    })
    .refine((data) => data.tokenA_token !== data.tokenB_token, {
      message: "Tokens must be different",
      path: ["tokenA_token"],
    })
    .refine(
      (data) => {
        console.log(
          "refine",
          data.tokenA_amount,
          removePrecision(balanceARef.current),
        );
        return new BigNumber(data.tokenA_amount).lt(
          removePrecision(balanceARef.current),
        );
      },
      {
        message: "Insufficient balance",
        path: ["tokenA_amount"],
      },
    )
    .refine(
      (data) =>
        new BigNumber(data.tokenB_amount).lt(
          removePrecision(balanceBRef.current),
        ),
      {
        message: "Insufficient balance",
        path: ["tokenB_amount"],
      },
    );

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    reValidateMode: "onChange",
    mode: "onChange",
  });
  const fields = form.getValues();

  const { poolKey, tokenPair } = usePoolKey(
    fields.tokenA_token,
    fields.tokenB_token,
  );
  const pool = useObservePool(poolKey);

  // observe balances of the pool & the connected wallet
  const tokenAReserve = useObserveBalance(fields.tokenA_token, poolKey);
  const tokenBReserve = useObserveBalance(fields.tokenB_token, poolKey);
  const userTokenABalance = useObserveBalance(fields.tokenA_token, wallet);
  const userTokenBBalance = useObserveBalance(fields.tokenB_token, wallet);

  useEffect(() => {
    if (!userTokenABalance || !userTokenBBalance) return;
    balanceARef.current = userTokenABalance;
    balanceBRef.current = userTokenBBalance;
  }, [userTokenABalance, userTokenBBalance]);

  const lpTotalSupply = useObserveTotalSupply(
    LPTokenId.fromTokenPair(tokenPair).toString(),
  );

  const spotPrice = useSpotPrice(tokenAReserve, tokenBReserve);

  useEffect(() => {
    if (
      !pool?.exists ||
      !lpTotalSupply ||
      !fields.tokenA_amount ||
      !tokenAReserve
    ) {
      return;
    }

    const lpTokensToMint = new BigNumber(lpTotalSupply)
      .multipliedBy(addPrecision(fields.tokenA_amount))
      .div(tokenAReserve)
      .toString();

    console.log("calculated lp tokens", removePrecision(lpTokensToMint));
    form.setValue("tokenLP_amount", removePrecision(lpTokensToMint));
  }, [pool, tokenAReserve, fields.tokenA_token, lpTotalSupply]);

  // calculate amount B
  useEffect(() => {
    const tokenB_amount = new BigNumber(fields.tokenA_amount).dividedBy(
      spotPrice,
    );

    if (!pool?.loading && pool?.exists && !tokenB_amount.isNaN()) {
      form.setValue(
        "tokenB_amount",
        removeTrailingZeroes(tokenB_amount.toFixed(precision)),
      );
    }
  }, [fields.tokenA_amount, pool, lpTotalSupply, spotPrice]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setLoading(true);
    try {
      if (pool?.exists) {
        await addLiquidity(
          values.tokenA_token,
          values.tokenB_token,
          addPrecision(values.tokenA_amount),
          addPrecision(values.tokenB_amount),
        );
      } else {
        await createPool(
          values.tokenA_token,
          values.tokenB_token,
          addPrecision(values.tokenA_amount),
          addPrecision(values.tokenB_amount),
        );
      }
    } finally {
      setLoading(false);
    }

    form.reset();
    form.clearErrors();
    form.trigger();
  };

  // if create pool, calculate the initial LP amount
  useEffect(() => {
    form.trigger();

    if (pool?.exists) {
      return;
    }

    if (!fields.tokenA_token || !fields.tokenB_token) return;
    if (fields.tokenA_token > fields.tokenB_token) {
      form.setValue("tokenLP_amount", fields.tokenA_amount);
    } else {
      form.setValue("tokenLP_amount", fields.tokenB_amount);
    }
  }, [
    fields.tokenA_amount,
    fields.tokenB_amount,
    fields.tokenA_token,
    fields.tokenB_token,
    pool,
  ]);

  const changeTokens = useCallback(() => {
    form.reset();
    form.setValue("tokenA_token", fields.tokenB_token);
    form.setValue("tokenB_token", fields.tokenA_token);

    form.clearErrors();
  }, [fields]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <AddLiquidityFormComponent
          onChangeTokens={changeTokens}
          poolExists={pool?.exists ?? true}
          loading={loading}
        />
      </form>
    </Form>
  );
}
