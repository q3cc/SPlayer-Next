<script setup lang="ts">
import { mobileLyricPip } from "@/mobile/lyricPip";
import { useSettingsStore } from "@/stores/settings";

const { t } = useI18n();
const settings = useSettingsStore();
const element = ref<HTMLElement>();
const visible = useElementVisibility(element);
const page = useDocumentVisibility();
const frame = ref("");
const failed = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;
let busy = false;
let disposed = false;
const release = (): void => {
  frame.value = "";
  void mobileLyricPip
    .releasePreview()
    .catch((error) => console.warn("[lyric-pip] 释放预览失败", error));
};

/** 直接预览原生绘制结果，一次只请求一帧；离开可见区域即释放。 */
const refresh = async (): Promise<void> => {
  clearTimeout(timer);
  if (busy || disposed || !visible.value || page.value !== "visible") return;
  busy = true;
  try {
    const next = await mobileLyricPip.preview();
    if (!disposed && visible.value && page.value === "visible") {
      frame.value = next;
      failed.value = false;
    }
  } catch {
    failed.value = true;
  } finally {
    busy = false;
    if (!disposed && visible.value && page.value === "visible") timer = setTimeout(refresh, 100);
    else release();
  }
};

watch([visible, page], () => {
  clearTimeout(timer);
  if (visible.value && page.value === "visible") void refresh();
  else if (!busy) release();
});
watch(
  () => settings.system.desktopLyric,
  () => void refresh(),
  { deep: true },
);
onBeforeUnmount(() => {
  disposed = true;
  clearTimeout(timer);
  frame.value = "";
  if (!busy) release();
});
</script>

<template>
  <div ref="element" class="rounded-xl bg-surface-panel border border-outline-variant/15 p-4">
    <div class="mb-3 text-sm text-on-surface-variant">
      {{ t("settings.lyricPipPreview.label") }}
    </div>
    <img
      v-if="frame && !failed"
      :src="frame"
      :alt="t('settings.lyricPipPreview.label')"
      class="w-full rounded-xl"
    />
    <div
      v-else
      class="aspect-4/1 grid place-items-center rounded-xl bg-black/80 text-white/70 text-sm"
    >
      {{ t(failed ? "settings.lyricPipPreview.failed" : "settings.lyricPipPreview.loading") }}
    </div>
  </div>
</template>
