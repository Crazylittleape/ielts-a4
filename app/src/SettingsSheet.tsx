import { X } from 'lucide-react';
import type { Density, GroupPick, Settings } from './lib';
import { WallpaperSettings, type useWallpaper } from './Wallpaper';
import { inputCls, ModalDialog, primaryBtn, Segmented } from './ui';

const DENSITY_OPTIONS: { key: Density; label: string }[] = [
  { key: 'relaxed', label: '轻松' },
  { key: 'standard', label: '标准' },
  { key: 'intense', label: '强化' }
];

export function SettingsSheet({ settings, dailyGroups, onSetDailyGroups, onSaveSettings, wallpaper, onClose }: {
  settings: Settings;
  dailyGroups: number;
  onSetDailyGroups: (count: number) => void;
  onSaveSettings: (patch: Partial<Settings>) => Promise<boolean>;
  wallpaper: ReturnType<typeof useWallpaper>;
  onClose: () => void;
}) {
  return <ModalDialog
    labelledBy="settings-sheet-title"
    onClose={onClose}
    backdropClassName="fixed inset-0 z-[100] flex items-end bg-scrim sm:items-center sm:p-4"
    dialogClassName="sheet-up mx-auto max-h-[calc(100dvh-1rem)] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-sm border border-rule border-t-2 border-t-accent bg-sheet px-5 pb-8 pt-4 shadow-paper sm:rounded-sm"
  >
    <div className="flex items-center justify-between gap-3">
      <h2 id="settings-sheet-title" className="font-serif text-xl font-bold text-ink">学习与外观设置</h2>
      <button type="button" aria-label="关闭学习与外观设置" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border border-rule bg-paper text-ink-soft transition-colors hover:bg-paper-2 hover:text-ink" onClick={onClose}><X size={18} /></button>
    </div>
    <div className="mt-5 space-y-6">
      <section aria-labelledby="settings-daily-groups-title" className="space-y-2">
        <h3 id="settings-daily-groups-title" className="font-serif text-base font-bold text-ink">每日学习组数</h3>
        <select aria-labelledby="settings-daily-groups-title" aria-label="每日学习组数" className={inputCls} value={dailyGroups} onChange={event => onSetDailyGroups(Number(event.target.value))}>{Array.from({ length: 10 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1} 组 · 通常 {(index + 1) * 25} 词</option>)}</select>
      </section>
      <section aria-labelledby="pick-label" className="space-y-2">
        <h3 id="pick-label" className="font-serif text-base font-bold text-ink">组完成页的默认选择</h3>
        <div role="group" aria-labelledby="pick-label"><Segmented options={[{ key: 'missed' as GroupPick, label: '本组错词' }, { key: 'all' as GroupPick, label: '本组全部单词' }]} value={settings.groupPick ?? 'missed'} onChange={pick => void onSaveSettings({ groupPick: pick })} /></div>
        <p className="text-xs text-ink-soft">组完成页会把这个选项放在最前面，点按后才会加入。</p>
      </section>
      <section aria-labelledby="density-label" className="space-y-2">
        <h3 id="density-label" className="font-serif text-base font-bold text-ink">复习密度</h3>
        <div role="group" aria-labelledby="density-label"><Segmented options={DENSITY_OPTIONS} value={settings.density ?? 'standard'} onChange={density => void onSaveSettings({ density })} /></div>
        <p className="text-xs leading-relaxed text-ink-soft">越密集，间隔越短、每日任务通常越多。保存后用于之后的每次评分，已经排好的日期不变。</p>
      </section>
      <section aria-labelledby="settings-wallpaper-title" className="space-y-2">
        <h3 id="settings-wallpaper-title" className="font-serif text-base font-bold text-ink">外观（壁纸）</h3>
        <WallpaperSettings {...wallpaper} />
      </section>
    </div>
    <button type="button" className={`${primaryBtn} mt-6 w-full`} onClick={onClose}>完成</button>
  </ModalDialog>;
}
