import { convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { AlbumSummary, ArtistSummary, LibraryApi, ScanProgress } from "@shared/types/library";
import type { Track } from "@shared/types/player";

const STORAGE_KEY = "splayer.mobile.library";
const DIRECTORY_LABEL = "iOS Music";
const listeners = new Set<(progress: ScanProgress) => void>();

const readTracks = (): Track[] => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as Track[];
  } catch {
    return [];
  }
};

let tracks = readTracks();

const persist = (): void => localStorage.setItem(STORAGE_KEY, JSON.stringify(tracks));
const success = <T>(data?: T) => ({ success: true as const, data });
const announce = (progress: ScanProgress): void =>
  listeners.forEach((listener) => listener(progress));

const pathName = (path: string): string => decodeURIComponent(path.split("/").pop() ?? path);
const withoutExtension = (name: string): string => name.replace(/\.[^.]+$/, "");
const idFor = (path: string): string => {
  let hash = 2166136261;
  for (let i = 0; i < path.length; i++) hash = Math.imul(hash ^ path.charCodeAt(i), 16777619);
  return `ios-${(hash >>> 0).toString(16)}`;
};

const importFiles = (paths: string[]): void => {
  const known = new Set(tracks.map((track) => track.path));
  const now = Date.now();
  const additions = paths
    .filter((path) => !known.has(path))
    .map<Track>((path) => ({
      id: idFor(path),
      source: "local",
      path,
      title: withoutExtension(pathName(path)),
      artists: [{ name: "Unknown Artist" }],
      duration: 0,
      mtime: now,
      ctime: now,
    }));
  tracks = [...tracks, ...additions];
  persist();
};

export const resolveMobileAudioSource = (source: string): string => {
  if (/^(https?|blob|data|asset):/i.test(source)) return source;
  return convertFileSrc(source);
};

export const getMobileTrack = (id: string): Track | undefined =>
  tracks.find((track) => track.id === id);

export const mobileLibrary: LibraryApi = {
  scan: async () => {
    announce({ phase: "done", total: tracks.length, scanned: tracks.length });
    return success();
  },
  cancelScan: async () => success(),
  getTracks: async () => success(tracks),
  getAlbums: async () => {
    const groups = new Map<string, AlbumSummary>();
    for (const track of tracks) {
      const name = track.album?.name || "Unknown Album";
      const item = groups.get(name) ?? {
        name,
        artist: track.album?.artist || track.artists.map((artist) => artist.name).join(" / "),
        cover: track.cover,
        trackCount: 0,
      };
      item.trackCount++;
      groups.set(name, item);
    }
    return success([...groups.values()]);
  },
  getArtists: async () => {
    const groups = new Map<string, ArtistSummary>();
    for (const track of tracks) {
      for (const artist of track.artists) {
        const item = groups.get(artist.name) ?? {
          name: artist.name,
          cover: track.cover,
          trackCount: 0,
        };
        item.trackCount++;
        groups.set(artist.name, item);
      }
    }
    return success([...groups.values()]);
  },
  getAlbumTracks: async (name) => success(tracks.filter((track) => track.album?.name === name)),
  getArtistTracks: async (name) =>
    success(tracks.filter((track) => track.artists.some((artist) => artist.name === name))),
  getTracksByIds: async (ids) => {
    const wanted = new Set(ids);
    return success(tracks.filter((track) => wanted.has(track.id)));
  },
  searchTracks: async (query) => {
    const normalized = query.trim().toLocaleLowerCase();
    return success(
      tracks.filter((track) =>
        [track.title, track.album?.name, ...track.artists.map((artist) => artist.name)].some(
          (value) => value?.toLocaleLowerCase().includes(normalized),
        ),
      ),
    );
  },
  getTrackCount: async () => success(tracks.length),
  getRandomTrack: async () =>
    success(tracks.length ? tracks[Math.floor(Math.random() * tracks.length)] : null),
  getRandomTracks: async (limit) =>
    success([...tracks].sort(() => Math.random() - 0.5).slice(0, limit)),
  isScanning: async () => success(false),
  addScanDir: async () => {
    const selected = await open({
      multiple: true,
      directory: false,
      filters: [
        {
          name: "Audio",
          extensions: ["mp3", "m4a", "aac", "wav", "flac", "ogg", "opus", "ape"],
        },
      ],
    });
    const paths = selected == null ? [] : Array.isArray(selected) ? selected : [selected];
    if (!paths.length) return { success: false as const, error: "canceled" };
    importFiles(paths);
    announce({ phase: "done", total: paths.length, scanned: paths.length });
    return success(DIRECTORY_LABEL);
  },
  removeScanDir: async () => {
    tracks = [];
    persist();
    return success();
  },
  getScanDirs: async () => success(tracks.length ? [DIRECTORY_LABEL] : []),
  deleteTracks: async (paths) => {
    const deleted = tracks.filter((track) => track.path && paths.includes(track.path)).length;
    tracks = tracks.filter((track) => !track.path || !paths.includes(track.path));
    persist();
    return success({ deleted, failed: paths.length - deleted });
  },
  readTags: async () => ({ success: false, error: "tag editing is not available on iOS" }),
  writeTags: async () => ({ success: false, error: "tag editing is not available on iOS" }),
  pickCoverImage: async () => ({ success: false, error: "cover picking is not available on iOS" }),
  fetchArtistAvatar: async () => success(null),
  prefetchArtistAvatars: async () => success({}),
  onScanProgress: (callback) => {
    listeners.add(callback);
    return () => listeners.delete(callback);
  },
};
