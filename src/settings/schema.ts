import type { SettingCategory } from "@/types/settings-schema";
import generalCategory from "./categories/general";
import appearanceCategory from "./categories/appearance";
import playerCategory from "./categories/player";
import lyricCategory from "./categories/lyric";
import externalLyricCategory from "./categories/externalLyric";
import hotkeysCategory from "./categories/hotkeys";
import servicesCategory from "./categories/services";
import aiIntegrationCategory from "./categories/aiIntegration";
import mediaSourceCategory from "./categories/streaming";
import downloadCategory from "./categories/download";
import localCacheCategory from "./categories/localCache";
import pluginsCategory from "./categories/plugins";
import otherCategory from "./categories/other";
import AboutSettings from "@/components/settings/custom/AboutSettings.vue";
import { isIOS } from "@/utils/config";
import IconLucideInfo from "~icons/lucide/info";

const onlySections = (category: SettingCategory, ids: string[]): SettingCategory => ({
  ...category,
  sections: category.sections?.filter((section) => ids.includes(section.id)),
});

const mobileGeneral = onlySections(generalCategory, ["language", "update", "debug", "backupReset"]);
const mobileAppearance = onlySections(appearanceCategory, [
  "theme",
  "appearanceStyle",
  "playerBar",
  "nowPlaying",
]);
const mobilePlayer: SettingCategory = {
  ...onlySections(playerCategory, ["playControl", "audioSource", "scrobble"]),
  sections: playerCategory.sections
    ?.filter((section) => ["playControl", "audioSource", "scrobble"].includes(section.id))
    .map((section) =>
      section.id === "playControl"
        ? {
            ...section,
            items: section.items.filter((item) =>
              ["autoPlay", "rememberLastTrack"].includes(item.key),
            ),
          }
        : section,
    ),
};
const mobileServices = onlySections(servicesCategory, ["network", "media"]);
const mobileDownload = onlySections(downloadCategory, ["downloadGeneral"]);
const mobileExternalLyric: SettingCategory = {
  ...onlySections(externalLyricCategory, ["desktopLyric"]),
  sections: externalLyricCategory.sections
    ?.filter((section) => section.id === "desktopLyric")
    .map((section) => ({
      ...section,
      items: section.items
        .filter((item) => item.key === "desktopLyricEnabled")
        .map((item) => ({ ...item, key: "lyricPipEnabled" })),
    })),
};

export const settingsSchema: SettingCategory[] = [
  isIOS ? mobileGeneral : generalCategory,
  isIOS ? mobileAppearance : appearanceCategory,
  isIOS ? mobilePlayer : playerCategory,
  lyricCategory,
  ...(isIOS ? [mobileExternalLyric] : [externalLyricCategory, hotkeysCategory]),
  isIOS ? mobileServices : servicesCategory,
  ...(isIOS ? [] : [aiIntegrationCategory]),
  mediaSourceCategory,
  isIOS ? mobileDownload : downloadCategory,
  ...(isIOS ? [] : [localCacheCategory, pluginsCategory]),
  otherCategory,
  { id: "about", icon: IconLucideInfo, component: AboutSettings },
];
