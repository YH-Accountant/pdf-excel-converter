import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CONFUSABLE_PAIRS, TYPE_ANCHORS, checkTypeAnchors } from '../lib/typeAnchors.ts'

const 세금계산서 = `
전자세금계산서
승인번호 20251110-88776655  작성일자 2025-11-10
공급자 주식회사 가상물산 312-81-90123
공급받는자 주식회사 나라전자 108-81-45678
공급가액 19,800,000  세액 1,980,000
`

const 견적서 = `
견 적 서
견적일 2025-11-05   유효기간 견적일로부터 30일
주식회사 나라전자 귀중
견적금액 합계 26,100,000 (VAT 별도)
`

const 거래명세서 = `
거 래 명 세 서
거래일자 2025-11-18   영수 / 청구
공급가액 13,880,000  부가세 1,388,000
인수자 : 박창고     인계자 : 최배송
`

test('단서가 뚜렷하면 통과한다', () => {
  const r = checkTypeAnchors('taxInvoice', 세금계산서)
  assert.equal(r.ok, true)
  assert.ok(r.found.includes('세금계산서'))
})

test('고른 유형의 단서가 없으면 확인 필요 — 어떤 단서를 봤는지 알려준다', () => {
  // 거래명세서를 견적서로 잘못 판별한 경우
  const r = checkTypeAnchors('estimate', 거래명세서)
  assert.equal(r.ok, false)
  assert.match(r.reason!, /estimate 단서가 없고/)
  assert.match(r.reason!, /tradingStatement 단서가 나타납니다/)
  assert.match(r.reason!, /인수자|납품|영수|청구/)
})

test('혼동쌍 상대 단서가 더 많으면 확인 필요 — 양쪽 단서를 모두 보여준다', () => {
  // 견적 성격이 섞인 계약서
  const 혼합 = '용역계약서 제1조 (목적) ... 갑 과 을 ... 유효기간 30일 ... 견적일 2025-11-05 ... 귀중'
  const r = checkTypeAnchors('contract', 혼합)
  assert.equal(r.ok, false)
  assert.match(r.reason!, /contract와 estimate 단서가 함께/)
})

test('혼동쌍이라도 자기 단서가 더 많으면 통과한다', () => {
  const 계약서 = '용역계약서 제1조 제2조 갑 을 기명날인 (인) 계약을 체결한다 ... 유효기간 없음'
  const r = checkTypeAnchors('contract', 계약서)
  assert.equal(r.ok, true)
})

test('견적서는 정상적으로 통과한다 — 혼동쌍 오탐 방지', () => {
  const r = checkTypeAnchors('estimate', 견적서)
  assert.equal(r.ok, true)
})

test('원문이 없으면(이미지 경로) 검사를 건너뛴다', () => {
  assert.equal(checkTypeAnchors('estimate', '').ok, true)
})

test('합본에서 혼동쌍 상대가 함께 감지되면 비교하지 않는다 — 오탐 방지', () => {
  // 계약서+견적서가 한 파일에 들어 있는 합본.
  // 전체 텍스트에는 양쪽 단서가 다 있지만 둘 다 실제로 존재하므로 경고할 이유가 없다.
  const 합본 = '용역계약서 제1조 제2조 갑 을 (인) ... 견 적 서 견적일 유효기간 30일 귀중'
  assert.equal(checkTypeAnchors('estimate', 합본, ['contract', 'estimate']).ok, true)
  assert.equal(checkTypeAnchors('contract', 합본, ['contract', 'estimate']).ok, true)
})

test('상대가 함께 감지되지 않았으면 혼동쌍 비교를 그대로 수행한다', () => {
  const 합본 = '용역계약서 제1조 제2조 갑 을 (인) ... 견적일 유효기간 30일 귀중'
  // estimate 하나만 감지된 상황 → 계약서 단서가 더 많으므로 확인 필요
  assert.equal(checkTypeAnchors('estimate', 합본, ['estimate']).ok, false)
})

test('판정이 실패해도 유형을 바꾸거나 버리지 않는다 — 경고만 반환', () => {
  const r = checkTypeAnchors('estimate', 거래명세서)
  assert.equal(r.ok, false)
  // 결과에 대체 유형을 강제하는 필드가 없다 (자동 교정하지 않음)
  assert.equal('correctedType' in r, false)
})

test('모든 유형에 앵커가 정의되어 있다', () => {
  const types = Object.keys(TYPE_ANCHORS)
  assert.equal(types.length, 7)
  for (const [type, anchors] of Object.entries(TYPE_ANCHORS)) {
    assert.ok(anchors.length > 0, `${type}에 앵커가 없음`)
  }
})

test('혼동쌍의 두 유형은 모두 앵커 목록에 있다', () => {
  for (const [a, b] of CONFUSABLE_PAIRS) {
    assert.ok(TYPE_ANCHORS[a], `${a} 앵커 없음`)
    assert.ok(TYPE_ANCHORS[b], `${b} 앵커 없음`)
  }
})
