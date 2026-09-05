import { beforeEach, expect, it, vi } from "vitest";
import type { Track } from "@shared/types/player";
import { resolveQQMusicUrl } from "./qqmusic";

const { call } = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("@/apis/qqmusic", () => ({ qqmusicCall: call }));
const track = {
  id: "mid",
  source: "qqmusic",
  title: "晴天",
  artists: [],
  duration: 240000,
} as Track;
beforeEach(() => call.mockReset());

it("QQ 试听开关传入解析器且保留试听标记", async () => {
  call.mockResolvedValue({
    code: 200,
    data: [{ url: "https://example.com/trial.mp3", isTrial: true }],
  });
  expect(await resolveQQMusicUrl(track, "hq", true)).toMatchObject({
    available: true,
    isTrial: true,
  });
  expect(call).toHaveBeenCalledWith("song_url", expect.objectContaining({ allowTrial: true }));
});

it("QQ 下载及默认调用不请求试听", async () => {
  call.mockResolvedValue({ code: 403, data: [{ url: "" }] });
  expect(await resolveQQMusicUrl(track, "hq")).toMatchObject({ available: false });
  expect(call).toHaveBeenCalledWith("song_url", expect.objectContaining({ allowTrial: false }));
});
