import fs from 'node:fs';
import path from 'node:path';

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function nowId(prefix = 'run') {
  return `${prefix}-${new Date().toISOString().replace(/[:.]/g, '-')}`;
}

export function truncate(value, max = 120000) {
  const text = String(value ?? '');
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n...[truncated ${text.length - max} chars]`;
}

export function ensureInside(root, candidate, label = 'path') {
  const rootAbs = path.resolve(root);
  const abs = path.resolve(rootAbs, candidate);
  const rel = path.relative(rootAbs, abs);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`${label} escapes workspace: ${candidate}`);
  }
  return abs;
}

export function interpolate(value, vars) {
  if (typeof value === 'string') {
    return value.replace(/\{([a-zA-Z0-9_]+)\}/g, (m, key) => key in vars ? String(vars[key]) : m);
  }
  if (Array.isArray(value)) return value.map((v) => interpolate(v, vars));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, interpolate(v, vars)]));
  }
  return value;
}

export function envValue(name, required = true) {
  if (!name) return undefined;
  const value = process.env[name];
  if (required && !value) throw new Error(`Required environment variable ${name} is not set`);
  return value;
}

export function mergeShallow(...values) {
  return Object.assign({}, ...values.filter(Boolean));
}

export function safeSlug(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

export function pathExists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}
