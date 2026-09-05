import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import SColor from "./SColor.vue";

/** 保留色板交互，只替换弹层和输入框。 */
const createPicker = () => {
  const wrapper = mount(SColor, {
    props: { modelValue: "#ff0000", showAlpha: false },
    global: {
      stubs: {
        SPopover: { template: "<div><slot name='trigger'/><slot/></div>" },
        SInput: true,
      },
    },
  });
  const panel = wrapper.get(".cursor-crosshair");
  panel.element.setPointerCapture = vi.fn();
  vi.spyOn(panel.element, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    width: 100,
    height: 100,
  } as DOMRect);
  return { wrapper, panel };
};

describe("拾色器触摸拖动", () => {
  it("按当前触点更新，不依赖鼠标按钮状态，抬起后停止", async () => {
    const { wrapper, panel } = createPicker();
    await panel.trigger("pointerdown", { pointerId: 1, button: 0, clientX: 100, clientY: 50 });
    await panel.trigger("pointermove", { pointerId: 1, buttons: 0, clientX: 0, clientY: 0 });
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual(["rgb(255, 255, 255)"]);
    await panel.trigger("pointerup", { pointerId: 1, clientX: 100, clientY: 100 });
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual(["rgb(0, 0, 0)"]);
    const count = wrapper.emitted("update:modelValue")?.length;
    await panel.trigger("pointermove", { pointerId: 1, buttons: 1, clientX: 0, clientY: 0 });
    expect(wrapper.emitted("update:modelValue")).toHaveLength(count!);
    wrapper.unmount();
  });

  it("忽略其他手指，并在取消或丢失捕获后停止", async () => {
    const { wrapper, panel } = createPicker();
    await panel.trigger("pointermove", { pointerId: 1, buttons: 1, clientX: 0, clientY: 0 });
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
    await panel.trigger("pointerdown", { pointerId: 1, button: 0, clientX: 100, clientY: 50 });
    const count = wrapper.emitted("update:modelValue")?.length;
    await panel.trigger("pointerdown", { pointerId: 2, button: 0, clientX: 0, clientY: 0 });
    await panel.trigger("pointermove", { pointerId: 2, buttons: 1, clientX: 0, clientY: 0 });
    expect(wrapper.emitted("update:modelValue")).toHaveLength(count!);
    await panel.trigger("pointercancel", { pointerId: 1 });
    await panel.trigger("pointermove", { pointerId: 1, buttons: 1, clientX: 0, clientY: 0 });
    expect(wrapper.emitted("update:modelValue")).toHaveLength(count!);
    await panel.trigger("pointerdown", { pointerId: 3, button: 0, clientX: 0, clientY: 0 });
    const nextCount = wrapper.emitted("update:modelValue")?.length;
    await panel.trigger("lostpointercapture", { pointerId: 3 });
    await panel.trigger("pointermove", { pointerId: 3, buttons: 1, clientX: 100, clientY: 100 });
    expect(wrapper.emitted("update:modelValue")).toHaveLength(nextCount!);
    wrapper.unmount();
  });
});
