export type StampData = {
  /** "" = dùng thời điểm hiện tại; ngược lại dạng "YYYY-MM-DDTHH:mm" */
  datetime: string;
  address: string;
  title: string;
  name: string;
  note: string;
  imageId: string;
  accent: string;
  position: "bottom" | "top";
};

export const DEFAULT_STAMP: StampData = {
  datetime: "",
  address: "",
  title: "Công ty của bạn",
  name: "Nhân viên",
  note: "Họ tên: Nhân viên",
  imageId: "",
  accent: "#ffbf00",
  position: "bottom",
};

export const ACCENTS = ["#ffbf00", "#ff7a00", "#39a9ff", "#ef4444", "#a855f7", "#ffffff"];

const ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function createTimemarkId() {
  const bytes = new Uint8Array(30);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return `TM${Array.from(bytes, (byte) => ID_ALPHABET[byte % ID_ALPHABET.length]).join("")}`;
}

const WEEKDAYS = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

const pad = (n: number) => String(n).padStart(2, "0");

export function toLocalInput(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function resolveDate(data: StampData, now = new Date()) {
  if (!data.datetime) return now;
  const d = new Date(data.datetime);
  return isNaN(d.getTime()) ? now : d;
}

export function formatParts(d: Date) {
  return {
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    date: `${pad(d.getDate())} Tháng ${pad(d.getMonth() + 1)},${d.getFullYear()}`,
    weekday: WEEKDAYS[d.getDay()],
  };
}

let cachedFamily = "";
export function stampFontFamily() {
  if (cachedFamily) return cachedFamily;
  if (typeof window === "undefined") return "sans-serif";
  const v = getComputedStyle(document.documentElement).getPropertyValue("--font-stamp").trim();
  cachedFamily = v || "sans-serif";
  return cachedFamily;
}

export async function ensureStampFont() {
  const f = stampFontFamily();
  try {
    await Promise.all([
      document.fonts.load(`400 120px ${f}`, "13:57"),
      document.fonts.load(`700 40px ${f}`, "0123456789:ĐđÂâ"),
      document.fonts.load(`500 20px ${f}`, "Tháng Thứ Hà Nội"),
      document.fonts.load(`400 20px ${f}`, "Địa chỉ"),
    ]);
  } catch {
    /* ignore */
  }
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width <= maxW || !line) {
        line = test;
      } else {
        out.push(line);
        line = w;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

export type StampRect = { x: number; y: number; w: number; h: number };

/** Vẽ thẻ ghi chú lên canvas w x h. Trả về vùng của thẻ (để bắt chạm). */
export function drawStamp(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  data: StampData,
  date: Date,
): StampRect {
  const f = stampFontFamily();
  // Cạnh ngắn giữ nguyên tỷ lệ dấu ở cả ảnh dọc lẫn ảnh ngang.
  const s = Math.min(w, h) / 1080;
  const left = 28 * s;
  const right = 28 * s;
  const bottom = 28 * s;
  const contentW = w - left - right;
  const timeSize = 112 * s;
  const dateSize = 34 * s;
  const addressSize = 35 * s;
  const noteSize = 35 * s;
  const logoSize = 32 * s;
  const { time, date: dateStr, weekday } = formatParts(date);

  ctx.save();
  ctx.textBaseline = "alphabetic";
  ctx.lineJoin = "round";
  ctx.shadowColor = "rgba(0,0,0,.78)";
  ctx.shadowBlur = 5 * s;
  ctx.shadowOffsetY = 2 * s;

  ctx.font = `400 ${addressSize}px ${f}`;
  const addressLines = wrap(ctx, data.address.trim(), Math.min(contentW - 18 * s, 940 * s));
  const visibleAddressLines = addressLines.slice(0, 3);
  const addressLineH = 43 * s;
  const cardH = 84 * s;
  let cardY = h - bottom - cardH;
  const addressLastBaseline = cardY - 34 * s;
  const addressFirstBaseline = addressLastBaseline - Math.max(0, visibleAddressLines.length - 1) * addressLineH;
  let top = addressFirstBaseline - 188 * s;

  if (data.position === "top") {
    const shift = 54 * s - top;
    top += shift;
    cardY += shift;
  }

  // Giờ lớn và cột ngày/thứ, đúng tỷ lệ ảnh tham chiếu.
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "rgba(0,0,0,.25)";
  ctx.lineWidth = 1.5 * s;
  ctx.font = `400 ${timeSize}px ${f}`;
  ctx.fillText(time, left, top + 104 * s);

  const timeW = ctx.measureText(time).width;
  const dividerX = left + timeW + 18 * s;
  ctx.shadowColor = "rgba(0,0,0,.35)";
  ctx.fillStyle = data.accent;
  ctx.fillRect(dividerX, top + 7 * s, 5 * s, 110 * s);

  ctx.fillStyle = "#ffffff";
  ctx.font = `400 ${dateSize}px ${f}`;
  const dateX = dividerX + 19 * s;
  ctx.fillText(dateStr, dateX, top + 43 * s);
  ctx.font = `500 ${dateSize}px ${f}`;
  ctx.fillText(weekday, dateX, top + 106 * s);

  // Địa chỉ chính.
  ctx.font = `400 ${addressSize}px ${f}`;
  ctx.fillStyle = "#ffffff";
  visibleAddressLines.forEach((line, index) => {
    ctx.fillText(line, left, addressFirstBaseline + index * addressLineH);
  });

  // Một dòng ghi chú và logo cùng nằm trong thẻ bán trong suốt.
  ctx.shadowColor = "transparent";
  ctx.fillStyle = "rgba(142,145,143,.48)";
  roundRect(ctx, left - 2 * s, cardY, contentW + 4 * s, cardH, 9 * s);
  ctx.fill();

  ctx.shadowColor = "rgba(0,0,0,.72)";
  ctx.shadowBlur = 4 * s;
  ctx.textAlign = "right";
  ctx.font = `600 ${logoSize}px ${f}`;
  const brandY = cardY + 43 * s;
  ctx.fillStyle = data.accent;
  ctx.fillText("Time", w - right - ctx.measureText("mark").width, brandY);
  ctx.fillStyle = "#ffffff";
  ctx.fillText("mark", w - right, brandY);
  ctx.font = `300 ${17 * s}px ${f}`;
  ctx.fillStyle = "rgba(255,255,255,.92)";
  ctx.fillText("Auto generated", w - right, brandY + 22 * s);

  const brandW = 176 * s;
  const note = data.note.trim() || (data.name.trim() ? `Họ tên: ${data.name.trim()}` : "Ghi chú");
  const noteMaxW = Math.max(120 * s, contentW - brandW - 52 * s);
  const fittedNoteSize = fitFontSize(ctx, note, noteMaxW, noteSize, 21 * s, f);
  ctx.textAlign = "left";
  ctx.font = `400 ${fittedNoteSize}px ${f}`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(note, left + 14 * s, cardY + cardH / 2 + fittedNoteSize * 0.34);

  // Mã ảnh dọc ở mép phải.
  const code = data.imageId || `TM${date.getTime().toString(36).toUpperCase()}`;
  ctx.save();
  ctx.translate(w - 12 * s, top + (cardY - top) * 0.48);
  ctx.rotate(-Math.PI / 2);
  ctx.font = `400 ${16 * s}px ${f}`;
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,.96)";
  ctx.fillText(`${code}   Timemark · Auto generated`, 0, 0);
  ctx.restore();
  ctx.restore();

  return { x: left - 2 * s, y: cardY, w: contentW + 4 * s, h: cardH };
}

function fitFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  preferred: number,
  minimum: number,
  family: string,
) {
  ctx.font = `400 ${preferred}px ${family}`;
  const measured = ctx.measureText(text).width;
  if (measured <= maxWidth) return preferred;
  return Math.max(minimum, preferred * (maxWidth / measured));
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
