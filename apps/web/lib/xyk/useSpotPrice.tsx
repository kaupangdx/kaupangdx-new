import { useMemo } from "react";
import BigNumber from "bignumber.js";

export function useSpotPrice(tokenAReserve?: string, tokenBReserve?: string) {
  return useMemo(() => {
    if (!tokenAReserve || !tokenBReserve || tokenBReserve == "0") return "0";
    return new BigNumber(tokenAReserve).div(tokenBReserve).toFixed(9);
  }, [tokenAReserve, tokenBReserve]);
}
