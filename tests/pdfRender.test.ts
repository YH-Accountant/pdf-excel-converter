import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computePdfRenderScale } from '../lib/pdfRender.ts'

// A4 (595 × 842 pt) — 표준 스캔본. 기존 scale=3(≈216 DPI)를 유지해야 함
test('A4는 기존 scale=3 수준(≈2.97, 216 DPI)을 유지', () => {
  const scale = computePdfRenderScale(595, 842)
  assert.ok(scale > 2.9 && scale <= 3.0, `A4 scale=${scale} — 3.0 근처여야 함`)
})

test('페이지 크기가 큰 PDF는 상한 아래로 축소되어 메모리 방어', () => {
  // 긴 변 2000pt짜리 대형 페이지 → 2500/2000 = 1.25 → 하한 1.5로 클램프
  const scale = computePdfRenderScale(1400, 2000)
  assert.equal(scale, 1.5)
})

test('아주 작은 영수증 페이지는 상한(3.0)까지 확대', () => {
  // 긴 변 400pt 작은 페이지 → 2500/400 = 6.25 → 상한 3.0으로 클램프
  const scale = computePdfRenderScale(280, 400)
  assert.equal(scale, 3.0)
})

test('스케일은 항상 [1.5, 3.0] 범위 안', () => {
  for (const [w, h] of [[100, 100], [5000, 7000], [842, 595], [1200, 1600]]) {
    const s = computePdfRenderScale(w, h)
    assert.ok(s >= 1.5 && s <= 3.0, `${w}x${h} → ${s}`)
  }
})

test('비정상 입력(0)은 상한으로 안전 처리', () => {
  assert.equal(computePdfRenderScale(0, 0), 3.0)
})
