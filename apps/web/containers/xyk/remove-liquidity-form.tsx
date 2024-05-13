import { Form } from "@/components/ui/form";
import { RemoveLiquidityForm as RemoveLiquidityFormComponent } from "@/components/xyk/remove-liquidity-form";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useAddLiquidity,
  useCreatePool,
  useObservePool,
  usePool,
  useRemoveLiquidity,
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

export function RemoveLiquidityForm() {
  const [loading, setLoading] = useState(false);
  const removeLiquidity = useRemoveLiquidity();
  const { wallet } = useWalletStore();

  const balanceLPRef = useRef("0");

  const formSchema = z
    .object({
      tokenA_token: z
        .string({
          required_error: "Token A is required",
          invalid_type_error: "Token A is required",
        })
        .min(1, { message: "Token A is required" }),
      tokenA_amount: z
        .string({
          required_error: "Token A amount is required",
        })
        .min(1, { message: "Token A amount is required" }),
      tokenB_token: z
        .string({
          required_error: "Token B is required",
          invalid_type_error: "Token B is required",
        })
        .min(1, { message: "Token B is required" }),
      tokenB_amount: z
        .string({
          required_error: "Token B amount is required",
        })
        .min(1, { message: "Token B amount is required" }),
      tokenLP_amount: z.any(),
    })
    .refine((data) => data.tokenA_token !== data.tokenB_token, {
      message: "Tokens must be different",
      path: ["tokenA_token"],
    })

    .refine(
      (data) =>
        new BigNumber(data.tokenLP_amount).lte(
          removePrecision(balanceLPRef.current),
        ),
      {
        message: "Insufficient balance",
        path: ["tokenLP_amount"],
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
  const userTokenLpBalance = useObserveBalance(
    LPTokenId.fromTokenPair(tokenPair).toString(),
    wallet,
  );

  useEffect(() => {
    if (!userTokenLpBalance) return;
    balanceLPRef.current = userTokenLpBalance;
    form.formState.isDirty && form.trigger();
  }, [userTokenLpBalance, form.formState.isDirty]);

  useEffect(() => {
    form.formState.isDirty && form.trigger();
  }, [fields.tokenLP_amount, form.formState.isDirty]);

  const lpTotalSupply = useObserveTotalSupply(
    LPTokenId.fromTokenPair(tokenPair).toString(),
  );

  const spotPrice = useSpotPrice(tokenAReserve, tokenBReserve);

  // calculate amount A & amount B
  useEffect(() => {
    if (!lpTotalSupply || !tokenAReserve || !tokenBReserve) return;

    const supplyFraction = new BigNumber(lpTotalSupply).dividedBy(
      fields.tokenLP_amount,
    );
    const tokenA_amount = new BigNumber(tokenAReserve).dividedBy(
      supplyFraction,
    );
    const tokenB_amount = new BigNumber(tokenBReserve).dividedBy(
      supplyFraction,
    );

    if (
      !pool?.loading &&
      pool?.exists &&
      !tokenB_amount.isNaN() &&
      !tokenA_amount.isNaN()
    ) {
      form.setValue(
        "tokenA_amount",
        removeTrailingZeroes(tokenA_amount.toFixed(precision)),
      );
      form.setValue(
        "tokenB_amount",
        removeTrailingZeroes(tokenB_amount.toFixed(precision)),
      );
    }
  }, [
    fields.tokenLP_amount,
    pool,
    lpTotalSupply,
    spotPrice,
    tokenAReserve,
    tokenBReserve,
  ]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setLoading(true);
    try {
      if (pool?.exists) {
        await removeLiquidity(
          values.tokenA_token,
          values.tokenB_token,
          addPrecision(values.tokenLP_amount),
          // TODO: actually add a limit here based on allowed slippage

          new BigNumber(values.tokenA_token).lt(values.tokenB_token)
            ? addPrecision(values.tokenB_amount)
            : addPrecision(values.tokenA_amount),
          new BigNumber(values.tokenA_token).lt(values.tokenB_token)
            ? addPrecision(values.tokenA_amount)
            : addPrecision(values.tokenB_amount),
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
  // useEffect(() => {
  //   form.trigger();

  //   if (pool?.exists) {
  //     return;
  //   }

  //   if (!fields.tokenA_token || !fields.tokenB_token) return;
  //   if (fields.tokenA_token > fields.tokenB_token) {
  //     form.setValue("tokenLP_amount", fields.tokenA_amount);
  //   } else {
  //     form.setValue("tokenLP_amount", fields.tokenB_amount);
  //   }
  // }, [
  //   fields.tokenA_amount,
  //   fields.tokenB_amount,
  //   fields.tokenA_token,
  //   fields.tokenB_token,
  //   pool,
  // ]);

  const changeTokens = useCallback(() => {
    form.reset();
    form.setValue("tokenA_token", fields.tokenB_token);
    form.setValue("tokenB_token", fields.tokenA_token);

    form.clearErrors();
  }, [fields]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <RemoveLiquidityFormComponent
          onChangeTokens={changeTokens}
          poolExists={pool?.exists ?? true}
          loading={loading}
        />
      </form>
    </Form>
  );
}
