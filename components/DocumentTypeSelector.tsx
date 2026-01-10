'use client'

import { DocumentType } from '@/app/single/page'

interface DocumentTypeSelectorProps {
  selectedType: DocumentType | null
  onTypeChange: (type: DocumentType | null) => void
}

const documentTypes: { value: DocumentType; label: string }[] = [
  { value: 'contract', label: '계약서' },
  { value: 'taxInvoice', label: '세금계산서' },
  { value: 'tradingStatement', label: '거래명세서' },
  { value: 'accountingSlip', label: '회계전표' },
  { value: 'bankStatement', label: '통장 입출금내역' },
  { value: 'assetDisposal', label: '취득처분전표' },
  { value: 'withholdingTax', label: '급여원천징수이행상황신고서' },
  { value: 'estimate', label: '견적서' },
]

export default function DocumentTypeSelector({
  selectedType,
  onTypeChange,
}: DocumentTypeSelectorProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        문서 유형 (선택 안하면 자동 인식)
      </label>
      <select
        value={selectedType || ''}
        onChange={(e) => onTypeChange((e.target.value as DocumentType) || null)}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
      >
        <option value="">자동 인식</option>
        {documentTypes.map((type) => (
          <option key={type.value} value={type.value}>
            {type.label}
          </option>
        ))}
      </select>
    </div>
  )
}
