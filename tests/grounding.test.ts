import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  GROUNDED_AMOUNT_FIELDS,
  extractNumberTokens,
  groundAmountFields,
} from '../lib/grounding.ts'

// 실제 발생 사례를 축약한 원문: 원천징수이행상황신고서에는 지방소득세 칸이 없다
const WITHHOLDING_TEXT = `
원천징수이행상황신고서
귀속연월 2025년 01월  지급연월 2025년 02월
간이세액 A01  인원 8  총지급액 24,950,330  소득세 등 873,220
가감계 A10  8  24,950,330  873,220
`

test('원문에 없는 지방소득세(소득세의 10% 추정값)는 null로 버린다', () => {
  const { fields, dropped } = groundAmountFields(
    'withholdingTax',
    { totalPayment: 24950330, incomeTax: 873220, localIncomeTax: 87280 },
    WITHHOLDING_TEXT
  )
  assert.equal(fields.localIncomeTax, null)
  assert.deepEqual(dropped, [{ field: 'localIncomeTax', value: '87280' }])
})

test('원문에 실제로 있는 값은 그대로 통과한다', () => {
  const { fields, dropped } = groundAmountFields(
    'withholdingTax',
    { totalPayment: 24950330, incomeTax: 873220 },
    WITHHOLDING_TEXT
  )
  assert.equal(fields.totalPayment, 24950330)
  assert.equal(fields.incomeTax, 873220)
  assert.equal(dropped.length, 0)
})

test('원문의 콤마 표기와 추출값의 숫자 표기를 같은 값으로 취급한다', () => {
  // 원문 "24,950,330" ↔ 추출값 24950330
  const { dropped } = groundAmountFields(
    'withholdingTax',
    { totalPayment: 24950330 },
    '총지급액 24,950,330'
  )
  assert.equal(dropped.length, 0)
})

test('추출값이 "873,220" 같은 문자열이어도 정규화해서 대조한다', () => {
  const { fields, dropped } = groundAmountFields(
    'withholdingTax',
    { incomeTax: '873,220' },
    WITHHOLDING_TEXT
  )
  assert.equal(fields.incomeTax, '873,220')
  assert.equal(dropped.length, 0)
})

test('검증 대상이 아닌 필드는 원문에 없어도 건드리지 않는다', () => {
  // numberOfPeople은 짧은 숫자라 대상에서 제외 — 값이 유지되어야 한다
  const { fields } = groundAmountFields(
    'withholdingTax',
    { numberOfPeople: 999 },
    WITHHOLDING_TEXT
  )
  assert.equal(fields.numberOfPeople, 999)
})

test('검증 대상이 아닌 문서 유형은 그대로 통과한다', () => {
  const { fields, dropped } = groundAmountFields(
    'contract',
    { contractAmount: '금일천만원정' },
    '계약서 원문'
  )
  assert.equal(fields.contractAmount, '금일천만원정')
  assert.equal(dropped.length, 0)
})

test('1,000원 미만의 값은 우연히 일치할 확률이 높아 검증하지 않는다', () => {
  const { dropped } = groundAmountFields(
    'withholdingTax',
    { incomeTax: 999 },
    '아무 숫자도 없는 원문'
  )
  assert.equal(dropped.length, 0)
})

test('null·비금액 값은 검증을 건너뛴다', () => {
  const { fields, dropped } = groundAmountFields(
    'withholdingTax',
    { totalPayment: null, incomeTax: '알 수 없음' },
    WITHHOLDING_TEXT
  )
  assert.equal(fields.totalPayment, null)
  assert.equal(fields.incomeTax, '알 수 없음')
  assert.equal(dropped.length, 0)
})

test('세금계산서: 공급가액·세액은 검증 대상, 합계금액은 계산 허용이라 제외', () => {
  assert.deepEqual(GROUNDED_AMOUNT_FIELDS.taxInvoice, ['supplyValue', 'taxAmount'])
  const { fields, dropped } = groundAmountFields(
    'taxInvoice',
    { supplyValue: 10000000, taxAmount: 1000000, totalAmount: 11000000 },
    '공급가액 10,000,000 세액 1,000,000' // 합계는 원문에 없음
  )
  assert.equal(fields.supplyValue, 10000000)
  assert.equal(fields.totalAmount, 11000000) // 원문에 없어도 유지
  assert.equal(dropped.length, 0)
})

test('토큰 단위 대조: 인접한 숫자가 이어 붙어 우연히 통과하지 않는다', () => {
  // "8"과 "7,280"이 나란히 있어도 "87280"으로 합쳐 읽지 않는다
  const tokens = extractNumberTokens('인원 8 7,280')
  assert.equal(tokens.has('87280'), false)
  assert.equal(tokens.has('8'), true)
  assert.equal(tokens.has('7280'), true)
})

test('부분 문자열로는 통과하지 않는다 — 정확히 같은 숫자여야 한다', () => {
  // 원문에 873,220이 있어도 73220이나 8732200은 근거가 아니다
  const { dropped } = groundAmountFields(
    'withholdingTax',
    { incomeTax: 73220 },
    WITHHOLDING_TEXT
  )
  assert.deepEqual(dropped, [{ field: 'incomeTax', value: '73220' }])
})
