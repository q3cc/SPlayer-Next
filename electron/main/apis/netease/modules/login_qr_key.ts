/**
 * 获取二维码登录 unikey
 */

import type { NeteaseModule } from "../core/types";
import { createWebQrRequest, mergeCookieLists } from "../core/webQrLogin";

const loginQrKey: NeteaseModule = async (query, request) => {
  const web = createWebQrRequest(query);
  const result = await request(
    "/api/login/qrcode/unikey",
    { type: 1, noCheckToken: true, ...(query.lastUnikey ? { lastUnikey: query.lastUnikey } : {}) },
    web.options,
  );
  return {
    status: 200,
    body: { data: result.body, code: 200 },
    cookie: mergeCookieLists(web.cookies, result.cookie),
  };
};

export default loginQrKey;
