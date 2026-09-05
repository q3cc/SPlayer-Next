<script setup lang="ts">
import { colord } from "colord";

/** 输出颜色格式 */
export type SColorFormat = "rgb" | "hex";

export interface SColorProps {
  /** 当前颜色 */
  modelValue?: string;
  /** 禁用 */
  disabled?: boolean;
  /** 是否支持透明度 */
  showAlpha?: boolean;
  /** 输出格式 */
  format?: SColorFormat;
  /** 预设色板 */
  swatches?: string[];
}

const props = withDefaults(defineProps<SColorProps>(), {
  modelValue: "rgb(0, 0, 0)",
  disabled: false,
  showAlpha: true,
  format: "rgb",
  swatches: () => [],
});

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

/** 限制值在 [min, max] 区间 */
const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/** 棋盘格多层 gradient 定义，用于模拟透明背景 */
const CHECKER_IMAGE =
  "linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)";
const CHECKER_POSITION = "0 0, 0 4px, 4px -4px, -4px 0";

/** 纯棋盘格背景样式 */
const checkerStyle = {
  backgroundColor: "#fff",
  backgroundImage: CHECKER_IMAGE,
  backgroundSize: "8px 8px",
  backgroundPosition: CHECKER_POSITION,
};

/** 在棋盘格之上叠一层纯色，alpha<1 时棋盘透出 */
const buildChipStyle = (color: string): Record<string, string> => ({
  backgroundColor: "#fff",
  backgroundImage: `linear-gradient(${color}, ${color}), ${CHECKER_IMAGE}`,
  backgroundSize: "100% 100%, 8px 8px, 8px 8px, 8px 8px, 8px 8px",
  backgroundPosition: `0 0, ${CHECKER_POSITION}`,
});

/** 色相 0-360 */
const h = ref(0);
/** 饱和度 0-100 */
const s = ref(0);
/** 明度 0-100 */
const v = ref(0);
/** 不透明度 0-1 */
const a = ref(1);

/** 将外部颜色字符串解析为 HSV + alpha，s=0 时保持原 hue 避免漂移 */
const syncFromModel = (input: string): void => {
  const c = colord(input.trim());
  if (!c.isValid()) return;
  const hsv = c.toHsv();
  if (hsv.s > 0) h.value = hsv.h;
  s.value = hsv.s;
  v.value = hsv.v;
  a.value = hsv.a;
};

syncFromModel(props.modelValue);

watch(
  () => props.modelValue,
  (val) => {
    if (
      colord(val).isValid() &&
      colord(val).toRgbString() === colord(currentValue.value).toRgbString()
    )
      return;
    syncFromModel(val);
  },
);

/** colord 单一真值源：内部 HSV 状态（拾色器 UI 需要）+ alpha → colord 实例，所有输出都派生它 */
const currentColord = computed(() => colord({ h: h.value, s: s.value, v: v.value, a: a.value }));

/** 当前颜色的字符串表示 */
const currentValue = computed(() => {
  const c = props.showAlpha ? currentColord.value : currentColord.value.alpha(1);
  return props.format === "hex" ? c.toHex() : c.toRgbString();
});

/** alpha 滑条渐变终点色 */
const currentRgb = computed(() => currentColord.value.alpha(1).toRgbString());

/** chip / thumb 实际显示 */
const currentBg = computed(() => {
  const color = props.showAlpha ? currentColord.value : currentColord.value.alpha(1);
  return color.toRgbString();
});

/** SV 面板背景 */
const svBackground = computed(
  () =>
    `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${h.value}, 100%, 50%))`,
);

/** 触发器色块样式 */
const chipStyle = computed(() => buildChipStyle(currentBg.value));

/** 把当前状态格式化后通知父组件 */
const emitUpdate = (): void => {
  const next = currentValue.value;
  if (next === props.modelValue) return;
  emit("update:modelValue", next);
};

/** 颜色输入框本地值 */
const textInput = ref(currentValue.value);
watch(currentValue, (val) => {
  textInput.value = val;
});

/** 输入框 blur/enter 提交 */
const commitInput = (): void => {
  const raw = textInput.value.trim();
  if (colord(raw).isValid()) {
    syncFromModel(raw);
    emitUpdate();
  }
  textInput.value = currentValue.value;
};

/** 生成一组 pointer 事件处理器 */
const useTrackPointer = (
  targetRef: Ref<HTMLElement | undefined>,
  apply: (ratioX: number, ratioY: number) => void,
): {
  onDown: (event: PointerEvent) => void;
  onMove: (event: PointerEvent) => void;
  onEnd: (event: PointerEvent) => void;
} => {
  let pointerId: number | undefined;
  const run = (event: PointerEvent): void => {
    const rect = targetRef.value?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    const x = clamp(event.clientX - rect.left, 0, rect.width) / rect.width;
    const y = clamp(event.clientY - rect.top, 0, rect.height) / rect.height;
    apply(x, y);
    emitUpdate();
  };
  return {
    onDown: (event) => {
      if (props.disabled || pointerId !== undefined || event.button !== 0) return;
      pointerId = event.pointerId;
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      run(event);
    },
    onMove: (event) => {
      if (props.disabled || event.pointerId !== pointerId) return;
      run(event);
    },
    onEnd: (event) => {
      if (event.pointerId !== pointerId) return;
      if (!props.disabled && event.type === "pointerup") run(event);
      pointerId = undefined;
    },
  };
};

