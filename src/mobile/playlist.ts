import type {
  LegacyPlaylistRecord,
  PlaylistApi,
  PlaylistCreateInput,
  PlaylistDetail,
  PlaylistSummary,
  PlaylistUpdateInput,
} from "@shared/types/playlist";
import type { Track } from "@shared/types/player";
import { getMobileTrack } from "./library";

interface StoredPlaylist extends PlaylistSummary {
  trackIds: string[];
  tracks?: Track[];
}

const STORAGE_KEY = "splayer.mobile.playlists";

const read = (): StoredPlaylist[] => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as StoredPlaylist[];
  } catch {
    return [];
  }
};

let playlists = read();
const persist = (): void => localStorage.setItem(STORAGE_KEY, JSON.stringify(playlists));
const summary = ({
  trackIds: _trackIds,
  tracks: _tracks,
  ...rest
}: StoredPlaylist): PlaylistSummary => rest;

export const rememberPlaylistTracks = (items: Track[]): void => {
  if (!items.length) return;
  const byId = new Map(items.map((track) => [track.id, track]));
  let changed = false;
  playlists = playlists.map((playlist) => {
    if (!playlist.trackIds.some((id) => byId.has(id))) return playlist;
    const tracks = [...(playlist.tracks ?? []).filter((track) => !byId.has(track.id)), ...items];
    changed = true;
    return { ...playlist, tracks };
  });
  if (changed) persist();
};

export const mobilePlaylist: PlaylistApi = {
  list: async () => playlists.map(summary),
  get: async (id): Promise<PlaylistDetail | null> => {
    const item = playlists.find((playlist) => playlist.id === id);
    if (!item) return null;
    const snapshots = new Map((item.tracks ?? []).map((track) => [track.id, track]));
    return {
      ...summary(item),
      tracks: item.trackIds
        .map((trackId) => getMobileTrack(trackId) ?? snapshots.get(trackId))
        .filter((track): track is Track => Boolean(track)),
    };
  },
  create: async (input: PlaylistCreateInput) => {
    const now = Date.now();
    const item: StoredPlaylist = {
      id: crypto.randomUUID(),
      type: input.type,
      title: input.title,
      description: input.description,
      trackCount: 0,
      createTime: now,
      updateTime: now,
      trackIds: [],
      tracks: [],
    };
    playlists.unshift(item);
    persist();
    return summary(item);
  },
  update: async (id: string, input: PlaylistUpdateInput) => {
    const item = playlists.find((playlist) => playlist.id === id);
    if (!item) return null;
    Object.assign(item, input, { updateTime: Date.now() });
    persist();
    return summary(item);
  },
  remove: async (id) => {
    playlists = playlists.filter((playlist) => playlist.id !== id);
    persist();
  },
  addTracks: async (id, trackIds, trackSnapshots) => {
    const item = playlists.find((playlist) => playlist.id === id);
    if (!item) return 0;
    const existing = new Set(item.trackIds);
    const additions = trackIds.filter((trackId) => !existing.has(trackId));
    item.trackIds.push(...additions);
    if (trackSnapshots?.length) {
      const incoming = new Map(trackSnapshots.map((track) => [track.id, track]));
      item.tracks = [
        ...(item.tracks ?? []).filter((track) => !incoming.has(track.id)),
        ...trackSnapshots,
      ];
    }
    item.trackCount = item.trackIds.length;
    item.updateTime = Date.now();
    persist();
    return additions.length;
  },
  removeTracks: async (id, trackIds) => {
    const item = playlists.find((playlist) => playlist.id === id);
    if (!item) return 0;
    const removing = new Set(trackIds);
    const before = item.trackIds.length;
    item.trackIds = item.trackIds.filter((trackId) => !removing.has(trackId));
    item.tracks = item.tracks?.filter((track) => !removing.has(track.id));
    item.trackCount = item.trackIds.length;
    item.updateTime = Date.now();
    persist();
    return before - item.trackIds.length;
  },
  importLegacy: async (records: LegacyPlaylistRecord[]) => {
    const existing = new Set(playlists.map((playlist) => playlist.id));
    const now = Date.now();
    playlists.push(
      ...records
        .filter((record) => !existing.has(record.id))
        .map((record) => ({
          id: record.id,
          type: "local" as const,
          title: record.title,
          description: record.description,
          cover: record.cover,
          trackIds: record.trackIds,
          trackCount: record.trackIds.length,
          createTime: record.createTime ?? now,
          updateTime: record.updateTime ?? now,
        })),
    );
    persist();
  },
  clear: async () => {
    playlists = [];
    persist();
  },
};
