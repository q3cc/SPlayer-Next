import {
  resolveStreamingAdapter,
  invalidateStreamingSession,
} from "@main/services/streaming/adapters/resolve";
import type { StreamingAdapter } from "@main/services/streaming/adapters/types";
import type { Album, Artist, Playlist, Track } from "@shared/types/player";
import type {
  StreamingApi,
  StreamingLibrarySnapshot,
  StreamingRuntimeConfig,
  StreamingServerConfig,
  StreamingServerInput,
} from "@shared/types/streaming";

const CONFIG_KEY = "splayer.mobile.streaming.servers";
const ACTIVE_KEY = "splayer.mobile.streaming.active";
const snapshots = new Map<string, StreamingLibrarySnapshot>();
const listeners = new Set<(serverId: string) => void>();

const emptySnapshot = (): StreamingLibrarySnapshot => ({
  songs: [],
  albums: [],
  artists: [],
  playlists: [],
});

const readServers = (): StreamingRuntimeConfig[] => {
  try {
    return JSON.parse(localStorage.getItem(CONFIG_KEY) ?? "[]") as StreamingRuntimeConfig[];
  } catch {
    return [];
  }
};

let servers = readServers();
const persist = (): void => localStorage.setItem(CONFIG_KEY, JSON.stringify(servers));
const publicConfig = ({
  password,
  accessToken: _token,
  userId: _user,
  ...server
}: StreamingRuntimeConfig): StreamingServerConfig => ({
  ...server,
  hasPassword: Boolean(password),
});
const requireServer = (id: string): StreamingRuntimeConfig => {
  const server = servers.find((item) => item.id === id);
  if (!server) throw new Error(`streaming server not found: ${id}`);
  return server;
};

const resolved = (id: string) => resolveStreamingAdapter(requireServer(id));

const cover = async (
  value: string | undefined,
  config: StreamingRuntimeConfig,
  adapter: StreamingAdapter,
): Promise<string | undefined> => {
  if (!value?.startsWith("streaming-cover://")) return value;
  const url = new URL(value);
  const coverId = url.searchParams.get("coverId");
  if (!coverId) return undefined;
  return adapter.getCoverUrl(config, coverId, Number(url.searchParams.get("size")) || 500);
};

const hydrateTrack = async (
  track: Track,
  config: StreamingRuntimeConfig,
  adapter: StreamingAdapter,
): Promise<Track> => ({
  ...track,
  cover: await cover(track.cover, config, adapter),
  coverOriginal: await cover(track.coverOriginal, config, adapter),
});
const hydrateAlbum = async (
  album: Album,
  config: StreamingRuntimeConfig,
  adapter: StreamingAdapter,
): Promise<Album> => ({
  ...album,
  cover: await cover(album.cover, config, adapter),
});
const hydrateArtist = async (
  artist: Artist,
  config: StreamingRuntimeConfig,
  adapter: StreamingAdapter,
): Promise<Artist> => ({
  ...artist,
  avatar: await cover(artist.avatar, config, adapter),
});
const hydratePlaylist = async (
  playlist: Playlist,
  config: StreamingRuntimeConfig,
  adapter: StreamingAdapter,
): Promise<Playlist> => ({
  ...playlist,
  cover: await cover(playlist.cover, config, adapter),
});

const createServer = (
  input: StreamingServerInput,
  id: string = crypto.randomUUID(),
): StreamingRuntimeConfig => ({
  id,
  ...input,
  url: input.url.replace(/\/+$/, ""),
  hasPassword: Boolean(input.password),
});

