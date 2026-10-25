import Dexie, { type Table } from 'dexie';
import { useEffect, useRef, useState } from 'react';
import { ghostBtn, softBtn } from './ui';

// Appearance is device-local and separate from learning snapshots and JSON backups.
const appearance = new Dexie('ielts-a4-appearance');
appearance.version(1).stores({ images: 'id' });
const images: Table<{ id: string; data: ArrayBuffer }> = appearance.table('images');

async function prepareImage(file: File): Promise<Blob> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('请选择 JPG、PNG 或 WebP 图片');
  if (file.size > 10 * 1024 * 1024) throw new Error('图片不能超过 10 MB');
  const source = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = source;
    try { await image.decode(); } catch { throw new Error('图片无法读取，请换一张图片'); }
    if (image.naturalWidth * image.naturalHeight > 40_000_000) throw new Error('图片分辨率过大，请先缩小图片');
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('浏览器无法处理图片');
    context.fillStyle = '#FAF6EF';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82));
    if (!blob || blob.size > 2 * 1024 * 1024) throw new Error('图片压缩失败，请换一张较小的图片');
    return blob;
  } finally { URL.revokeObjectURL(source); }
}

export function useWallpaper() {
  const [image, setImage] = useState<Blob | null>(null);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const saving = useRef(false);
  useEffect(() => {
    let mounted = true;
    images.get('wallpaper').then(row => { if (mounted) setImage(row ? new Blob([row.data], { type: 'image/jpeg' }) : null); })
      .catch(() => { if (mounted) setError('读取壁纸失败，可重新选择图片。学习记录不受影响。'); })
      .finally(() => { if (mounted) setBusy(false); });
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    const next = image ? URL.createObjectURL(image) : '';
    setUrl(next);
    return () => { if (next) URL.revokeObjectURL(next); };
  }, [image]);
  const change = async (file: File | null) => {
    if (busy || saving.current) return;
    saving.current = true;
    setBusy(true);
    setError('');
    try {
      const next = file ? await prepareImage(file) : null;
      if (next) await images.put({ id: 'wallpaper', data: await next.arrayBuffer() });
      else await images.delete('wallpaper');
      setImage(next);
    } catch (e) {
      setError(e instanceof Error && e.name === 'QuotaExceededError' ? '空间不足，壁纸未保存，请释放空间后重试' : `壁纸未保存：${e instanceof Error ? e.message : '请稍后重试'}`);
    } finally { saving.current = false; setBusy(false); }
  };
  return { url, busy, error, change };
}

export function WallpaperSettings({ url, busy, error, change }: ReturnType<typeof useWallpaper>) {
  const fileRef = useRef<HTMLInputElement>(null);
  return <details className="rounded-3xl bg-white p-4 shadow-card">
    <summary className="min-h-11 cursor-pointer py-3 text-sm font-bold">外观设置</summary>
    <div className="space-y-3 pt-2">
      <p className="text-xs leading-relaxed text-ink-soft">用自己的图片作为壁纸。仅存本机，不会上传，也不包含在学习备份中。</p>
      {url && <img src={url} alt="当前壁纸预览" className="h-28 w-full rounded-xl object-cover" />}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} className={softBtn} onClick={() => fileRef.current?.click()}>上传壁纸</button>
        <button type="button" disabled={busy || !url} className={ghostBtn} onClick={() => void change(null)}>恢复默认背景</button>
      </div>
      <input ref={fileRef} type="file" aria-label="选择壁纸图片" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={event => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (file) void change(file);
      }} />
      <p role="status" className="text-xs text-ink-soft">{busy ? '正在处理壁纸…' : url ? '壁纸已保存，离线也可使用' : '当前使用默认背景'} · JPG / PNG / WebP，最多 10 MB</p>
      {error && <p role="alert" className="text-xs text-ink">{error}</p>}
    </div>
  </details>;
}
