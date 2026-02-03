import { NoConfig } from "@proto-kit/common";
import { TokenId } from "@proto-kit/library";
import { RuntimeModule } from "@proto-kit/module";
import { State, StateMap, state } from "@proto-kit/protocol";
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

  public async addTokenId(tokenId: TokenId) {
    const lastTokenIdId = await this.lastTokenIdId.get();
    const nextTokenIdId = lastTokenIdId.value.add(1);
  
    await this.lastTokenIdId.set(nextTokenIdId);
    await this.tokenIds.set(nextTokenIdId, tokenId);
}
}