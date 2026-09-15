interface ReencodeOptions {
  speed: number; // playback-rate multiplier — 1 = unchanged, 4 = quarter the length
  startSec?: number;
  endSec?: number;
}

/** Turns a recorded WebM into a sped-up timelapse or a trimmed clip by literally re-playing it
 * (at `speed` and within [startSec, endSec]) and re-capturing that playback via
 * HTMLMediaElement.captureStream() + MediaRecorder. There's no ffmpeg here to cut/re-encode
 * the container directly, but genuinely playing it back faster and recording that IS a real,
 * shorter output file — not a player-side trick that only "looks" fast in this app. */
export async function reencodeRecording(sourceBlob: Blob, options: ReencodeOptions): Promise<Blob> {
  const url = URL.createObjectURL(sourceBlob);
  const video = document.createElement('video') as HTMLVideoElement & { captureStream(): MediaStream };
  video.src = url;
  video.muted = false;
  video.volume = 0; // avoid audible double-playback while re-encoding; captureStream still gets the real track

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('No se pudo leer el video grabado'));
    });

    const start = Math.max(0, options.startSec ?? 0);
    const end = Math.min(video.duration, options.endSec ?? video.duration);
    if (end <= start) throw new Error('El rango seleccionado está vacío');

    video.currentTime = start;
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
    });

    const stream = video.captureStream();
    const mimeCandidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? 'video/webm';
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    const stopped = new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
    });

    video.playbackRate = Math.max(0.25, Math.min(16, options.speed));
    recorder.start(200);
    await new Promise((r) => setTimeout(r, 100));

    await video.play();
    await new Promise<void>((resolve) => {
      const onTimeUpdate = () => {
        if (video.currentTime >= end || video.ended) {
          video.removeEventListener('timeupdate', onTimeUpdate);
          resolve();
        }
      };
      video.addEventListener('timeupdate', onTimeUpdate);
    });
    video.pause();

    await new Promise((r) => setTimeout(r, 150));
    recorder.stop();
    return await stopped;
  } finally {
    URL.revokeObjectURL(url);
  }
}
