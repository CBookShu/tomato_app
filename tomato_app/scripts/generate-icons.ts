#!/usr/bin/env node
/**
 * 生成 macOS Template Image 托盘图标
 *
 * Template Image 规范：
 * - 黑色轮廓 + alpha 通道
 * - 文件名以 Template 结尾
 * - 系统自动适配深浅主题
 */

import { PNG } from 'pngjs';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '..', 'resources', 'icons');

// 确保目录存在
if (!existsSync(iconsDir)) {
  mkdirSync(iconsDir, { recursive: true });
}

/**
 * 绘制番茄形状图标（黑色轮廓 + alpha）
 */
function drawTomatoIcon(size: number, withPlay: boolean = false): PNG {
  const png = new PNG({ width: size, height: size });

  const centerX = size / 2;
  const centerY = size / 2;
  const radius = size * 0.35;
  const outlineWidth = Math.max(1, size * 0.06);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = x - centerX;
      const dy = y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // 绘制黑色轮廓
      if (dist <= radius + outlineWidth && dist >= radius - outlineWidth) {
        png.data[idx] = 0;     // R
        png.data[idx + 1] = 0; // G
        png.data[idx + 2] = 0; // B
        png.data[idx + 3] = 255; // A
      }

      // 绘制番茄茎
      const stemTop = centerY - radius - outlineWidth;
      const stemWidth = size * 0.12;
      const stemHeight = size * 0.15;
      if (y < stemTop + stemHeight && y > stemTop - outlineWidth) {
        if (Math.abs(x - centerX) < stemWidth) {
          png.data[idx] = 0;
          png.data[idx + 1] = 0;
          png.data[idx + 2] = 0;
          png.data[idx + 3] = 255;
        }
      }
    }
  }

  // 如果需要播放符号（专注中状态）
  if (withPlay) {
    const playSize = size * 0.3;
    const playX = centerX - playSize * 0.3;
    const playY = centerY - playSize * 0.5;

    // 绘制播放三角形
    for (let y = 0; y < playSize; y++) {
      const width = (y / playSize) * playSize * 0.8;
      for (let x = 0; x < width; x++) {
        const px = Math.floor(playX + x);
        const py = Math.floor(playY + y);
        if (px >= 0 && px < size && py >= 0 && py < size) {
          const idx = (py * size + px) * 4;
          png.data[idx] = 0;
          png.data[idx + 1] = 0;
          png.data[idx + 2] = 0;
          png.data[idx + 3] = 255;
        }
      }
    }
  }

  return png;
}

/**
 * 绘制暂停图标（番茄轮廓 + 两条竖线）
 */
function drawPausedIcon(size: number): PNG {
  const png = drawTomatoIcon(size, false);

  const centerX = size / 2;
  const centerY = size / 2;
  const barWidth = size * 0.12;
  const barHeight = size * 0.3;
  const barSpacing = size * 0.08;

  // 绘制两条暂停竖线
  for (let i = 0; i < 2; i++) {
    const barX = centerX - barWidth - barSpacing / 2 + i * (barWidth + barSpacing);
    for (let y = centerY - barHeight / 2; y < centerY + barHeight / 2; y++) {
      for (let x = barX; x < barX + barWidth; x++) {
        if (x >= 0 && x < size && y >= 0 && y < size) {
          const idx = (y * size + x) * 4;
          png.data[idx] = 0;
          png.data[idx + 1] = 0;
          png.data[idx + 2] = 0;
          png.data[idx + 3] = 255;
        }
      }
    }
  }

  return png;
}

/**
 * 绘制叶子图标（休息状态）
 */
function drawLeafIcon(size: number): PNG {
  const png = new PNG({ width: size, height: size });

  const centerX = size / 2;
  const centerY = size / 2;
  const outlineWidth = Math.max(1, size * 0.06);

  // 绘制圆形（代表番茄）
  const radius = size * 0.35;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = x - centerX;
      const dy = y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= radius + outlineWidth && dist >= radius - outlineWidth) {
        png.data[idx] = 0;
        png.data[idx + 1] = 0;
        png.data[idx + 2] = 0;
        png.data[idx + 3] = 255;
      }
    }
  }

  // 绘制叶子标记（V形）
  const leafSize = size * 0.2;
  const leafY = centerY;

  for (let i = 0; i < leafSize; i++) {
    const angle = (i / leafSize) * Math.PI * 0.5;
    const offsetLeft = Math.cos(angle) * leafSize;
    const offsetDown = Math.sin(angle) * leafSize;

    // 左分支
    const lx = Math.floor(centerX - offsetLeft);
    const ly = Math.floor(leafY + offsetDown);
    if (lx >= 0 && lx < size && ly >= 0 && ly < size) {
      const idx = (ly * size + lx) * 4;
      png.data[idx] = 0;
      png.data[idx + 1] = 0;
      png.data[idx + 2] = 0;
      png.data[idx + 3] = 255;
    }

    // 右分支
    const rx = Math.floor(centerX + offsetLeft);
    if (rx >= 0 && rx < size && ly >= 0 && ly < size) {
      const idx = (ly * size + rx) * 4;
      png.data[idx] = 0;
      png.data[idx + 1] = 0;
      png.data[idx + 2] = 0;
      png.data[idx + 3] = 255;
    }
  }

  return png;
}

/**
 * 生成图标对（常规 + Retina）
 */
function generateIconPair(name: string, drawFn: (size: number) => PNG) {
  // 16x16 常规版本
  const normal = drawFn(16);
  const normalPath = join(iconsDir, `${name}Template.png`);
  writeFileSync(normalPath, PNG.sync.write(normal));
  console.log(`✓ ${name}Template.png (16x16)`);

  // 32x32 Retina 版本
  const retina = drawFn(32);
  const retinaPath = join(iconsDir, `${name}Template@2x.png`);
  writeFileSync(retinaPath, PNG.sync.write(retina));
  console.log(`✓ ${name}Template@2x.png (32x32)`);
}

// 生成所有图标
console.log('生成托盘图标...\n');

generateIconPair('idle', (size) => drawTomatoIcon(size, false));
generateIconPair('working', (size) => drawTomatoIcon(size, true));
generateIconPair('paused', (size) => drawPausedIcon(size));
generateIconPair('breaking', (size) => drawLeafIcon(size));

console.log('\n图标生成完成！');
console.log(`位置: ${iconsDir}`);
