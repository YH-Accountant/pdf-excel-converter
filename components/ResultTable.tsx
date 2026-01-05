'use client'

import { ExtractedData, DocumentType, AccountingEntry } from '@/app/page'

interface ResultTableProps {
  data: ExtractedData
}

const documentTypeLabels: Record<DocumentType, string> = {
  contract: '계약서',
  taxInvoice: '세금계산서',
  tradingStatement: '거래명세서',
  accountingSlip: '회계전표',
  bankStatement: '통장 입출금내역',
  assetDisposal: '취득처분전표',
  withholdingTax: '급여원천징수이행상황신고서',
  estimate: '견적서',
}

// 숫자 금액 필드 (콤마 포맷 적용)
const numberFields = ['supplyValue', 'taxAmount', 'totalAmount', 'unpaidAmount', 'deposit', 'withdrawal', 'balance', 'debit', 'credit', 'incomeTax', 'localIncomeTax', 'totalPayment', 'unitPrice', 'amount']

// 숫자를 천 단위 콤마 포맷으로 변환
const formatNumber = (value: any): string => {
  if (value === null || value === undefined || value === '') return '-'
  const num = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value
  if (isNaN(num)) return String(value)
  return num.toLocaleString('ko-KR')
}

// 필드 값 포맷팅
const formatValue = (key: string, value: any): string => {
  if (value === null || value === undefined) return '-'
  if (numberFields.includes(key)) return formatNumber(value)
  return String(value)
}

const fieldLabels: Record<string, string> = {
  // 계약서
  contractTitle: '계약서 제목',
  partyA: '계약당사자(갑)',
  partyB: '계약당사자(을)',
  contractDate: '계약일',
  contractContent: '계약내용',
  contractAmount: '계약금액',
  contractTerms: '계약조건',
  contractPeriod: '계약기간',
  // 세금계산서
  supplier: '공급자',
  receiver: '공급받는자',
  issueDate: '작성일',
  supplyValue: '공급가액',
  taxAmount: '부가세',
  items: '품목',
  // 거래명세서
  tradingPartner: '거래처',
  tradingDate: '거래일',
  quantity: '수량',
  unitPrice: '단가',
  totalAmount: '합계',
  // 회계전표
  slipNumber: '전표번호',
  slipDate: '일자',
  accountCode: '계정과목',
  debit: '차변',
  credit: '대변',
  description: '적요',
  entries: '분개내역',
  // 통장 입출금내역
  transactionDate: '거래일',
  deposit: '입금',
  withdrawal: '출금',
  balance: '잔액',
  transactionContent: '거래내용',
  counterparty: '상대방',
  // 취득처분전표
  assetName: '자산명',
  acquisitionDate: '취득/처분일',
  amount: '금액',
  reason: '사유',
  // 원천징수신고서
  attributionYearMonth: '귀속년월',
  numberOfPeople: '인원',
  totalPayment: '총지급액',
  incomeTax: '소득세',
  localIncomeTax: '지방소득세',
  // 견적서
  createdDate: '작성일',
  validityPeriod: '유효기간',
}

// 회계전표 분개 내역 테이블 컴포넌트
function AccountingEntriesTable({ entries }: { entries: AccountingEntry[] }) {
  const totalDebit = entries.reduce((sum, e) => sum + (e.debit || 0), 0)
  const totalCredit = entries.reduce((sum, e) => sum + (e.credit || 0), 0)

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-blue-50">
          <tr>
            <th className="px-2 py-1 text-left font-medium text-gray-700">계정과목</th>
            <th className="px-2 py-1 text-right font-medium text-gray-700">차변</th>
            <th className="px-2 py-1 text-right font-medium text-gray-700">대변</th>
            <th className="px-2 py-1 text-left font-medium text-gray-700">적요</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {entries.map((entry, idx) => (
            <tr key={idx}>
              <td className="px-2 py-1">{entry.accountCode}</td>
              <td className="px-2 py-1 text-right">{entry.debit ? formatNumber(entry.debit) : '-'}</td>
              <td className="px-2 py-1 text-right">{entry.credit ? formatNumber(entry.credit) : '-'}</td>
              <td className="px-2 py-1 text-gray-600">{entry.description || '-'}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-gray-50 font-medium">
          <tr>
            <td className="px-2 py-1">합계</td>
            <td className="px-2 py-1 text-right">{formatNumber(totalDebit)}</td>
            <td className="px-2 py-1 text-right">{formatNumber(totalCredit)}</td>
            <td className="px-2 py-1">
              {totalDebit === totalCredit ? (
                <span className="text-green-600">✓ 대차 일치</span>
              ) : (
                <span className="text-red-600">✕ 대차 불일치</span>
              )}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

export default function ResultTable({ data }: ResultTableProps) {
  // entries 필드가 있는지 확인 (회계전표)
  const hasEntries = data.documentType === 'accountingSlip' &&
    data.fields.entries &&
    Array.isArray(data.fields.entries)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">추출 결과</h3>
        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
          {documentTypeLabels[data.documentType]}
        </span>
      </div>

      <div className="overflow-hidden border border-gray-200 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/3">
                항목
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                값
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {Object.entries(data.fields).map(([key, value]) => {
              // entries 필드는 별도 테이블로 표시
              if (key === 'entries' && Array.isArray(value)) {
                return (
                  <tr key={key} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 align-top">
                      {fieldLabels[key] || key}
                      <span className="ml-2 text-xs text-gray-500">
                        ({(value as AccountingEntry[]).length}줄)
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <AccountingEntriesTable entries={value as AccountingEntry[]} />
                    </td>
                  </tr>
                )
              }

              return (
                <tr key={key} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {fieldLabels[key] || key}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatValue(key, value)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
