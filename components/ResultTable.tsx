'use client'

import { ExtractedData } from '@/app/single/page'
import { DOCUMENT_FIELDS, DOCUMENT_TYPE_LABELS, formatFieldValue } from '@/lib/documentFields'

interface ResultTableProps {
  data: ExtractedData
}

export default function ResultTable({ data }: ResultTableProps) {
  // 유형별로 정해둔 표시 필드만 노출 (일괄 엑셀과 동일한 필드·라벨)
  const fields = DOCUMENT_FIELDS[data.documentType] ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">추출 결과</h3>
        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
          {DOCUMENT_TYPE_LABELS[data.documentType]}
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
            {fields.map(({ key, label }) => {
              const formatted = formatFieldValue(key, data.fields[key])
              return (
                <tr key={key} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {label}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-pre-line">
                    {formatted === '' ? '-' : formatted}
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
