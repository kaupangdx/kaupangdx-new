import { NoConfig } from "@proto-kit/common";
import { TokenId } from "@proto-kit/library";
import { RuntimeModule, state } from "@proto-kit/module";
import { State, StateMap } from "@proto-kit/protocol";
import { Bool, Field, Provable } from "o1js";
import { TokenPair as TokenPairLbp } from "./lbp/token-pair";
import { LPTokenId as LPTokenIdLbp } from "./lbp/lp-token-id";
import { TokenPair } from "./xyk/token-pair";
import { LPTokenId } from "./xyk/lp-token-id";
import { assert } from "console";

export class TokenIdId extends Field { }

// TODO: replace with Field MAX
export const MAX_TOKEN_ID = 99999;

export const errors = {
  tokenXYKAlreadyExist: () => `Token Id for xyk pool already exist`,
  tokenLBPAlreadyExist: () => `Token Id for lbp pool already exist`,
};

/**
 * Maintains an incremental registry of all the token IDs in circulation.
 */
export class TokenRegistry extends RuntimeModule<NoConfig> {
  @state() tokenIds = StateMap.from<TokenIdId, TokenId>(TokenIdId, TokenId);
  @state() lastTokenIdId = State.from(TokenIdId);
  @state() tokenIdList = StateMap.from<TokenId, TokenIdId>(TokenId, TokenIdId);

  /**
   * Prevents the creation of the same pool accross runtime
   */
  public addTokenPair(tokenAId: TokenId, tokenBId: TokenId, isXyk: Bool, checkLbp: Bool) {
    const tokenPairXyk = TokenPair.from(tokenAId, tokenBId);
    const lpTokenIdXyk = LPTokenId.fromTokenPair(tokenPairXyk);

    const tokenPairLbp = TokenPairLbp.from(tokenAId, tokenBId);
    const lpTokenIdLbp = LPTokenIdLbp.fromTokenPair(tokenPairLbp);

    const existXyk = this.tokenIdExist(lpTokenIdXyk);
    const existLbp = this.tokenIdExist(lpTokenIdLbp);

    const tokenIdToAdd = Provable.if(isXyk, TokenId, lpTokenIdXyk, lpTokenIdLbp);

    const lastTokenIdId = this.lastTokenIdId.get().value;
    const nextTokenIdId = lastTokenIdId.add(1);

    this.lastTokenIdId.set(nextTokenIdId);
    this.tokenIds.set(nextTokenIdId, tokenIdToAdd);
    this.tokenIdList.set(tokenIdToAdd, nextTokenIdId);

    const success = existXyk.not().and(checkLbp.and(existLbp).not());
    return success;
  }

  public tokenIdExist(tokenId: TokenId) {
    return this.tokenIdList.get(tokenId).isSome;
  }
}
