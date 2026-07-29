import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_CANVAS_PIXELS,
  MAX_PAYLOAD_BASE64_BYTES,
  PAYLOAD_FALLBACKS,
  base64ByteLength,
  computeUpscaleFactor,
  exceedsPayloadBudget,
} from '../lib/imagePayload.ts'

test('작은 이미지는 목표 배율(2배)을 그대로 적용한다', () => {
  assert.equal(computeUpscaleFactor(800, 1000), 2)
})

test('200DPI A4(1654×2339)는 2배 확대해도 캔버스 상한 안에 들어온다', () => {
  // 1654×2339×4 = 15.5MP < 16MP → 2배 그대로
  assert.equal(computeUpscaleFactor(1654, 2339), 2)
})

test('큰 이미지는 캔버스 상한에 맞춰 배율이 줄어든다', () => {
  const factor = computeUpscaleFactor(3000, 4000)
  assert.ok(factor < 2, `2배 미만이어야 함 (실제 ${factor})`)
  const pixels = 3000 * factor * (4000 * factor)
  assert.ok(pixels <= MAX_CANVAS_PIXELS + 1, '확대 후 화소가 상한을 넘지 않아야 함')
})

test('이미 상한을 넘는 이미지는 확대하지 않는다(배율 1 이하)', () => {
  assert.ok(computeUpscaleFactor(5000, 7000) < 1)
})

test('잘못된 크기는 안전값 1을 돌려준다', () => {
  assert.equal(computeUpscaleFactor(0, 1000), 1)
  assert.equal(computeUpscaleFactor(NaN, 1000), 1)
  assert.equal(computeUpscaleFactor(-100, -100), 1)
})

test('base64 길이에서 실제 바이트 수를 계산한다', () => {
  // "abc"(3바이트) → "YWJj"(4글자, 패딩 없음)
  assert.equal(base64ByteLength('YWJj'), 3)
  // "ab"(2바이트) → "YWI="(패딩 1개)
  assert.equal(base64ByteLength('YWI='), 2)
  // "a"(1바이트) → "YQ=="(패딩 2개)
  assert.equal(base64ByteLength('YQ=='), 1)
  assert.equal(base64ByteLength(''), 0)
})

test('전송 예산 경계를 정확히 판정한다', () => {
  // 패딩 없는 base64 4글자 = 3바이트이므로, 예산 바이트 수에 맞춰 길이를 만든다
  const exact = 'A'.repeat(Math.ceil((MAX_PAYLOAD_BASE64_BYTES * 4) / 3))
  assert.equal(exceedsPayloadBudget(exact.slice(0, -4)), false, '예산 이하는 통과')
  assert.equal(exceedsPayloadBudget(exact + 'AAAA'), true, '예산 초과는 걸러짐')
})

test('폴백 단계는 품질·해상도가 단조 감소한다', () => {
  for (let i = 1; i < PAYLOAD_FALLBACKS.length; i++) {
    const prev = PAYLOAD_FALLBACKS[i - 1]
    const cur = PAYLOAD_FALLBACKS[i]
    const prevCost = prev.quality * prev.scale
    const curCost = cur.quality * cur.scale
    assert.ok(curCost < prevCost, `${i}단계가 이전보다 작아야 함`)
  }
})

test('첫 폴백은 해상도를 줄이지 않는다 — 화질 손실을 최소화한다', () => {
  assert.equal(PAYLOAD_FALLBACKS[0].scale, 1)
})
