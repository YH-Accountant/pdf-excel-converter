'use client'

import { useState } from 'react'
import Link from 'next/link'

type ThemeOption = 'A' | 'B' | 'C'

export default function PreviewPage() {
  const [theme, setTheme] = useState<ThemeOption>('A')

  const themes = {
    A: {
      name: '모던 블루',
      bg: 'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50',
      card: 'bg-white/80 backdrop-blur-sm border border-white/50 shadow-lg hover:shadow-xl hover:-translate-y-1',
      title: 'text-gray-900',
      subtitle: 'text-gray-600',
      accent1: 'bg-blue-100 text-blue-600',
      accent2: 'bg-emerald-100 text-emerald-600',
      accent3: 'bg-purple-100 text-purple-600',
    },
    B: {
      name: '소프트 퍼플',
      bg: 'bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50',
      card: 'bg-white/70 backdrop-blur-md border border-purple-100/50 shadow-lg shadow-purple-100/20 hover:shadow-xl hover:-translate-y-1',
      title: 'text-purple-900',
      subtitle: 'text-purple-600/70',
      accent1: 'bg-purple-100 text-purple-600',
      accent2: 'bg-pink-100 text-pink-600',
      accent3: 'bg-orange-100 text-orange-600',
    },
    C: {
      name: '다크 모드',
      bg: 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900',
      card: 'bg-slate-800/50 backdrop-blur-md border border-slate-700/50 shadow-lg shadow-black/20 hover:shadow-xl hover:border-slate-600 hover:-translate-y-1',
      title: 'text-white',
      subtitle: 'text-slate-400',
      accent1: 'bg-blue-500/20 text-blue-400',
      accent2: 'bg-emerald-500/20 text-emerald-400',
      accent3: 'bg-purple-500/20 text-purple-400',
    },
  }

  const t = themes[theme]

  const features = [
    {
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      title: '단일 증빙 처리',
      desc: 'PDF, 이미지 파일 1개를 업로드하여 정보 추출',
      accent: t.accent1,
    },
    {
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
        </svg>
      ),
      title: '대량 증빙 처리',
      desc: '여러 파일을 한번에 업로드하여 일괄 처리',
      accent: t.accent2,
    },
    {
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      title: '급여 검증',
      desc: '급여대장과 통장내역을 비교하여 크로스체크',
      accent: t.accent3,
    },
  ]

  const docTypes = ['계약서', '세금계산서', '거래명세서', '회계전표', '통장 입출금내역', '취득처분전표', '원천징수신고서', '견적서', '급여대장']

  return (
    <div className={`min-h-screen ${t.bg} transition-all duration-500`}>
      {/* 테마 선택 버튼 - 상단 고정 */}
      <div className="fixed top-4 right-4 z-50 flex gap-2">
        {(['A', 'B', 'C'] as ThemeOption[]).map((opt) => (
          <button
            key={opt}
            onClick={() => setTheme(opt)}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              theme === opt
                ? 'bg-black text-white shadow-lg'
                : 'bg-white/80 text-gray-700 hover:bg-white shadow'
            }`}
          >
            옵션 {opt}
          </button>
        ))}
      </div>

      {/* 테마 이름 표시 */}
      <div className="fixed top-4 left-4 z-50">
        <span className={`px-4 py-2 rounded-lg font-bold ${theme === 'C' ? 'bg-slate-700 text-white' : 'bg-white/80 text-gray-800'} shadow-lg`}>
          {t.name}
        </span>
      </div>

      <div className="max-w-4xl mx-auto py-20 px-4">
        {/* 히어로 섹션 */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/30 backdrop-blur-sm mb-6">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            <span className={`text-sm font-medium ${theme === 'C' ? 'text-slate-300' : 'text-gray-600'}`}>
              AI 기반 문서 인식
            </span>
          </div>

          <h1 className={`text-4xl md:text-5xl font-bold ${t.title} mb-4 tracking-tight`}>
            PDF 표준 엑셀 변환 Tool
          </h1>
          <p className={`text-lg ${t.subtitle} max-w-xl mx-auto`}>
            증빙 문서를 업로드하면 AI가 자동으로 인식하고<br />
            표준 엑셀 형식으로 변환해드립니다
          </p>
        </div>

        {/* 기능 카드 */}
        <div className="space-y-4 mb-16">
          {features.map((feature, idx) => (
            <div
              key={idx}
              className={`${t.card} rounded-2xl p-6 transition-all duration-300 cursor-pointer group`}
            >
              <div className="flex items-center gap-5">
                <div className={`w-14 h-14 ${feature.accent} rounded-xl flex items-center justify-center transition-transform group-hover:scale-110`}>
                  {feature.icon}
                </div>
                <div className="flex-1">
                  <h3 className={`text-lg font-semibold ${t.title} mb-1`}>
                    {feature.title}
                  </h3>
                  <p className={`text-sm ${t.subtitle}`}>
                    {feature.desc}
                  </p>
                </div>
                <svg className={`w-5 h-5 ${t.subtitle} group-hover:translate-x-1 transition-transform`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          ))}
        </div>

        {/* 지원 문서 유형 */}
        <div className="text-center">
          <p className={`text-sm ${t.subtitle} mb-4`}>지원 문서 유형</p>
          <div className="flex flex-wrap justify-center gap-2">
            {docTypes.map((type) => (
              <span
                key={type}
                className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                  theme === 'C'
                    ? 'bg-slate-700/50 text-slate-300'
                    : 'bg-white/60 text-gray-600'
                } backdrop-blur-sm`}
              >
                {type}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 메인으로 돌아가기 */}
      <div className="fixed bottom-4 left-4">
        <Link
          href="/"
          className={`px-4 py-2 rounded-lg font-medium ${
            theme === 'C' ? 'bg-slate-700 text-white' : 'bg-white/80 text-gray-700'
          } shadow-lg hover:shadow-xl transition-all`}
        >
          ← 메인으로
        </Link>
      </div>
    </div>
  )
}
