import { test } from 'node:test'
import assert from 'node:assert/strict'
import { koreanToNumber, numberToKorean, validateAndCorrectAmount, validateAmountFields } from '../lib/amountUtils.ts'

test('koreanToNumber: 단순 금액', () => {
  assert.equal(koreanToNumber('오백만원'), 5_000_000)
  assert.equal(koreanToNumber('오천만원'), 50_000_000)
  assert.equal(koreanToNumber('일억원'), 100_000_000)
  assert.equal(koreanToNumber('육십억원'), 6_000_000_000)
  assert.equal(koreanToNumber('만원'), 10_000)
  assert.equal(koreanToNumber('백만원'), 1_000_000)
  assert.equal(koreanToNumber('천만원'), 10_000_000)
})

test('koreanToNumber: 자릿수가 섞인 복합 금액', () => {
  assert.equal(koreanToNumber('이천육백사십만원'), 26_400_000)
  assert.equal(koreanToNumber('천오십만원'), 10_500_000)
  assert.equal(koreanToNumber('일천오십만원'), 10_500_000)
  assert.equal(koreanToNumber('삼천오백만원'), 35_000_000)
  assert.equal(koreanToNumber('일천이백만원'), 12_000_000)
  assert.equal(koreanToNumber('십일만원'), 110_000)
  assert.equal(koreanToNumber('이천육백사십만오천원'), 26_405_000)
  assert.equal(koreanToNumber('구백구십구만구천구백구십구원'), 9_999_999)
})

test('koreanToNumber: 억/조 단위 복합 금액', () => {
  assert.equal(koreanToNumber('일억이천만원'), 120_000_000)
  assert.equal(koreanToNumber('일조이천억원'), 1_200_000_000_000)
  assert.equal(koreanToNumber('삼억삼천삼백삼십삼만삼천삼백삼십삼원'), 333_333_333)
})

test('numberToKorean → koreanToNumber 왕복 변환', () => {
  const samples = [
    26_400_000, 10_500_000, 5_000_000, 6_000_000_000,
    120_000_000, 9_999_999, 110_000, 1_234_567_890_123,
  ]
  for (const n of samples) {
    assert.equal(koreanToNumber(numberToKorean(n)), n, `왕복 실패: ${n} → ${numberToKorean(n)}`)
  }
})

test('validateAndCorrectAmount: 한글-숫자 병기 금액을 훼손하지 않음', () => {
  assert.equal(
    validateAndCorrectAmount('이천육백사십만원(26,400,000원, VAT 포함)'),
    '이천육백사십만원(26,400,000원, VAT 포함)'
  )
  assert.equal(
    validateAndCorrectAmount('오백만원(5,000,000원, VAT 별도)'),
    '오백만원(5,000,000원, VAT 별도)'
  )
})

test('validateAndCorrectAmount: 한글-숫자 불일치 시 한글 기준으로 교정', () => {
  assert.equal(
    validateAndCorrectAmount('오백만원(4,500,000원)'),
    '오백만원(5,000,000원)'
  )
})

test('validateAndCorrectAmount: "일금 ~ 정" 관용구의 일금을 금액으로 오인하지 않음', () => {
  assert.equal(
    validateAndCorrectAmount('일금 오백만원정'),
    '오백만원정(5,000,000원)'
  )
  assert.equal(
    validateAndCorrectAmount('일금 삼천오백만원정 (₩35,000,000)'),
    '삼천오백만원정(35,000,000원)'
  )
  // "일금 일천만원": 일금 제거 후에도 진짜 금액의 "일"은 정상 파싱
  assert.equal(
    validateAndCorrectAmount('일금 일천만원정'),
    '일천만원정(10,000,000원)'
  )
})

test('validateAmountFields: 여러 품목 단가(unitPrice)는 교정하지 않고 원본 유지', () => {
  const result = validateAmountFields({
    unitPrice: '품목A: 15,000, 품목B: 2,000,000',
    totalAmount: '이천만원(20,000,000원)',
  })
  assert.equal(result.unitPrice, '품목A: 15,000, 품목B: 2,000,000')
  assert.equal(result.totalAmount, '이천만원(20,000,000원)')
})
