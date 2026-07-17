import { test } from 'node:test'
import assert from 'node:assert/strict'
import { matchEmployeesToTransactions } from '../lib/payrollMatching.ts'

test('기본 매칭: 이름이 적요에 포함된 거래와 매칭', () => {
  const result = matchEmployeesToTransactions(
    [{ name: '김철수', netPay: 2_500_000 }],
    [{ description: '급여 김철수', withdrawal: 2_500_000 }]
  )
  assert.equal(result[0].isMatched, true)
  assert.equal(result[0].bankAmount, 2_500_000)
  assert.equal(result[0].isDuplicateName, false)
})

test('동명이인: 금액 기준으로 각자 다른 거래에 배정 (중복 매칭 방지)', () => {
  const result = matchEmployeesToTransactions(
    [
      { name: '홍길동', netPay: 2_800_000 },
      { name: '홍길동', netPay: 3_500_000 },
    ],
    [
      { description: '급여 홍길동', withdrawal: 2_800_000 },
      { description: '급여 홍길동', withdrawal: 3_500_000 },
    ]
  )
  assert.equal(result[0].isMatched, true)
  assert.equal(result[0].bankAmount, 2_800_000)
  assert.equal(result[1].isMatched, true)
  assert.equal(result[1].bankAmount, 3_500_000)
  // 두 사람 모두 동명이인 플래그 → UI에서 "확인 요망" 표시
  assert.equal(result[0].isDuplicateName, true)
  assert.equal(result[1].isDuplicateName, true)
})

test('동명이인: 거래 순서가 금액 순서와 달라도 정확히 배정', () => {
  const result = matchEmployeesToTransactions(
    [
      { name: '홍길동', netPay: 2_800_000 },
      { name: '홍길동', netPay: 3_500_000 },
    ],
    [
      { description: '급여 홍길동', withdrawal: 3_500_000 },
      { description: '급여 홍길동', withdrawal: 2_800_000 },
    ]
  )
  assert.equal(result[0].bankAmount, 2_800_000)
  assert.equal(result[1].bankAmount, 3_500_000)
})

test('동명이인 + 동일 금액: 각자 별도 거래에 배정되어 모두 일치', () => {
  const result = matchEmployeesToTransactions(
    [
      { name: '홍길동', netPay: 3_000_000 },
      { name: '홍길동', netPay: 3_000_000 },
    ],
    [
      { description: '급여 홍길동', withdrawal: 3_000_000 },
      { description: '급여 홍길동', withdrawal: 3_000_000 },
    ]
  )
  assert.equal(result[0].isMatched, true)
  assert.equal(result[1].isMatched, true)
})

test('이체 누락 감지: 직원 2명인데 거래가 1건이면 한 명은 미이체로 표시', () => {
  const result = matchEmployeesToTransactions(
    [
      { name: '홍길동', netPay: 3_000_000 },
      { name: '홍길동', netPay: 3_000_000 },
    ],
    [{ description: '급여 홍길동', withdrawal: 3_000_000 }]
  )
  assert.equal(result[0].isMatched, true)
  assert.equal(result[1].isMatched, false)
  assert.equal(result[1].bankAmount, 0)
})

test('금액 불일치: 이름은 맞지만 금액이 다르면 불일치로 표시', () => {
  const result = matchEmployeesToTransactions(
    [{ name: '김철수', netPay: 2_500_000 }],
    [{ description: '급여 김철수', withdrawal: 2_300_000 }]
  )
  assert.equal(result[0].isMatched, false)
  assert.equal(result[0].difference, 200_000)
})

test('허용 오차: 100원 미만 차이는 일치로 처리', () => {
  const result = matchEmployeesToTransactions(
    [{ name: '김철수', netPay: 2_500_000 }],
    [{ description: '급여 김철수', withdrawal: 2_499_990 }]
  )
  assert.equal(result[0].isMatched, true)
})

test('빈 적요는 어떤 이름과도 매칭되지 않음', () => {
  const result = matchEmployeesToTransactions(
    [{ name: '김철수', netPay: 2_500_000 }],
    [{ description: '', withdrawal: 2_500_000 }]
  )
  assert.equal(result[0].bankAmount, 0)
  assert.equal(result[0].isMatched, false)
})

test('적요에 이름이 없으면 매칭 없이 미이체(-) 처리', () => {
  const result = matchEmployeesToTransactions(
    [{ name: '김철수', netPay: 2_500_000 }],
    [{ description: '대량이체 급여', withdrawal: 50_000_000 }]
  )
  assert.equal(result[0].bankAmount, 0)
})
