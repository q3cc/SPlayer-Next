"""检查固定横屏 iPad 场景中，右上角画中画内部是否仍是黑屏。"""

import json
import sys
from pathlib import Path

from PIL import Image


def main():
    root = Path(sys.argv[1])
    manifest = json.loads((root / "manifest.json").read_text())
    attachments = [item for test in manifest for item in test["attachments"]]
    failed = False
    for prefix in ("03-pip-home_", "04-pip-home-later_"):
        matches = [
            item for item in attachments
            if item.get("suggestedHumanReadableName", "").startswith(prefix)
        ]
        if len(matches) != 1:
            raise RuntimeError(f"缺少唯一的桌面画中画截图：{prefix}")
        with Image.open(root / matches[0]["exportedFileName"]) as image:
            width, height = image.size
            if width <= height:
                raise RuntimeError("此检查仅用于未拖动画中画的横屏 iPad 测试")
            # 避开窗口边缘、状态栏和桌面图标，仅检测小窗内歌词区域。
            region = image.crop((int(width * .75), int(height * .08),
                                 int(width * .96), int(height * .21))).convert("RGB")
            bright = sum(min(pixel) >= 180 for pixel in region.getdata())
            ratio = bright / (region.width * region.height)
            print(f"{prefix}: bright_pixels={bright}, ratio={ratio:.6f}", flush=True)
            if ratio < .001:
                failed = True
                print("FAIL: 画中画内容区域没有可见文字，不能把窗口开启当作显示正常", flush=True)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
