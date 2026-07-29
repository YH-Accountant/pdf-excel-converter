import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkAmountConsistency, toAmount } from '../lib/amountConsistency.ts'

test('정상 세금계산서는 통과한다', () => {
  const r = checkAmountConsistency('taxInvoice', {
    supplyValue: 19_800_000,
    taxAmount: 1_980_000,
    totalAmount: 21_780_000,
  })
  assert.equal(r.ok, true)
})

test('★ 영세율(세액 0)도 검산한다 — 0을 없는 값으로 취급하지 않는다', () => {
  // 0을 falsy로 판정하면 정작 검산이 가장 필요한 문서를 건너뛰게 된다
  const ok = checkAmountConsistency('taxInvoice', {
    supplyValue: 45_800_000,
    taxAmount: 0,
    totalAmount: 45_800_000,
  })
  assert.equal(ok.ok, true, '0 + 공급가액 = 합계이므로 통과해야 함')

  // 같은 영세율 문서에서 세액만 지어낸 경우는 걸려야 한다
  const bad = checkAmountConsistency('taxInvoice', {
    supplyValue: 45_800_000,
    taxAmount: 4_580_000, // 공급가액의 10%를 계산해 채운 값
    totalAmount: 45_800_000, // 합계는 원문대로
  })
  assert.equal(bad.ok, false)
  assert.match(bad.reason!, /합계금액이 맞지 않습니다/)
  assert.match(bad.reason!, /50,380,000/)
})

test('원 단위 절사된 세액도 정확히 맞으면 통과한다', () => {
  // 공급가액의 10%가 1,234,566.x라 절사된 경우
  const r = checkAmountConsistency('taxInvoice', {
    supplyValue: 1_234_566,
    taxAmount: 123_456,
    totalAmount: 1_358_022,
  })
  assert.equal(r.ok, true)
})

test('합계가 어긋나면 어떤 값으로 판단했는지 함께 알린다', () => {
  const r = checkAmountConsistency('taxInvoice', {
    supplyValue: 10_000_000,
    taxAmount: 1_000_000,
    totalAmount: 10_000_000,
  })
  assert.equal(r.ok, false)
  assert.match(r.reason!, /10,000,000/)
  assert.match(r.reason!, /1,000,000/)
  assert.match(r.reason!, /11,000,000/)
})

test('★ 세액이 버려져 검산 못 한 경우에도 알린다 — 조용히 넘어가지 않는다', () => {
  // 근거 검증이 지어낸 세액을 null로 만든 상황.
  // 조용히 넘어가면 함께 지어냈을 수 있는 합계가 그대로 통과한다.
  const r = checkAmountConsistency('taxInvoice', {
    supplyValue: 45_800_000,
    taxAmount: null,
    totalAmount: 50_380_000,
  })
  assert.equal(r.ok, false)
  assert.match(r.reason!, /세액을\(를\) 확인할 수 없어/)
  assert.match(r.reason!, /50,380,000/)
})

test('공급가액과 세액이 모두 없으면 둘 다 사유에 적는다', () => {
  const r = checkAmountConsistency('taxInvoice', {
    supplyValue: null,
    taxAmount: null,
    totalAmount: 21_780_000,
  })
  assert.equal(r.ok, false)
  assert.match(r.reason!, /공급가액·세액/)
})

test('합계가 없는 서식은 조용히 통과한다 — 합계를 인쇄하지 않는 문서가 있다', () => {
  const r = checkAmountConsistency('taxInvoice', {
    supplyValue: 19_800_000,
    taxAmount: 1_980_000,
    totalAmount: null,
  })
  assert.equal(r.ok, true)
})

test('문자열로 온 금액도 정규화해서 검산한다', () => {
  const r = checkAmountConsistency('taxInvoice', {
    supplyValue: '19,800,000',
    taxAmount: '1,980,000',
    totalAmount: '21,780,000원',
  })
  assert.equal(r.ok, true)
})

test('검산 대상이 아닌 유형은 통과한다', () => {
  assert.equal(checkAmountConsistency('contract', { contractAmount: '금오천만원정' }).ok, true)
  assert.equal(checkAmountConsistency('payroll', { totalGrossPay: 1 }).ok, true)
})

test('toAmount: 0과 null을 구분한다', () => {
  assert.equal(toAmount(0), 0)
  assert.equal(toAmount('0'), 0)
  assert.equal(toAmount(null), null)
  assert.equal(toAmount(undefined), null)
  assert.equal(toAmount(''), null)
  assert.equal(toAmount('없음'), null)
  assert.equal(toAmount(NaN), null)
  assert.equal(toAmount('1,980,000'), 1_980_000)
})