const svRef = ref<HTMLElement>();
const hueRef = ref<HTMLElement>();
const alphaRef = ref<HTMLElement>();

const sv = useTrackPointer(svRef, (x, y) => {
  s.value = x * 100;
  v.value = 100 - y * 100;
});
const hue = useTrackPointer(hueRef, (x) => {
  h.value = x * 360;
});
const alpha = useTrackPointer(alphaRef, (x) => {
  // 透明度滑块按 1%（0.01）步进，避免 0.7234567 这种浮点尾巴
  a.value = Math.round(x * 100) / 100;
});

/** 点击预设色块，同步到状态并上报 */
const selectSwatch = (swatch: string): void => {
  syncFromModel(swatch);
  emitUpdate();
};

/** 判断预设色是否等于当前值（基于 colord 标准化对比） */
const isSwatchActive = (swatch: string): boolean => {
  const x = colord(swatch);
  const y = colord(currentValue.value);
  return x.isValid() && y.isValid() && x.toRgbString() === y.toRgbString();
};
</script>

<template>
  <div class="inline-flex items-center gap-2">
    <SPopover :side-offset="8" align="end">
      <template #trigger>
        <div
          class="inline-block p-1 rounded-lg border border-solid border-on-surface/20 shadow-sm transition-colors duration-200 hover:border-primary"
          :class="disabled ? 'opacity-40 pointer-events-none' : 'cursor-pointer'"
        >
          <div class="block w-6 h-6 rounded" :style="chipStyle" />
        </div>
      </template>

      <div class="flex flex-col gap-2.5 w-44">
        <div
          ref="svRef"
          class="relative w-full aspect-square rounded-lg overflow-hidden cursor-crosshair select-none touch-none"
          :style="{ background: svBackground }"
          @pointerdown="sv.onDown"
          @pointermove="sv.onMove"
          @pointerup="sv.onEnd"
          @pointercancel="sv.onEnd"
          @lostpointercapture="sv.onEnd"
        >
          <div
            class="absolute w-3.5 h-3.5 rounded-full border-2 border-solid border-white shadow-[0_1px_3px_rgba(0,0,0,0.5)] pointer-events-none"
            :style="{
              left: `clamp(7px, ${s}%, calc(100% - 7px))`,
              top: `clamp(7px, ${100 - v}%, calc(100% - 7px))`,
              translate: '-50% -50%',
            }"
          />
        </div>

        <div
          ref="hueRef"
          class="relative w-full h-3 rounded-full cursor-pointer select-none touch-none"
          :style="{
            background:
              'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
          }"
          @pointerdown="hue.onDown"
          @pointermove="hue.onMove"
          @pointerup="hue.onEnd"
          @pointercancel="hue.onEnd"
          @lostpointercapture="hue.onEnd"
        >
          <div
            class="absolute top-1/2 w-4 h-4 rounded-full border-2 border-solid border-white shadow-[0_1px_3px_rgba(0,0,0,0.5)] pointer-events-none"
            :style="{
              left: `clamp(8px, ${(h / 360) * 100}%, calc(100% - 8px))`,
              translate: '-50% -50%',
              background: `hsl(${h}, 100%, 50%)`,
            }"
          />
        </div>

        <div
          v-if="showAlpha"
          ref="alphaRef"
          class="relative w-full h-3 rounded-full cursor-pointer select-none touch-none"
          :style="checkerStyle"
          @pointerdown="alpha.onDown"
          @pointermove="alpha.onMove"
          @pointerup="alpha.onEnd"
          @pointercancel="alpha.onEnd"
          @lostpointercapture="alpha.onEnd"
        >
          <div
            class="absolute inset-0 rounded-full"
            :style="{ background: `linear-gradient(to right, transparent, ${currentRgb})` }"
          />
          <div
            class="absolute top-1/2 w-4 h-4 rounded-full border-2 border-solid border-white shadow-[0_1px_3px_rgba(0,0,0,0.5)] pointer-events-none"
            :style="{
              left: `clamp(8px, ${a * 100}%, calc(100% - 8px))`,
              translate: '-50% -50%',
              background: currentBg,
            }"
          />
        </div>

        <div v-if="swatches.length" class="flex flex-wrap gap-1.5">
          <span
            v-for="sw in swatches"
            :key="sw"
            class="block w-5 h-5 rounded-md border border-solid border-on-surface/20 cursor-pointer transition-transform hover:scale-110"
            :class="isSwatchActive(sw) ? 'ring-2 ring-primary' : ''"
            :style="buildChipStyle(sw)"
            @click="selectSwatch(sw)"
          />
        </div>
      </div>
    </SPopover>

    <div class="w-40">
      <SInput
        v-model="textInput"
        :disabled="disabled"
        @blur="commitInput"
        @keydown.enter="commitInput"
      />
    </div>
  </div>
</template>