export const mobileStreaming: StreamingApi = {
  loadServers: async () => ({
    servers: servers.map(publicConfig),
    activeServerId: localStorage.getItem(ACTIVE_KEY),
  }),
  addServer: async (input) => {
    const server = createServer(input);
    servers.push(server);
    persist();
    return publicConfig(server);
  },
  updateServer: async (id, input) => {
    const index = servers.findIndex((server) => server.id === id);
    if (index < 0) throw new Error(`streaming server not found: ${id}`);
    const password = input.password || servers[index].password;
    servers[index] = createServer({ ...input, password }, id);
    invalidateStreamingSession(id);
    snapshots.delete(id);
    persist();
    return publicConfig(servers[index]);
  },
  removeServer: async (id) => {
    servers = servers.filter((server) => server.id !== id);
    snapshots.delete(id);
    invalidateStreamingSession(id);
    if (localStorage.getItem(ACTIVE_KEY) === id) localStorage.removeItem(ACTIVE_KEY);
    persist();
  },
  setActiveServer: async (id) => {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  },
  testConnection: async (input, id) => {
    const config = createServer(input, id ?? "test");
    try {
      const { config: authenticated, adapter } = await resolveStreamingAdapter(config);
      return adapter.ping(authenticated);
    } catch (error) {
      return {
        ok: false,
        code: "network",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
  connect: async (id) => {
    try {
      const { config, adapter } = await resolved(id);
      const ping = await adapter.ping(config);
      if (!ping.ok)
        return {
          ok: false,
          code: ping.code ?? "network",
          error: ping.error ?? "connection failed",
        };
      const server = requireServer(id);
      server.lastConnected = Date.now();
      persist();
      return { ok: true, server: publicConfig(server) };
    } catch (error) {
      return {
        ok: false,
        code: "auth",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
  disconnect: async (id) => invalidateStreamingSession(id),
  getSnapshot: async (id) => snapshots.get(id) ?? emptySnapshot(),
  sync: async (id) => {
    const { config, adapter } = await resolved(id);
    const [songs, albums, artists, playlists] = await Promise.all([
      adapter.listSongs(config, { limit: 1000 }),
      adapter.listAlbums(config, { limit: 1000 }),
      adapter.listArtists(config),
      adapter.listPlaylists(config),
    ]);
    snapshots.set(id, {
      songs: await Promise.all(songs.map((item) => hydrateTrack(item, config, adapter))),
      albums: await Promise.all(albums.map((item) => hydrateAlbum(item, config, adapter))),
      artists: await Promise.all(artists.map((item) => hydrateArtist(item, config, adapter))),
      playlists: await Promise.all(playlists.map((item) => hydratePlaylist(item, config, adapter))),
    });
    listeners.forEach((listener) => listener(id));
    return true;
  },
  onLibraryUpdated: (callback) => {
    listeners.add(callback);
    return () => listeners.delete(callback);
  },
  search: async (id, query) => {
    const value = query.trim().toLocaleLowerCase();
    const snapshot = snapshots.get(id) ?? emptySnapshot();
    return {
      songs: snapshot.songs.filter((song) =>
        [song.title, song.album?.name, ...song.artists.map((artist) => artist.name)].some((item) =>
          item?.toLocaleLowerCase().includes(value),
        ),
      ),
      albums: snapshot.albums.filter((album) => album.name.toLocaleLowerCase().includes(value)),
      artists: snapshot.artists.filter((artist) => artist.name.toLocaleLowerCase().includes(value)),
    };
  },
  getAlbumSongs: async (id, albumId) => {
    const { config, adapter } = await resolved(id);
    const items = await adapter.getAlbumSongs(config, albumId);
    return Promise.all(items.map((item) => hydrateTrack(item, config, adapter)));
  },
  getPlaylistSongs: async (id, playlistId) => {
    const { config, adapter } = await resolved(id);
    const items = await adapter.getPlaylistSongs(config, playlistId);
    return Promise.all(items.map((item) => hydrateTrack(item, config, adapter)));
  },
  getArtistAlbums: async (id, artistId) => {
    const { config, adapter } = await resolved(id);
    const items = await adapter.getArtistAlbums(config, artistId);
    return Promise.all(items.map((item) => hydrateAlbum(item, config, adapter)));
  },
  getArtistSongs: async (id, artistId) => {
    const { config, adapter } = await resolved(id);
    const items = await adapter.getArtistSongs(config, artistId);
    return Promise.all(items.map((item) => hydrateTrack(item, config, adapter)));
  },
  getStreamUrl: async (id, trackId, sessionId) => {
    const { config, adapter } = await resolved(id);
    return adapter.getStreamUrl(config, trackId, sessionId);
  },
  getLyrics: async (id, trackId, hint) => {
    const { config, adapter } = await resolved(id);
    return adapter.getLyrics(config, trackId, hint);
  },
};
