import { DEFAULT_STAMP, type StampData } from "./stamp";

export type Preset = { id: string; name: string; data: StampData };

const CURRENT_KEY = "stampnote:current";
const PRESETS_KEY = "stampnote:presets";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function loadCurrent(): StampData {
  // ngày giờ không nhớ giữa các lần mở: mặc định luôn là thời điểm hiện tại
  return { ...DEFAULT_STAMP, ...read<Partial<StampData>>(CURRENT_KEY, {}), datetime: "" };
}

export function saveCurrent(data: StampData) {
  localStorage.setItem(CURRENT_KEY, JSON.stringify(data));
}

export function loadPresets(): Preset[] {
  return read<Preset[]>(PRESETS_KEY, []).map((p) => ({ ...p, data: { ...DEFAULT_STAMP, ...p.data } }));
}

export function savePresets(list: Preset[]) {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(list));
}
