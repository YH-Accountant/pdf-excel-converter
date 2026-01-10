'use client'

import Link from 'next/link'

const menuItems = [
  {
    title: '단일 증빙 처리',
    description: 'PDF, 이미지 파일 1개를 업로드하여 정보 추출',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    href: '/single',
    accent: 'bg-blue-100 text-blue-600',
  },
  {
    title: '대량 증빙 처리',
    description: '여러 파일을 한번에 업로드하여 일괄 처리',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
      </svg>
    ),
    href: '/batch',
    accent: 'bg-emerald-100 text-emerald-600',
  },
  {
    title: '급여 검증',
    description: '급여대장과 통장내역을 비교하여 크로스체크',
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    href: '/payroll',
    accent: 'bg-purple-100 text-purple-600',
  },
]

const docTypes = ['계약서', '세금계산서', '거래명세서', '회계전표', '통장 입출금내역', '취득처분전표', '원천징수신고서', '견적서', '급여대장']

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 transition-all duration-500">
      <div className="max-w-4xl mx-auto py-20 px-4">
        {/* 히어로 섹션 */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/30 backdrop-blur-sm mb-6">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            <span className="text-sm font-medium text-gray-600">
              AI 기반 문서 인식
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 tracking-tight">
            PDF 표준 엑셀 변환 Tool
          </h1>
          <p className="text-lg text-gray-600 max-w-xl mx-auto">
            증빙 문서를 업로드하면 AI가 자동으로 인식하고<br />
            표준 엑셀 형식으로 변환해드립니다
          </p>
        </div>

        {/* 기능 카드 */}
        <div className="space-y-4 mb-16">
          {menuItems.map((item, idx) => (
            <Link
              key={idx}
              href={item.href}
              className="block bg-white/80 backdrop-blur-sm border border-white/50 shadow-lg hover:shadow-xl hover:-translate-y-1 rounded-2xl p-6 transition-all duration-300 cursor-pointer group"
            >
              <div className="flex items-center gap-5">
                <div className={`w-14 h-14 ${item.accent} rounded-xl flex items-center justify-center transition-transform group-hover:scale-110`}>
                  {item.icon}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {item.title}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {item.description}
                  </p>
                </div>
                <svg className="w-5 h-5 text-gray-600 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>

        {/* 지원 문서 유형 */}
        <div className="text-center">
          <p className="text-sm text-gray-600 mb-4">지원 문서 유형</p>
          <div className="flex flex-wrap justify-center gap-2">
            {docTypes.map((type) => (
              <span
                key={type}
                className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/60 text-gray-600 backdrop-blur-sm"
              >
                {type}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
