'use client'

import { ExtractedData, DocumentType } from '@/app/single/page'

interface ResultTableProps {
  data: ExtractedData
}

const documentTypeLabels: Record<DocumentType, string> = {
  contract: '계약서',
  taxInvoice: '세금계산서',
  tradingStatement: '거래명세서',
  bankStatement: '통장 입출금내역',
  assetDisposal: '취득처분전표',
  withholdingTax: '급여원천징수이행상황신고서',
  estimate: '견적서',
  payroll: '급여대장',
}

// 숫자 금액 필드 (콤마 포맷 적용)
const numberFields = ['supplyValue', 'taxAmount', 'totalAmount', 'deposit', 'withdrawal', 'balance', 'incomeTax', 'localIncomeTax', 'totalPayment', 'unitPrice', 'amount', 'acquisitionCost', 'disposalPrice']

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
  // 공통 (취득처분전표 등에서 사용)
  slipNumber: '전표번호',
  accountCode: '계정과목',
  description: '적요',
  // 통장 입출금내역
  transactionDate: '거래일',
  deposit: '입금',
  withdrawal: '출금',
  balance: '잔액',
  transactionContent: '거래내용',
  counterparty: '상대방',
  // 자산취득처분 (transactionDate, accountCode, slipNumber는 위에서 정의됨)
  transactionType: '거래유형',
  assetCategory: '자산분류',
  itemDetail: '품목상세',
  acquisitionCost: '취득원가',
  disposalPrice: '처분가액',
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

export default function ResultTable({ data }: ResultTableProps) {
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
