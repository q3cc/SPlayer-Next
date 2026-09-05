import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Track } from "@shared/types/player";
import { resolveKugouUrl } from "./kugou";

const { call } = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("@/apis/kugou", () => ({ kugouCall: call }));
const track = {
  id: "hash",
  source: "kugou",
  title: "晴天",
  artists: [],
  duration: 240000,
} as Track;

beforeEach(() => {
  call.mockReset();
});

describe("酷狗试听回退", () => {
  it("完整链接优先，不额外请求试听", async () => {
    call.mockResolvedValue({ code: 200, data: { url: "https://example.com/full.mp3" } });
    expect(await resolveKugouUrl(track, "hq", true)).toEqual({
      available: true,
      url: "https://example.com/full.mp3",
      isTrial: false,
    });
    expect(call).toHaveBeenCalledTimes(1);
    expect(call.mock.calls[0][1].freePart).toBe(false);
  });

  it("开启允许试听后，完整链接不可用才请求试听并保留标记", async () => {
    call
      .mockResolvedValueOnce({ code: 403 })
      .mockResolvedValueOnce({ code: 200, data: { url: "https://example.com/trial.mp3" } });
    expect(await resolveKugouUrl(track, "hq", true)).toMatchObject({
      available: true,
      isTrial: true,
    });
    expect(call.mock.calls.map(([, params]) => params.freePart)).toEqual([false, true]);
  });

  it("关闭试听或下载调用不发起试听请求", async () => {
    call.mockResolvedValue({ code: 403 });
    expect(await resolveKugouUrl(track, "hq")).toMatchObject({ available: false });
    expect(call).toHaveBeenCalledTimes(1);
    expect(call.mock.calls[0][1].freePart).toBe(false);
  });

  it("完整链接接口报错后仍可尝试已允许的试听", async () => {
    call
      .mockRejectedValueOnce(new Error("VIP required"))
      .mockResolvedValueOnce({ code: 200, data: { url: "https://example.com/trial.mp3" } });
    expect(await resolveKugouUrl(track, "hq", true)).toMatchObject({
      available: true,
      isTrial: true,
    });
  });

  it("服务端直接返回试听标记时不能伪装成完整歌曲", async () => {
    call.mockResolvedValue({
      code: 200,
      data: { url: "https://example.com/trial.mp3", isTrial: true },
    });
    expect(await resolveKugouUrl(track, "hq", false)).toMatchObject({
      available: true,
      isTrial: true,
    });
  });

  it("平台没有提供试听链接时返回不可用，不无限重试", async () => {
    call.mockResolvedValue({ code: 403 });
    expect(await resolveKugouUrl(track, "hq", true)).toMatchObject({ available: false });
    expect(call).toHaveBeenCalledTimes(2);
  });
});
