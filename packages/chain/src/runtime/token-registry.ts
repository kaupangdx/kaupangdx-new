import { NoConfig } from "@proto-kit/common";
import { TokenId } from "@proto-kit/library";
import { RuntimeModule, state } from "@proto-kit/module";
import { State, StateMap } from "@proto-kit/protocol";
import { Field } from "o1js";

export class TokenIdId extends Field {}

// TODO: replace with Field MAX
export const MAX_TOKEN_ID = 99999;

/**
 * Maintains an incremental registry of all the token IDs in circulation.
 */
export class TokenRegistry extends RuntimeModule<NoConfig> {
  @state() tokenIds = StateMap.from<TokenIdId, TokenId>(TokenIdId, TokenId);
  @state() lastTokenIdId = State.from(TokenIdId);

  public addTokenId(tokenId: TokenId) {
    const lastTokenIdId = this.lastTokenIdId.get().value;
    const nextTokenIdId = lastTokenIdId.add(1);

    this.lastTokenIdId.set(nextTokenIdId);
    this.tokenIds.set(nextTokenIdId, tokenId);
  }
}
