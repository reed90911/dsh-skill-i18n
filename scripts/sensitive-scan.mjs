#!/usr/bin/env node
/**
 * 敏感信息扫描 —— 在 git init / push / 打包 / 分享目录之前跑一遍。
 *
 * 用法：
 *   node sensitive-scan.mjs [路径...]        目录或单个文件，默认当前目录
 *   node sensitive-scan.mjs --all            额外包含 node_modules 与二进制
 *
 * 退出码：0 = 未发现；1 = 发现疑似敏感信息（用作 git pre-commit 判断）
 *
 * 设计约束：只输出类型、位置与脱敏样例，绝不打印原始敏感值。
 */
import fs from 'node:fs';
import path from 'node:path';

const includeAll = process.argv.includes('--all');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const roots = args.length > 0 ? args : ['.'];

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'cache', '.cache']);
const SKIP_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg', '.pdf', '.zip', '.tgz',
  '.exe', '.dll', '.node', '.asar', '.woff', '.woff2', '.ttf', '.otf', '.mp4', '.mp3',
  '.sqlite', '.sqlite-wal', '.sqlite-shm', '.bin', '.gob', '.pyc', '.zstd', '.zst', '.gz',
]);

const MAX_BYTES = 2 * 1024 * 1024;

/** 命中即为问题的模式 */
const PATTERNS = {
  手机号: /\b1[3-9]\d{9}\b/g,
  邮箱: /\b[A-Za-z0-9._%+-]{2,}@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  'OpenAI 风格 key': /\bsk-[A-Za-z0-9]{20,}\b/g,
  'Google API key': /\bAIza[0-9A-Za-z_-]{30,}\b/g,
  'GitHub token': /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g,
  'Slack token': /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
  私钥文件: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/g,
  'Bearer 令牌': /\bBearer\s+[A-Za-z0-9._-]{20,}/g,
  身份证号: /\b[1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]\b/g,
  '密钥赋值': /\b(?:api[_-]?key|apikey|secret|access[_-]?token|client[_-]?secret|password)\b\s*[:=]\s*["']?([A-Za-z0-9_-]{16,})/gi,
};

const SENSITIVE_NAMES = [/^\.credentials/i, /^\.env/i, /\.private\.md$/i, /credential|secret|token/i];

function mask(v) {
  const s = String(v);
  return s.length <= 6 ? s.slice(0, 2) + '***' : s.slice(0, 3) + '***' + s.slice(-2);
}

let scanned = 0;
const findings = [];
const nameWarnings = [];

/** 扫描单个文件 */
function scanFile(full) {
  const base = full.split(path.sep).pop() || full;
  if (SENSITIVE_NAMES.some((re) => re.test(base))) {
    if (!nameWarnings.includes(full)) nameWarnings.push(full);
  }
  if (!includeAll && SKIP_EXT.has(path.extname(base).toLowerCase())) return;

  let st;
  try {
    st = fs.statSync(full);
  } catch {
    return;
  }
  if (!st.isFile() || st.size > MAX_BYTES || st.size === 0) return;

  let text;
  try {
    text = fs.readFileSync(full, 'utf8');
  } catch {
    return;
  }
  if (text.includes('\u0000')) return;
  scanned++;

  for (const [label, re] of Object.entries(PATTERNS)) {
    re.lastIndex = 0;
    const m = text.match(re);
    if (!m || m.length === 0) continue;
    findings.push({
      file: path.relative(process.cwd(), full) || base,
      type: label,
      count: m.length,
      sample: [...new Set(m.map(mask))].slice(0, 2).join(' , '),
    });
  }
}

function walk(dir, depth = 0) {
  if (depth > 10) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!includeAll && SKIP_DIRS.has(e.name)) continue;
      walk(full, depth + 1);
      continue;
    }
    if (e.isFile()) scanFile(full);
  }
}

for (const r of roots) {
  const abs = path.resolve(r);
  if (!fs.existsSync(abs)) {
    console.log('跳过不存在的路径：' + r);
    continue;
  }
  let st;
  try {
    st = fs.statSync(abs);
  } catch {
    continue;
  }
  // 关键：单个文件也要能扫，否则钩子按文件调用时会静默放行
  if (st.isDirectory()) walk(abs);
  else scanFile(abs);
}

console.log('扫描 ' + scanned + ' 个文本文件，根目录：' + roots.join(', '));

if (findings.length === 0 && nameWarnings.length === 0) {
  console.log('✅ 未发现疑似敏感信息');
  process.exit(0);
}

if (findings.length > 0) {
  console.log('\n⚠ 发现 ' + findings.length + ' 处疑似敏感信息（样例已脱敏）：');
  for (const f of findings) {
    console.log('  [' + f.type + '] ' + f.file + '  x' + f.count + '  ' + f.sample);
  }
}

if (nameWarnings.length > 0) {
  console.log('\n⚠ 以下文件名本身提示敏感，请确认不应提交/分享：');
  for (const f of nameWarnings) console.log('  ' + (path.relative(process.cwd(), f) || f));
}

console.log('\n处置建议：删除、移入 .gitignore，或改为占位符后重试。');
process.exit(1);
