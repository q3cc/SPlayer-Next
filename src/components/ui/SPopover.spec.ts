import { readFileSync } from "node:fs";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import SPopover from "./SPopover.vue";

describe("移动端小浮层尺寸", () => {
  it.each(["颜色选择器", "音量滑块"])("%s 不匹配全宽弹窗规则", (name) => {
    const wrapper = mount(SPopover, {
      props: { open: true, trigger: "manual" },
      slots: { default: `<div>${name}</div>` },
      global: {
        stubs: {
          PopoverRoot: { template: "<div><slot/></div>" },
          PopoverTrigger: { template: "<div><slot/></div>" },
          PopoverPortal: { template: "<div><slot/></div>" },
          PopoverContent: { template: '<div role="dialog"><slot/></div>' },
          PopoverArrow: true,
        },
      },
      attachTo: document.body,
    });
    document.documentElement.classList.add("mobile");
    try {
      const css = readFileSync("src/styles/global.css", "utf8");
      const selector = css.match(/(html\.mobile[^{}]+)\{\s*width: calc\(100vw - 1rem\)/)?.[1];
      expect(selector).toBeDefined();
      const popover = wrapper.get('[role="dialog"]').element;
      expect(popover.hasAttribute("data-s-popover")).toBe(true);
      expect(popover.matches(selector!)).toBe(false);
      // 普通设置弹窗和确认框仍保留移动端宽度适配。
      for (const role of ["dialog", "alertdialog"]) {
        const dialog = document.createElement("div");
        dialog.setAttribute("role", role);
        document.body.append(dialog);
        expect(dialog.matches(selector!)).toBe(true);
        dialog.remove();
      }
    } finally {
      wrapper.unmount();
      document.documentElement.classList.remove("mobile");
    }
  });
});
