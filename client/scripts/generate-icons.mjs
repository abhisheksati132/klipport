import sharp from "sharp";
import { readFileSync } from "node:fs";

const svg = readFileSync("public/logo.svg");

const sizes = [
  { size: 192, name: "public/icon-192.png", padding: 0 },
  { size: 512, name: "public/icon-512.png", padding: 0 },
  { size: 512, name: "public/icon-maskable-512.png", padding: 51 }
];

for (const { size, name, padding } of sizes) {
  const inner = size - padding * 2;
  await sharp(svg)
    .resize(inner, inner)
    .extend({
      top: padding,
      bottom: padding,
      left: padding,
      right: padding,
      background: { r: 11, g: 12, b: 16, alpha: 1 }
    })
    .png()
    .toFile(name);
  console.log(`generated ${name}`);
}
