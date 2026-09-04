/**
 * 生成二维码登录 URL（可选返回 data URL 图像）
 */

import type { NeteaseModule } from "../core/types";
import { generateWebQrChainId } from "../core/webQrLogin";

const qrLoginChains = new Map<string, string>();

const rememberChain = (key: string, chainId: string): void => {
  if (qrLoginChains.size >= 32) qrLoginChains.delete(qrLoginChains.keys().next().value ?? "");
  qrLoginChains.set(key, chainId);
};

export const takeQrLoginChain = (key: string): string | undefined => qrLoginChains.get(key);

export const forgetQrLoginChain = (key: string): void => {
  qrLoginChains.delete(key);
};

const loginQrCreate: NeteaseModule = async (query) => {
  const key = String(query.key ?? "");
  const chainId =
    typeof query.chainId === "string" ? query.chainId : generateWebQrChainId(query.cookie);
  if (key) rememberChain(key, chainId);
  const url = `https://music.163.com/st/platform/scanlogin?codekey=${encodeURIComponent(key)}&chainId=${encodeURIComponent(chainId)}&hdw_device=web&hdw_appid=web&hitExp=1`;
  return {
    status: 200,
    body: {
      code: 200,
      data: { qrurl: url, qrimg: "", chainId },
    },
    cookie: [],
  };
};

export default loginQrCreate;
