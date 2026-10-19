import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');

test('the game has the main player-focused screens and actions', () => {
  for (const label of ['選手一覧', 'スカウト候補', '選手育成', '試合', 'パス', 'ドリブル', 'シュート', '必殺シュート', 'タックル']) {
    assert.ok(html.includes(label), 'missing UI label: ' + label);
  }
  for (const fn of ['startMatch', 'action', 'finishMatch', 'scout', 'train', 'actTraining', 'save', 'load', 'normalize']) {
    assert.match(script, new RegExp('function\\s+' + fn + '\\s*\\('), 'missing function: ' + fn);
  }
});

test('match controls support pointer dragging and keep players inside the pitch', () => {
  assert.match(script, /addEventListener\('pointerdown'/);
  assert.match(script, /addEventListener\('pointermove'/);
  assert.match(script, /setPointerCapture/);
  assert.match(script, /Math\.max\(\.04,Math\.min\(\.96/);
  assert.match(html, /touch-action\s*:\s*none/i);
});

test('match actions have situation checks and ability-based success rates', () => {
  assert.match(script, /m\.gauge<35/);
  assert.match(script, /dist>range/);
  assert.match(script, /p\.pass-50/);
  assert.match(script, /p\.shoot-45/);
  assert.match(script, /p\.def-owner\.atk/);
});

test('match completion records history and awards player experience', () => {
  assert.match(script, /s\.history\.unshift/);
  assert.match(script, /p\.apps\+\+/);
  assert.match(script, /p\.exp\+=18/);
  assert.match(script, /localStorage\.setItem\(STORE2/);
});

test('legacy saves are normalized and club-facility screens are absent', () => {
  assert.match(script, /function\s+normalize\s*\(/);
  assert.doesNotMatch(html, /クラブ施設の建設|クラブタウンのマップ|スポンサー契約画面/);
  assert.doesNotMatch(html, /data-action="[^"]*(?:facility|sponsor|town)[^"]*"/i);
});
