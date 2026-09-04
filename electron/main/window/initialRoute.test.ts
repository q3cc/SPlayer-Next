import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CURRENT_AGREEMENT_VERSION } from "../../../shared/constants/agreement";
import { resolveInitialRoute } from "../../../shared/utils/initialRoute";

describe("应用公共入口路由", () => {
  it("首次打开进入引导页", () => {
    assert.equal(
      resolveInitialRoute({
        onboardingCompleted: false,
        agreedAgreementVersion: CURRENT_AGREEMENT_VERSION,
      }),
      "/onboarding",
    );
  });

  it("协议过期进入协议更新页", () => {
    assert.equal(
      resolveInitialRoute({ onboardingCompleted: true, agreedAgreementVersion: 1 }),
      "/agreement-update",
    );
  });

  it("状态完整时正常进入首页", () => {
    assert.equal(
      resolveInitialRoute({
        onboardingCompleted: true,
        agreedAgreementVersion: CURRENT_AGREEMENT_VERSION,
      }),
      "",
    );
  });
});
