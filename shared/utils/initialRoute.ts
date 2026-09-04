import { CURRENT_AGREEMENT_VERSION } from "../constants/agreement";

export type InitialRouteState = {
  onboardingCompleted: boolean;
  agreedAgreementVersion: number;
};

/**
 * 解析应用首次打开时的公共入口
 * @param state - 引导与协议状态
 * @returns 需要覆盖的入口路由；空字符串表示正常进入首页
 */
export const resolveInitialRoute = (state: InitialRouteState): string => {
  if (!state.onboardingCompleted) return "/onboarding";
  if (state.agreedAgreementVersion < CURRENT_AGREEMENT_VERSION) return "/agreement-update";
  return "";
};
