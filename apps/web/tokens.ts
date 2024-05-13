"use client";

import { TokenId } from "@proto-kit/library";
import { LPTokenId, TokenPair } from "chain";

const lpToken01 = LPTokenId.fromTokenPair(
  TokenPair.from(TokenId.from(0), TokenId.from(1)),
).toString();

const lpToken02 = LPTokenId.fromTokenPair(
  TokenPair.from(TokenId.from(0), TokenId.from(2)),
).toString();

const lpToken12 = LPTokenId.fromTokenPair(
  TokenPair.from(TokenId.from(1), TokenId.from(2)),
).toString();

export const tokens: Record<
  string,
  | {
      ticker: string;
      name: string;
      logo: string;
    }
  | undefined
> = {
  "0": {
    ticker: "MINA",
    name: "Mina Protocol",
    logo: "/tokens/mina.svg",
  },
  "1": {
    ticker: "DAI",
    name: "DAI Stablecoin",
    logo: "/tokens/dai.svg",
  },
  "2": {
    ticker: "BTC",
    name: "Bitcoin",
    logo: "/tokens/btc.svg",
  },
  [lpToken01]: {
    ticker: "MINA/DAI",
    name: "LP Token",
    logo: "/tokens/lp.svg",
  },
  [lpToken02]: {
    ticker: "MINA/BTC",
    name: "LP Token",
    logo: "/tokens/lp.svg",
  },
  [lpToken12]: {
    ticker: "DAI/BTC",
    name: "LP Token",
    logo: "/tokens/lp.svg",
  },
};

export const pools: [string, string][] = [
  ["0", "1"],
  ["1", "2"],
];
