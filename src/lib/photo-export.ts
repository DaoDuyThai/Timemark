/** Rasterize the already laid-out overlay without SVG foreignObject (Safari). */
export async function paintOverlay(
  ctx: CanvasRenderingContext2D,
  frame: HTMLElement,
  outputWidth: number,
) {
  const overlay = frame.querySelector<HTMLElement>(".stamp-overlay");
  if (!overlay) return;
  const origin = frame.getBoundingClientRect();
  const scale = outputWidth / origin.width;
  ctx.save();
  ctx.scale(scale, scale);

  const card = overlay.querySelector<HTMLElement>(".stamp-card");
  if (card) {
    const box = card.getBoundingClientRect();
    const x = box.left - origin.left;
    const y = box.top - origin.top;
    const gradient = ctx.createLinearGradient(x, y, x + box.width, y);
    gradient.addColorStop(0, "rgba(142,145,143,.52)");
    gradient.addColorStop(0.34, "rgba(142,145,143,.42)");
    gradient.addColorStop(0.45, "rgba(142,145,143,.14)");
    gradient.addColorStop(0.5, "rgba(142,145,143,0)");
    gradient.addColorStop(1, "rgba(142,145,143,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(x, y, box.width, box.height, parseFloat(getComputedStyle(card).borderRadius));
    ctx.fill();
  }

  const separator = overlay.querySelector<HTMLElement>(".stamp-separator");
  if (separator) {
    const box = separator.getBoundingClientRect();
    ctx.fillStyle = getComputedStyle(separator).backgroundColor;
    ctx.fillRect(box.left - origin.left, box.top - origin.top, box.width, box.height);
  }

  const walker = document.createTreeWalker(overlay, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const parent = node.parentElement;
    const value = node.textContent || "";
    if (!parent || !value.trim() || parent.closest("svg")) continue;
    const style = getComputedStyle(parent);
    const fontSize = parseFloat(style.fontSize);
    ctx.font = `${style.fontStyle} ${style.fontWeight} ${fontSize}px ${style.fontFamily}`;
    ctx.fillStyle = style.color;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    ctx.shadowColor = "rgba(0,0,0,.55)";
    ctx.shadowBlur = origin.width * 0.0015;
    ctx.shadowOffsetY = origin.width * 0.001;
    const range = document.createRange();

    // Vertical labels are one unbroken line, rotated with their container.
    if (parent.closest(".stamp-vertical")) {
      range.selectNodeContents(node);
      const box = range.getBoundingClientRect();
      const metrics = ctx.measureText(value);
      const ascent = metrics.fontBoundingBoxAscent ?? fontSize * 0.8;
      const descent = metrics.fontBoundingBoxDescent ?? fontSize * 0.2;
      ctx.save();
      ctx.translate(box.left - origin.left + box.width / 2, box.top - origin.top + box.height / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.scale(box.height / Math.max(1, metrics.width), 1);
      ctx.fillText(value, -metrics.width / 2, (ascent - descent) / 2);
      ctx.restore();
      continue;
    }

    // Group characters by their actual wrapped line, preserving CSS line breaks.
    const lines: { text: string; left: number; top: number; right: number; height: number }[] = [];
    for (let index = 0; index < value.length; index++) {
      range.setStart(node, index);
      range.setEnd(node, index + 1);
      const box = range.getBoundingClientRect();
      if (!box.height || !box.width || value[index] === "\n") continue;
      const previous = lines.at(-1);
      if (previous && Math.abs(previous.top - box.top) < 1) {
        previous.text += value[index];
        previous.right = Math.max(previous.right, box.right);
      } else {
        lines.push({ text: value[index], left: box.left, top: box.top, right: box.right, height: box.height });
      }
    }
    ctx.save();
    const note = parent.closest(".stamp-note");
    if (note) {
      const box = note.getBoundingClientRect();
      ctx.beginPath();
      ctx.rect(box.left - origin.left, box.top - origin.top, box.width, box.height);
      ctx.clip();
    }
    for (const line of lines) {
      const metrics = ctx.measureText(line.text);
      const ascent = metrics.fontBoundingBoxAscent ?? fontSize * 0.8;
      const descent = metrics.fontBoundingBoxDescent ?? fontSize * 0.2;
      const baseline = line.top - origin.top + (line.height - ascent - descent) / 2 + ascent;
      ctx.save();
      ctx.translate(line.left - origin.left, baseline);
      ctx.scale((line.right - line.left) / Math.max(1, metrics.width), 1);
      ctx.fillText(line.text, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  const shield = overlay.querySelector<SVGSVGElement>(".stamp-vertical svg");
  if (shield) {
    const box = shield.getBoundingClientRect();
    const svg = shield.cloneNode(true) as SVGSVGElement;
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    svg.setAttribute("color", "white");
    svg.setAttribute("width", "24");
    svg.setAttribute("height", "24");
    svg.removeAttribute("class");
    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
    await image.decode();
    ctx.save();
    ctx.translate(box.left - origin.left + box.width / 2, box.top - origin.top + box.height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.drawImage(image, -box.height / 2, -box.width / 2, box.height, box.width);
    ctx.restore();
  }
  ctx.restore();
}
