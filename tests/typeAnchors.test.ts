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

test('한 글자 앵커를 쓰지 않아 평범한 조사에 걸리지 않는다', () => {
  // "도착하였음을"의 '을'이 계약서 단서로 잡히면 안 된다
  const 물품확인서 = '물품 확인서 ... 상기 물품이 이상 없이 도착하였음을 확인합니다'
  const r = checkTypeAnchors('contract', 물품확인서)
  assert.equal(r.ok, false, '계약서 단서가 없어야 함')
  assert.deepEqual(r.found, [])
})

test('자간을 벌린 항목명도 단서로 인식한다 — 기 본 급', () => {
  // 한국 서식은 제목·항목명을 띄어 쓰는 일이 흔하고 OCR도 공백을 끼워 넣는다
  const r = checkTypeAnchors('payroll', '급 여 대 장   귀속연월 2025년 01월   기 본 급   차인지급액')
  assert.equal(r.ok, true)
  assert.ok(r.found.includes('기본급'), '띄어쓴 항목명을 찾아야 함')
})

// ─── 앵커의 배타성 ───────────────────────────────────────────
// 다른 유형에도 흔한 단어를 앵커로 두면, 유형이 완전히 틀렸을 때도
// 그 단어 하나로 검증을 통과한다. 실제로 발견된 사례를 회귀 테스트로 고정한다.

const 급여대장 = `
급여대장   귀속연월 2025년 01월   지급일 2025-01-25
사번 성명 기본급 수당 지급총액 소득세 지방소득세 공제계 차인지급액
1001 홍길동 3,000,000 500,000 3,500,000 120,000 12,000 260,000 3,108,000
합계 8명 24,950,330   실지급액 22,180,000
`

const 원천징수신고서 = `
원천징수이행상황신고서   징수의무자 (주)가상물산
귀속연월 2025년 01월   지급연월 2025년 02월
소득구분 근로소득  간이세액 A01  인원 8  총지급액 24,950,330  소득세 등 873,220
`

test('★ 급여대장을 원천징수신고서로 오분류하면 잡아낸다', () => {
  // 급여대장에도 "귀속연월"이 인쇄되어 있어, 이것이 앵커였을 때는
  // 유형이 틀려도 그 단어 하나로 통과했다.
  const r = checkTypeAnchors('withholdingTax', 급여대장)
  assert.equal(r.ok, false)
  assert.deepEqual(r.found, [], '원천징수 고유 단서는 하나도 없어야 한다')
  assert.match(r.reason!, /payroll 단서가 나타납니다/)
})

test('원천징수신고서를 급여대장으로 오분류해도 잡아낸다', () => {
  const r = checkTypeAnchors('payroll', 원천징수신고서)
  assert.equal(r.ok, false)
  assert.deepEqual(r.found, [])
})

test('두 문서 모두 제 유형으로는 통과한다 — 오탐 방지', () => {
  assert.equal(checkTypeAnchors('payroll', 급여대장).ok, true)
  assert.equal(checkTypeAnchors('withholdingTax', 원천징수신고서).ok, true)
})

test('견적서를 계약서로 오분류하면 잡아낸다', () => {
  // "귀중"이 계약서 앵커가 아니고, 날인란 "(인)"도 앵커가 아니어야 걸린다
  const r = checkTypeAnchors('contract', 견적서)
  assert.equal(r.ok, false)
})

test('거래명세서를 세금계산서로 오분류하면 잡아낸다', () => {
  // 거래명세서에도 "공급가액" 칸이 있어, 이것이 앵커였을 때는 통과했다
  const r = checkTypeAnchors('taxInvoice', 거래명세서)
  assert.equal(r.ok, false)
  assert.deepEqual(r.found, [])
})

test('앵커에 서로 다른 유형이 공유하는 단어가 없다', () => {
  // 두 유형의 앵커 목록에 같은 단어가 있으면 그 단어는 배타적이지 않다
  const seen = new Map<string, string>()
  for (const [type, anchors] of Object.entries(TYPE_ANCHORS)) {
    for (const a of anchors) {
      const prev = seen.get(a)
      assert.equal(prev, undefined, `"${a}"가 ${prev}와 ${type}에 중복 정의됨`)
      seen.set(a, type)
    }
  }
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
