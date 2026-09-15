/**
 * A far smaller slice of the pasted "Session Recording & Streaming Pro" spec.
 *
 * Dropped entirely: live streaming to Twitch/YouTube/RTMP/Discord — RTMP is not a protocol a
 * browser or Electron renderer can speak natively, and the pasted spec's own
 * connectTwitch/connectYouTube/connectRTMP/connectDiscord methods are empty function bodies
 * that do nothing. Building real streaming would mean bundling an RTMP muxer and testing
 * against real accounts/stream keys — the same class of "needs external infrastructure this
 * session can't stand up or verify" as real-time collaboration. Also dropped: MP4/MOV/MKV
 * encoding (Chromium's MediaRecorder can only mux WebM — MP4 needs ffmpeg.wasm, ~30MB, a
 * size/complexity tradeoff for the user to decide, not something to fake), a managed "session
 * library" with thumbnails/favorites/its own persistence layer (out of proportion to what a
 * record-preview-export workflow needs), live chat (depends on the dropped streaming feature),
 * and CPU/memory/disk-speed "performance monitoring" (not meaningfully readable from a
 * renderer process, and the pasted code never actually measured any of it — it only ever
 * simulated progress with Math.random()).
 *
 * What's real and kept: recording the live, fully-composited canvas (not a single layer's
 * raw <canvas>, which is what naively calling document.querySelector('canvas') would grab)
 * to a real WebM file via MediaRecorder, an optional microphone track, an optional text
 * watermark, and turning the result into a sped-up timelapse or a trimmed clip by re-playing
 * and re-capturing it — the same real, working technique throughout, no placeholder Blobs.
 */

export type RecordingStatus = 'idle' | 'recording' | 'paused' | 'processing';

export interface WatermarkSettings {
  enabled: boolean;
  text: string;
  opacity: number;
}
