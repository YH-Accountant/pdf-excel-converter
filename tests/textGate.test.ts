import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hasEnoughText, MIN_TEXT_LENGTH } from '../lib/textGate.ts'

// 기준값이 바뀌면 경계 테스트도 함께 검토해야 하므로 상수를 고정 확인
test('MIN_TEXT_LENGTH는 50', () => {
  assert.equal(MIN_TEXT_LENGTH, 50)
})

test('공백 제외 49자는 기준 미달(false)', () => {
  assert.equal(hasEnoughText('a'.repeat(49)), false)
})

test('공백 제외 50자는 기준 충족(true) — 경계 포함', () => {
  assert.equal(hasEnoughText('a'.repeat(50)), true)
})

test('공백 제외 51자는 기준 충족(true)', () => {
  assert.equal(hasEnoughText('a'.repeat(51)), true)
})

test('공백은 글자 수에서 제외 — 공백을 섞어도 실제 글자로만 판정', () => {
  // 실제 글자 50자 + 사이사이 공백/줄바꿈/탭 → 공백 제거 후 50자로 충족
  const spaced = 'a'.repeat(50).split('').join(' \n\t')
  assert.equal(hasEnoughText(spaced), true)
})

test('공백뿐인 문자열은 미달(false)', () => {
  assert.equal(hasEnoughText('   \n\t   '.repeat(20)), false)
})

test('실제 글자 49자 + 공백 다수는 미달(false) — 공백은 채우지 못함', () => {
  const text = 'a'.repeat(49) + ' '.repeat(100)
  assert.equal(hasEnoughText(text), false)
})

test('null / undefined / 빈 문자열은 미달(false)', () => {
  assert.equal(hasEnoughText(null), false)
  assert.equal(hasEnoughText(undefined), false)
  assert.equal(hasEnoughText(''), false)
})

test('한글도 글자 단위로 계산 — 50자면 충족', () => {
  assert.equal(hasEnoughText('가'.repeat(50)), true)
  assert.equal(hasEnoughText('가'.repeat(49)), false)
})
