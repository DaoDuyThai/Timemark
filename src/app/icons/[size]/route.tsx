import { readFile } from "node:fs/promises";
import path from "node:path";

export function generateStaticParams() {
  return [{ size: "192" }, { size: "512" }];
}

// Keep the original URLs working for previously installed PWA versions.
export async function GET(_req: Request, ctx: { params: Promise<{ size: string }> }) {
  const { size } = await ctx.params;
  const px = size === "512" ? 512 : 192;
  const image = await readFile(path.join(process.cwd(), "public", "icons", `logo-${px}.png`));
  return new Response(new Uint8Array(image), {
    headers: { "Content-Type": "image/png" },
  });
}
