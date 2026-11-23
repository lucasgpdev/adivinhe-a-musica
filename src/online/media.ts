/** Fotos, figurinhas e áudios do chat — tudo processado no navegador antes de enviar. */

export const MEDIA_MAX = 900 * 1024; // igual ao servidor
export const AUDIO_MAX_SEC = 60;

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((ok, fail) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); ok(img); };
    img.onerror = () => { URL.revokeObjectURL(url); fail(new Error('Não foi possível abrir essa imagem.')); };
    img.src = url;
  });
}

/** Reduz a foto (lado maior até 1280px, JPEG) para caber no limite do chat. */
export async function compressPhoto(file: Blob): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem.');
  const img = await loadImage(file);
  for (const [max, q] of [[1280, 0.8], [1024, 0.7], [800, 0.6], [640, 0.5]] as const) {
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * scale));
    c.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff'; // fundo branco para PNG transparente virar JPEG
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const url = c.toDataURL('image/jpeg', q);
    if (url.length <= MEDIA_MAX) return url;
  }
  throw new Error('Imagem grande demais.');
}

/** Cria uma figurinha quadrada 320×320 (recorte central, fundo transparente quando houver). */
export async function makeSticker(file: Blob): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem.');
  const img = await loadImage(file);
  const size = 320;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d')!;
  const s = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - s) / 2;
  const sy = (img.naturalHeight - s) / 2;
  // cantos arredondados, como as figurinhas do zap
  const r = 36;
  ctx.beginPath();
  ctx.moveTo(r, 0); ctx.arcTo(size, 0, size, size, r); ctx.arcTo(size, size, 0, size, r); ctx.arcTo(0, size, 0, 0, r); ctx.arcTo(0, 0, size, 0, r);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size);
  let url = c.toDataURL('image/webp', 0.85);
  if (!url.startsWith('data:image/webp')) url = c.toDataURL('image/png'); // Safari antigo
  if (url.length > MEDIA_MAX) url = c.toDataURL('image/jpeg', 0.7);
  return url;
}

// ─── Figurinhas salvas ("Minhas figurinhas") ─────────────────

const MY_STICKERS = 'adm:minhas-figurinhas';
export function loadMyStickers(): string[] {
  try { return JSON.parse(localStorage.getItem(MY_STICKERS) ?? '[]'); } catch { return []; }
}
export function saveMyStickers(list: string[]): void {
  try { localStorage.setItem(MY_STICKERS, JSON.stringify(list.slice(0, 30))); } catch { /* armazenamento cheio */ }
}

// ─── Gravação de áudio ───────────────────────────────────────

function pickMime(): string | undefined {
  const opts = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm'];
  return opts.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(m));
}

export function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((ok, fail) => {
    const fr = new FileReader();
    fr.onload = () => ok(String(fr.result));
    fr.onerror = () => fail(fr.error);
    fr.readAsDataURL(b);
  });
}

export interface Recording {
  stop: () => Promise<{ dataUrl: string; durationSec: number } | null>;
  cancel: () => void;
  startedAt: number;
}

/** Começa a gravar o microfone. Para sozinho em 60s. */
export async function startRecording(onAutoStop: () => void): Promise<Recording> {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    throw new Error('Este navegador não grava áudio.');
  }
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    throw new Error('Permita o uso do microfone para mandar áudio.');
  }
  const mimeType = pickMime();
  const rec = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 48000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const startedAt = Date.now();
  rec.start(250);
  const timer = setTimeout(onAutoStop, AUDIO_MAX_SEC * 1000);
  const release = () => { clearTimeout(timer); stream.getTracks().forEach((t) => t.stop()); };
  let cancelled = false;
  return {
    startedAt,
    cancel: () => { cancelled = true; try { rec.stop(); } catch { /* */ } release(); },
    stop: () => new Promise((ok) => {
      rec.onstop = async () => {
        release();
        const durationSec = (Date.now() - startedAt) / 1000;
        if (cancelled || durationSec < 0.6 || !chunks.length) return ok(null);
        const blob = new Blob(chunks, { type: (rec.mimeType || mimeType || 'audio/webm').split(';')[0] });
        let dataUrl = await blobToDataUrl(blob);
        // alguns navegadores geram "audio/webm;codecs=opus" — normaliza para o servidor
        dataUrl = dataUrl.replace(/^data:audio\/x-matroska/, 'data:audio/webm');
        ok(dataUrl.length > MEDIA_MAX ? null : { dataUrl, durationSec: Math.min(AUDIO_MAX_SEC, durationSec) });
      };
      try { rec.stop(); } catch { release(); ok(null); }
    }),
  };
}
