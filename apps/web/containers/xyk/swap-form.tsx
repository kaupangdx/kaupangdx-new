import { Form } from "@/components/ui/form";
import { SwapForm as SwapFormComponent } from "@/components/xyk/swap-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { addPrecision, removePrecision } from "./add-liquidity-form";
import BigNumber from "bignumber.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { useWalletStore } from "@/lib/stores/wallet";
import { useBalancesStore, useObserveBalance } from "@/lib/stores/balances";
import { PoolKey, TokenPair, dijkstra, prepareGraph } from "chain";
import { pools } from "@/tokens";
import { TokenId } from "@proto-kit/library";
import { useObservePool, useSellPath } from "@/lib/stores/xyk";

BigNumber.set({ ROUNDING_MODE: BigNumber.ROUND_DOWN });

export function SwapForm() {
  const [loading, setLoading] = useState(false);
  const walletBalance = useRef("0");
  const formSchema = z.object({
    tokenIn_token: z
      .string({
        required_error: "Token in is required",
        invalid_type_error: "Token in is required",
      })
      .min(1, { message: "Token in is required" }),
    tokenIn_amount: z
      .string({
        required_error: "Token in amount is required",
        invalid_type_error: "Token in amount is required",
      })
      .min(1, { message: "Token in amount is required" })
      .refine(
        (data) => {
          return new BigNumber(data).lte(
            removePrecision(walletBalance.current),
          );
        },
        {
          message: "Insufficient balance",
        },
      ),
    tokenOut_token: z
      .string({
        required_error: "Token out is required",
        invalid_type_error: "Token out is required",
      })
      .min(1, { message: "Token out is required" }),
    tokenOut_amount: z
      .string({
        required_error: "Token out amount is required",
        invalid_type_error: "Token out amount is required",
      })
      .min(1, { message: "Token out amount is required" }),
    route: z.array(z.string()).min(2, { message: "No route found" }),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      route: [],
    },
    reValidateMode: "onChange",
    mode: "onChange",
  });

  const fields = form.getValues();
  const wallet = useWalletStore();
  const balance = useObserveBalance(fields.tokenIn_token, wallet.wallet);

  const routerPools = pools.map(([tokenA, tokenB]) => {
    const poolKey = PoolKey.fromTokenPair(
      TokenPair.from(TokenId.from(tokenA), TokenId.from(tokenB)),
    ).toBase58();

    const pool = useObservePool(poolKey);
    const balanceA = useObserveBalance(tokenA, poolKey);
    const balanceB = useObserveBalance(tokenB, poolKey);

    return {
      tokenA,
      tokenB,
      pool,
      balanceA,
      balanceB,
    };
  });

  const poolKey = useMemo(() => {
    if (!fields.tokenIn_token || !fields.tokenOut_token) return;
    return PoolKey.fromTokenPair(
      TokenPair.from(
        TokenId.from(fields.tokenIn_token),
        TokenId.from(fields.tokenOut_token),
      ),
    ).toBase58();
  }, [fields.tokenIn_token, fields.tokenOut_token]);

  const pool = useObservePool(poolKey ?? "0");
  const tokenAReserve = useObserveBalance(fields.tokenIn_token, poolKey);
  const tokenBReserve = useObserveBalance(fields.tokenOut_token, poolKey);

  useEffect(() => {
    if (!fields.tokenIn_token || !fields.tokenOut_token || pool?.loading)
      return;

    if (pool?.exists) {
      form.setValue("route", [fields.tokenIn_token, fields.tokenOut_token], {
        shouldValidate: true,
      });
    } else {
      const currentRouterPools: [string, string][] = routerPools
        .filter((pool) => pool.pool?.exists)
        .map(({ tokenA, tokenB }) => [tokenA, tokenB]);

      try {
        const graph = prepareGraph(currentRouterPools);
        const distance = dijkstra(
          graph,
          fields.tokenIn_token,
          fields.tokenOut_token,
        );
        const route = distance?.path
          ? [fields.tokenIn_token, ...(distance?.path ?? [])]
          : [];

        console.log("route", route, distance?.path);
        form.setValue("route", route, {
          shouldValidate: true,
        });
      } catch (e) {
        form.setValue("route", [], {
          shouldValidate: true,
        });
      }
    }
  }, [fields.tokenIn_token, fields.tokenOut_token, pool]);

  useEffect(() => {
    walletBalance.current = balance ?? "0";
    form.formState.isDirty && form.trigger("tokenIn_amount");
  }, [balance, form.formState.isDirty]);

  const balances = useBalancesStore();

  useEffect(() => {
    if (
      !fields.route.length ||
      fields.tokenIn_amount === "0" ||
      !fields.tokenIn_amount
    ) {
      return form.setValue("tokenOut_amount", "0", {
        shouldValidate: true,
      });
    }

    let amountIn = fields.tokenIn_amount;
    let amountOut = "0";

    console.log("fields.route", fields.route);
    fields.route.forEach((token, index) => {
      const tokenIn = token;
      const tokenOut = fields.route[index + 1] ?? 99999; // MAX_TOKEN_ID
      const poolKey = PoolKey.fromTokenPair(
        TokenPair.from(TokenId.from(tokenIn), TokenId.from(tokenOut)),
      ).toBase58();
      const tokenInReserve = balances.balances[poolKey]?.[tokenIn];
      const tokenOutReserve = balances.balances[poolKey]?.[tokenOut];

      if (
        !tokenOutReserve ||
        !tokenInReserve ||
        tokenOutReserve === "0" ||
        tokenInReserve === "0"
      )
        return;

      // calculateAmountOut

      const intermediateAmountOut = new BigNumber(addPrecision(amountIn))
        .multipliedBy(tokenOutReserve)
        .div(new BigNumber(tokenInReserve).plus(addPrecision(amountIn)));

      console.log(
        "intermediateAmountOut",
        removePrecision(intermediateAmountOut.toFixed(2)),
      );

      const amountOutWithoutFee = intermediateAmountOut.minus(
        intermediateAmountOut.multipliedBy(3).dividedBy(100000),
      );

      amountOut = amountOutWithoutFee.toFixed(2);
      amountIn = removePrecision(amountOut);
    });

    if (new BigNumber(amountOut).isNaN()) return;

    console.log("new amount out", {
      balances: balances.balances,
      amountOut,
    });
    form.setValue("tokenOut_amount", removePrecision(amountOut), {
      shouldValidate: true,
    });
  }, [
    fields.tokenIn_amount,
    fields.tokenIn_token,
    fields.route,
    balances.balances,
  ]);

  const unitPrice = useMemo(() => {
    if (
      !fields.tokenIn_amount ||
      !fields.tokenOut_amount ||
      fields.tokenIn_amount === "0" ||
      fields.tokenOut_amount === "0"
    )
      return;
    return new BigNumber(fields.tokenOut_amount)
      .dividedBy(fields.tokenIn_amount)
      .toFixed(2);
  }, [fields.tokenIn_amount, fields.tokenOut_amount]);

  const sellPath = useSellPath();
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setLoading(true);
    try {
      await sellPath(
        values.route,
        addPrecision(values.tokenIn_amount),
        // TODO add slippage
        addPrecision(values.tokenOut_amount),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <SwapFormComponent
          unitPrice={unitPrice}
          loading={loading}
          route={fields.route}
        />
      </form>
    </Form>
  );
}
