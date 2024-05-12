import { TokenId } from "@proto-kit/library";
import { PoolKey, TokenPair } from "chain";
import { useMemo } from "react";

export function usePoolKey(tokenAId?: string, tokenBId?: string) {
  return useMemo(() => {
    const tokenPair = TokenPair.from(
      TokenId.from(tokenAId ?? "0"),
      TokenId.from(tokenBId ?? "0"),
    );

    if (!tokenAId || !tokenBId)
      return {
        tokenPair,
        poolKey: "0",
      };

    return { tokenPair, poolKey: PoolKey.fromTokenPair(tokenPair).toBase58() };
  }, [tokenAId, tokenBId]);
}
