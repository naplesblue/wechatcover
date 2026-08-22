/**
 * 出图 provider 测试 — node --test tests/image_providers.test.mjs
 *
 * 只测纯函数（尺寸换算 / provider 注册），不打网络。
 * toArkSize 的门槛数字来自火山实测：低于 3,686,400 像素会被 InvalidParameter 拒绝。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { listProviders, toArkSize } from '../lib/image_providers.mjs';

const MIN_PIXELS = 3686400;
const parse = (s) => s.split('x').map(Number);

test('provider 注册表包含三家后端', () => {
  const list = listProviders();
  for (const p of ['openai', 'qwen', 'ark']) assert.ok(list.includes(p), `缺 ${p}`);
});

test('小于门槛的尺寸 → 放大到达标，且长宽都是 16 的倍数', () => {
  for (const input of ['1920x816', '1600x680', '1024x1024', '800x600', '2400x1024']) {
    const [w, h] = parse(toArkSize(input));
    assert.ok(w * h >= MIN_PIXELS, `${input} → ${w}x${h} 仅 ${w * h} 像素，未达 ${MIN_PIXELS}`);
    assert.equal(w % 16, 0, `${input} → 宽 ${w} 不是 16 的倍数`);
    assert.equal(h % 16, 0, `${input} → 高 ${h} 不是 16 的倍数`);
  }
});

test('放大后长宽比偏差 < 1%（封面比例不能被拉变形）', () => {
  for (const input of ['1920x816', '1600x680', '2400x1024']) {
    const [ow, oh] = parse(input);
    const [w, h] = parse(toArkSize(input));
    const drift = Math.abs((w / h) / (ow / oh) - 1);
    assert.ok(drift < 0.01, `${input} → ${w}x${h} 比例偏差 ${(drift * 100).toFixed(2)}%`);
  }
});

test('已达标的尺寸原样返回，不做多余放大', () => {
  assert.equal(toArkSize('3008x1280'), '3008x1280');
});

// Seedream 计费实测为 token = 像素/256，放过头就是白烧钱：
// 只放大到刚好越过门槛即可，别用固定系数一把梭
test('放大幅度贴着门槛，不超出 25%', () => {
  for (const input of ['1920x816', '1600x680', '800x600']) {
    const [w, h] = parse(toArkSize(input));
    const over = (w * h) / MIN_PIXELS - 1;
    assert.ok(over <= 0.25, `${input} → ${w}x${h}，比门槛多 ${(over * 100).toFixed(1)}% 像素（等于多付这么多 token）`);
  }
});

test('无法解析的尺寸 → 回落到已知可用的默认值', () => {
  for (const bad of ['', null, undefined, 'auto', '1920', 'axb']) {
    const [w, h] = parse(toArkSize(bad));
    assert.ok(w * h >= MIN_PIXELS, `${JSON.stringify(bad)} 的回落值不达标`);
  }
});

test('星号写法（qwen 风格）也能吃', () => {
  assert.equal(toArkSize('3008*1280'), '3008x1280');
});

test('ARK_IMAGE_SIZE 环境变量可强制覆盖', () => {
  const saved = process.env.ARK_IMAGE_SIZE;
  process.env.ARK_IMAGE_SIZE = '4096x1744';
  try {
    assert.equal(toArkSize('1920x816'), '4096x1744', '覆盖应优先于自动换算');
  } finally {
    if (saved === undefined) delete process.env.ARK_IMAGE_SIZE; else process.env.ARK_IMAGE_SIZE = saved;
  }
});
