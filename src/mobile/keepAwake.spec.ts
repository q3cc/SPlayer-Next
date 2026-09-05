import { readFileSync } from "node:fs";
import { effectScope, nextTick, ref, watch } from "vue";
import { describe, expect, it, vi } from "vitest";

describe("播放页歌词常亮", () => {
  it("仅在前台显示歌词时开启，收起、隐藏、后台及卸载时释放", async () => {
    const source = readFileSync("src/components/player/FullPlayer/index.vue", "utf8");
    const block = source.slice(
      source.indexOf("if (isIOS) {"),
      source.indexOf("const toggleLyric ="),
    );
    const expanded = ref(false);
    const lyrics = ref(true);
    const visibility = ref("visible");
    const invoke = vi.fn().mockResolvedValue(undefined);
    let unmount = () => {};
    const scope = effectScope();
    scope.run(() => {
      new Function(
        "isIOS",
        "watch",
        "isPlayerExpanded",
        "lyricToggleActive",
        "pageVisibility",
        "invoke",
        "onBeforeUnmount",
        block.replace("invoke<void>", "invoke"),
      )(true, watch, expanded, lyrics, visibility, invoke, (callback: () => void) => {
        unmount = callback;
      });
    });
    const check = async (enabled: boolean) => {
      await nextTick();
      await vi.waitFor(() =>
        expect(invoke).toHaveBeenLastCalledWith("plugin:lyric-pip|keepawake", { enabled }),
      );
    };
    await check(false);
    expanded.value = true;
    await check(true);
    lyrics.value = false;
    await check(false);
    lyrics.value = true;
    await check(true);
    visibility.value = "hidden";
    await check(false);
    visibility.value = "visible";
    await check(true);
    expanded.value = false;
    await check(false);
    expanded.value = true;
    await check(true);
    unmount();
    await check(false);
    scope.stop();
  });
});
