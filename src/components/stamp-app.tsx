"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BarChart3,
  Camera,
  Clock,
  Download,
  FileText,
  ImagePlus,
  Images,
  LoaderCircle,
  LocateFixed,
  MapPin,
  Menu,
  Pencil,
  RefreshCcw,
  Save,
  ScanLine,
  Share2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  Video,
  ZapOff,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  ACCENTS,
  createTimemarkId,
  DEFAULT_STAMP,
  drawStamp,
  ensureStampFont,
  resolveDate,
  toLocalInput,
  type StampData,
  type StampRect,
} from "@/lib/stamp";
import { loadCurrent, loadPresets, saveCurrent, savePresets, type Preset } from "@/lib/storage";

const MAX_SIDE = 2560;

export function StampApp() {
  const [data, setData] = useState<StampData>(DEFAULT_STAMP);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [nowStr, setNowStr] = useState("");
  const [locating, setLocating] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rectRef = useRef<StampRect | null>(null);
  const hydrated = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const dataRef = useRef(data);
  const [cam, setCam] = useState<"idle" | "live" | "failed">("idle");
  const [facing, setFacing] = useState<"environment" | "user">("environment");

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error("Thiết bị không hỗ trợ lấy vị trí");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const fallback = `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`;
        try {
          const query = new URLSearchParams({
            format: "jsonv2",
            lat: String(coords.latitude),
            lon: String(coords.longitude),
            zoom: "18",
            "accept-language": "vi",
          });
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${query}`);
          if (!response.ok) throw new Error("reverse geocoding failed");
          const result = (await response.json()) as { display_name?: string };
          setData((current) => ({ ...current, address: result.display_name || fallback }));
          toast.success("Đã cập nhật vị trí hiện tại");
        } catch {
          setData((current) => ({ ...current, address: fallback }));
          toast.info("Đã lấy tọa độ; bạn có thể sửa địa chỉ thủ công");
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        toast.error("Không lấy được vị trí. Hãy cấp quyền vị trí hoặc nhập thủ công.");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  }, []);

  // nạp dữ liệu đã lưu
  /* eslint-disable react-hooks/set-state-in-effect -- đọc localStorage sau khi hydrate */
  useEffect(() => {
    setData({ ...loadCurrent(), imageId: createTimemarkId() });
    setPresets(loadPresets());
    setNowStr(toLocalInput(new Date()));
    hydrated.current = true;
    ensureStampFont().then(() => setReady(true));
    locate();
  }, [locate]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // tự lưu lần nhập gần nhất
  useEffect(() => {
    if (hydrated.current) saveCurrent(data);
  }, [data]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCam("idle");
  }, []);

  const startCamera = useCallback(async (mode: "environment" | "user") => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (!navigator.mediaDevices?.getUserMedia) {
      setCam("failed");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      const v = videoRef.current!;
      v.srcObject = stream;
      await v.play();
      setCam("live");
    } catch {
      setCam("failed");
    }
  }, []);

  // vừa vào app là mở camera
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    startCamera("environment");
    return () => streamRef.current?.getTracks().forEach((t) => t.stop());
  }, [startCamera]);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // vẽ khung hình camera + thẻ ghi chú liên tục
  useEffect(() => {
    if (cam !== "live" || img) return;
    let raf = 0;
    const loop = () => {
      const c = canvasRef.current;
      const v = videoRef.current;
      if (c && v && v.videoWidth) {
        const scale = Math.min(1, MAX_SIDE / Math.max(v.videoWidth, v.videoHeight));
        const w = Math.round(v.videoWidth * scale);
        const h = Math.round(v.videoHeight * scale);
        if (c.width !== w || c.height !== h) {
          c.width = w;
          c.height = h;
        }
        const ctx = c.getContext("2d")!;
        ctx.drawImage(v, 0, 0, w, h);
        rectRef.current = drawStamp(ctx, w, h, dataRef.current, resolveDate(dataRef.current));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [cam, img]);

  function capture() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const scale = Math.min(1, MAX_SIDE / Math.max(v.videoWidth, v.videoHeight));
    const t = document.createElement("canvas");
    t.width = Math.round(v.videoWidth * scale);
    t.height = Math.round(v.videoHeight * scale);
    t.getContext("2d")!.drawImage(v, 0, 0, t.width, t.height);
    t.toBlob(
      (b) => {
        if (!b) return;
        const im = new Image();
        im.onload = () => {
          setImg(im);
          setData((current) => ({ ...current, imageId: createTimemarkId() }));
          stopCamera();
        };
        im.src = URL.createObjectURL(b);
      },
      "image/jpeg",
      0.95,
    );
  }

  function retake() {
    setImg(null);
    setData((current) => ({ ...current, imageId: createTimemarkId() }));
    startCamera(facing);
  }

  function flip() {
    const next = facing === "environment" ? "user" : "environment";
    setFacing(next);
    startCamera(next);
  }

  const render = useCallback(() => {
    const c = canvasRef.current;
    if (!c || !img) return;
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0, w, h);
    rectRef.current = drawStamp(ctx, w, h, data, resolveDate(data));
  }, [img, data]);

  useEffect(() => {
    render();
  }, [render, ready]);

  function onFile(file?: File | null) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      setImg(im);
      stopCamera();
      // ngày giờ điền sẵn: nếu chưa có thì lấy thời điểm hiện tại
      setData((d) => ({
        ...d,
        datetime: d.datetime || toLocalInput(new Date()),
        imageId: createTimemarkId(),
      }));
    };
    im.onerror = () => toast.error("Không đọc được ảnh");
    im.src = url;
  }

  function onCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const c = canvasRef.current;
    const r = rectRef.current;
    if (!c || !r) return;
    const b = c.getBoundingClientRect();
    const x = ((e.clientX - b.left) / b.width) * c.width;
    const y = ((e.clientY - b.top) / b.height) * c.height;
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) setOpen(true);
  }

  function toBlob(): Promise<Blob | null> {
    return new Promise((res) => canvasRef.current?.toBlob(res, "image/jpeg", 0.92));
  }

  async function download() {
    const b = await toBlob();
    if (!b) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b);
    a.download = `stampnote-${Date.now()}.jpg`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("Đã lưu ảnh");
  }

  async function share() {
    const b = await toBlob();
    if (!b) return;
    const file = new File([b], `stampnote-${Date.now()}.jpg`, { type: "image/jpeg" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
      } catch {
        /* người dùng huỷ */
      }
    } else {
      download();
    }
  }

  const set = <K extends keyof StampData>(k: K, v: StampData[K]) => setData((d) => ({ ...d, [k]: v }));

  function savePreset() {
    const name = presetName.trim() || data.title.trim() || `Mẫu ${presets.length + 1}`;
    const next = [...presets, { id: crypto.randomUUID(), name, data }];
    setPresets(next);
    savePresets(next);
    setPresetName("");
    toast.success(`Đã lưu mẫu "${name}"`);
  }

  function removePreset(id: string) {
    const next = presets.filter((p) => p.id !== id);
    setPresets(next);
    savePresets(next);
  }

  return (
    <main className="relative mx-auto flex h-svh w-full max-w-[540px] flex-col overflow-hidden bg-white text-[#171717] shadow-2xl shadow-black/25">
      <header className="z-20 flex h-[76px] shrink-0 items-center justify-between gap-2 border-b border-black/5 bg-white px-4 text-black">
        <button type="button" className="grid size-11 place-items-center" aria-label="Mở menu"><Menu className="size-8" strokeWidth={2.2} /></button>
        <button type="button" className="grid size-11 place-items-center" onClick={flip} aria-label="Đổi camera"><ZapOff className="size-8" strokeWidth={2} /></button>
        <button type="button" className="flex h-11 items-center gap-2 rounded-full border-2 border-black/65 px-4 text-[15px] font-semibold" onClick={() => setOpen(true)}>
          <ShieldCheck className="size-6" /> Xác thực ảnh
        </button>
        <button type="button" className="flex h-11 items-center gap-1 rounded-full bg-[#222] px-4 text-[17px] font-semibold text-white">
          <Sparkles className="size-5 fill-[#eafa57] text-[#eafa57]" /> Plus
        </button>
        <button type="button" className="grid size-11 place-items-center" aria-label="Quét"><ScanLine className="size-8" /></button>
      </header>

      <video ref={videoRef} playsInline muted className="hidden" />

      {!img && cam === "live" ? (
        <>
          <section className="relative min-h-0 flex-1 overflow-hidden bg-black">
            <canvas
              ref={canvasRef}
              onClick={onCanvasClick}
              className="h-full w-full cursor-pointer bg-black object-contain"
              aria-label="Camera. Chạm vào thẻ để chỉnh sửa."
            />
            <div className="absolute bottom-5 right-4 grid gap-4 text-white">
              <button type="button" className="grid size-12 place-items-center rounded-full border-2 border-white bg-black/20 text-sm font-medium shadow" aria-label="Mức thu phóng">1.0x</button>
              <button type="button" onClick={() => setOpen(true)} className="grid size-12 place-items-center rounded-2xl bg-black/20" aria-label="Sửa thông tin"><Pencil className="size-8" /></button>
              <button type="button" onClick={locate} className="grid size-12 place-items-center rounded-full bg-black/20" aria-label="Lấy vị trí"><MapPin className="size-9" /></button>
            </div>
          </section>

          <div className="shrink-0 bg-white px-4 pb-[max(.65rem,env(safe-area-inset-bottom))] pt-3 text-black">
            <button type="button" className="mb-3 flex h-12 w-full items-center justify-center gap-3 rounded-2xl bg-[#d9efff] text-[18px] font-medium text-[#06346f]">
              Không gian đội nhóm <span aria-hidden>→</span>
            </button>
            <div className="grid grid-cols-3 items-center px-4">
              <label className="flex cursor-pointer flex-col items-center gap-1 text-xs text-black/60">
                <input type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
                <span className="grid size-12 place-items-center rounded-xl border-2 border-black"><Images className="size-7" /></span>
                Thư viện
              </label>
              <button type="button" onClick={capture} aria-label="Chụp" className="mx-auto size-[78px] rounded-full border-[8px] border-black bg-white shadow-inner transition active:scale-95" />
              <button type="button" onClick={() => setOpen(true)} className="flex flex-col items-center gap-1 text-xs text-black/60">
                <span className="grid size-12 place-items-center rounded-xl border-2 border-black"><FileText className="size-7" /></span>
                Bản mẫu
              </button>
            </div>
            <nav className="mt-3 grid grid-cols-5 text-[11px] text-black/45" aria-label="Điều hướng chính">
              <span className="flex flex-col items-center gap-0.5"><BarChart3 className="size-4" />Báo cáo</span>
              <span className="flex flex-col items-center gap-0.5"><Video className="size-4" />Video</span>
              <span className="flex flex-col items-center gap-0.5 font-semibold text-black"><Camera className="size-4" />Ảnh</span>
              <span className="flex flex-col items-center gap-0.5"><Clock className="size-4" />Chấm công</span>
              <span className="flex flex-col items-center gap-0.5"><Users className="size-4" />Danh sách</span>
            </nav>
          </div>
        </>
      ) : !img ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-[#101010] px-8 text-center text-white">
          <p className="text-sm text-white/60">
            {cam === "failed"
              ? "Không mở được camera trực tiếp (cần HTTPS hoặc quyền camera). Dùng chụp bằng máy ảnh hệ thống:"
              : "Đang mở camera…"}
          </p>
          <Button variant="outline" className="w-full" onClick={() => startCamera(facing)}>
            <RefreshCcw /> Thử mở camera lại
          </Button>
          <label className="w-full">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            <span className="inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#ffbf00] px-4 text-sm font-semibold text-black">
              <Camera /> Chụp ảnh
            </span>
          </label>
          <label className="w-full">
            <input type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
            <span className="inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-sm font-medium">
              <ImagePlus /> Chọn từ thư viện
            </span>
          </label>
          <Button variant="ghost" onClick={() => setOpen(true)}>
            <Pencil /> Soạn thông tin trước
          </Button>
        </div>
      ) : (
        <>
          <section className="flex min-h-0 flex-1 items-center overflow-hidden bg-black">
            <canvas
              ref={canvasRef}
              onClick={onCanvasClick}
              className="max-h-full w-full cursor-pointer bg-black object-contain"
              aria-label="Ảnh đã đóng dấu. Chạm vào thẻ để chỉnh sửa."
            />
          </section>
          <p className="shrink-0 px-4 py-1.5 text-center text-xs text-black/45">
            Chạm vào thẻ trên ảnh để sửa ngày giờ và nội dung
          </p>
          <div className="grid shrink-0 grid-cols-2 gap-2 bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button onClick={download} size="lg" className="bg-[#ffbf00] font-semibold text-black hover:bg-[#ffd04a]">
              <Download /> Lưu ảnh
            </Button>
            <Button onClick={share} size="lg" variant="secondary">
              <Share2 /> Chia sẻ
            </Button>
            <Button onClick={retake} variant="outline">
              <Camera /> Chụp lại
            </Button>
            <Button onClick={() => setOpen(true)} variant="outline" className="col-span-2">
              <Pencil /> Chỉnh sửa thông tin
            </Button>
          </div>
        </>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="mx-auto max-h-[88vh] max-w-[540px] overflow-y-auto rounded-t-3xl border-white/10 bg-[#151515] p-4 text-white">
          <SheetHeader className="p-0">
            <SheetTitle>Thông tin trên ảnh</SheetTitle>
            <SheetDescription>Tự lưu trên máy, lần sau mở lại vẫn còn.</SheetDescription>
          </SheetHeader>

          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="dt">Ngày giờ</Label>
              <div className="flex gap-2">
                <Input
                  id="dt"
                  type="datetime-local"
                  value={data.datetime || nowStr}
                  onChange={(e) => set("datetime", e.target.value)}
                />
                <Button variant="outline" onClick={() => set("datetime", toLocalInput(new Date()))}>
                  <Clock /> Bây giờ
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Điền sẵn giờ hiện tại, bạn có thể sửa trước khi lưu.
              </p>
              <button type="button" className="w-fit text-xs text-teal-400 underline" onClick={() => set("datetime", "")}>
                Xoá (luôn dùng giờ hiện tại)
              </button>
            </div>

            <div className="grid gap-1.5">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="addr">Địa chỉ hiện tại</Label>
                <Button type="button" variant="outline" size="sm" onClick={locate} disabled={locating}>
                  {locating ? <LoaderCircle className="animate-spin" /> : <LocateFixed />}
                  {locating ? "Đang lấy…" : "Lấy lại GPS"}
                </Button>
              </div>
              <Textarea
                id="addr"
                rows={2}
                placeholder={locating ? "Đang xác định vị trí…" : "Nhập địa chỉ hoặc bấm Lấy lại GPS"}
                value={data.address}
                onChange={(e) => set("address", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Tự lấy khi mở ứng dụng và vẫn có thể sửa tay. Dữ liệu địa chỉ: © OpenStreetMap contributors.</p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="note">Ghi chú một dòng</Label>
              <Input
                id="note"
                placeholder="Ví dụ: Họ tên: Đào Duy Thái"
                value={data.note}
                onChange={(e) => set("note", e.target.value.replace(/[\r\n]+/g, " "))}
              />
              <p className="text-xs text-muted-foreground">Nội dung dài sẽ tự thu nhỏ để luôn nằm trên một dòng.</p>
            </div>

            <div className="grid gap-1.5">
              <Label>Màu nhấn & vị trí</Label>
              <div className="flex items-center gap-2">
                {ACCENTS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Màu ${c}`}
                    onClick={() => set("accent", c)}
                    className="size-7 rounded-full border-2"
                    style={{ background: c, borderColor: data.accent === c ? "white" : "transparent" }}
                  />
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto"
                  onClick={() => set("position", data.position === "bottom" ? "top" : "bottom")}
                >
                  {data.position === "bottom" ? "Đang ở dưới" : "Đang ở trên"}
                </Button>
              </div>
            </div>

            <div className="grid gap-2 rounded-xl border p-3">
              <Label>Mẫu đã lưu</Label>
              {presets.length === 0 && <p className="text-xs text-muted-foreground">Chưa có mẫu nào.</p>}
              {presets.map((p) => (
                <div key={p.id} className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    className="flex-1 justify-start truncate"
                    onClick={() => {
                      setData({ ...p.data, imageId: createTimemarkId() });
                      toast.success(`Đã áp dụng "${p.name}"`);
                    }}
                  >
                    {p.name}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => removePreset(p.id)} aria-label="Xoá mẫu">
                    <Trash2 />
                  </Button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input placeholder="Tên mẫu" value={presetName} onChange={(e) => setPresetName(e.target.value)} />
                <Button onClick={savePreset}>
                  <Save /> Lưu mẫu
                </Button>
              </div>
            </div>

            <Button size="lg" onClick={() => setOpen(false)}>
              Xong
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </main>
  );
}
