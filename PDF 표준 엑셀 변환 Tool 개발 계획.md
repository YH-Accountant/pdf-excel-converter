# PDF 표준 엑셀 변환 Tool 개발 계획

## 프로젝트 개요
PDF 문서(계약서, 세금계산서 등)를 업로드하면 핵심 정보를 자동 추출하여 표준 엑셀 포맷으로 변환하는 Tool

## 대상 문서 (8개)
1. 계약서
2. 세금계산서
3. 거래명세서
4. 회계전표
5. 통장 입출금내역
6. 취득처분전표
7. 급여원천징수이행상황신고서
8. 견적서

## 기술 스택
- **Frontend**: Next.js + TypeScript + Tailwind CSS
- **PDF 처리**: Claude Vision API (PDF/이미지 인식)
- **엑셀 생성**: xlsx 라이브러리
- **배포**: Vercel

## 프로젝트 구조
```
pdf-excel-converter/
├── app/
│   ├── page.tsx          # 메인 페이지 (업로드 UI)
│   ├── layout.tsx
│   └── api/
│       ├── extract/route.ts    # PDF 파싱 API
│       └── download/route.ts   # 엑셀 다운로드 API
├── components/
│   ├── FileUpload.tsx    # 파일 업로드 컴포넌트
│   ├── DocumentTypeSelector.tsx  # 문서 유형 선택
│   ├── ResultTable.tsx   # 추출 결과 테이블
│   └── ExcelDownload.tsx # 엑셀 다운로드 버튼
├── lib/
│   ├── templates/        # 문서별 추출 템플릿
│   │   ├── contract.ts   # 계약서
│   │   ├── taxInvoice.ts # 세금계산서
│   │   ├── tradingStatement.ts  # 거래명세서
│   │   ├── accountingSlip.ts    # 회계전표
│   │   ├── bankStatement.ts     # 통장 입출금내역
│   │   ├── assetDisposal.ts     # 취득처분전표
│   │   ├── withholdingTax.ts    # 급여원천징수이행상황신고서
│   │   └── estimate.ts   # 견적서
│   ├── claude.ts         # Claude API 연동
│   └── excel.ts          # 엑셀 생성 유틸
├── .env.local            # API 키
└── package.json
```

## 개발 단계

### 1단계: 프로젝트 초기 세팅
- Next.js 프로젝트 생성
- 필요 패키지 설치 (xlsx, @anthropic-ai/sdk)
- 폴더 구조 생성

### 2단계: UI 구현
- 파일 업로드 드래그앤드롭
- 문서 유형: 자동 인식 + 사용자 수정 가능 (드롭다운)
- 추출 결과 미리보기 테이블
- 엑셀 다운로드 버튼

### 3단계: 문서별 추출 템플릿 정의
- 8개 문서 유형별 추출 필드 정의
- Claude 프롬프트 템플릿 작성

### 4단계: Claude API 연동
- PDF/이미지 → Claude Vision으로 텍스트 추출
- 문서 유형별 구조화된 JSON 반환

### 5단계: 엑셀 변환
- 추출된 JSON → xlsx 라이브러리로 엑셀 생성
- 다운로드 기능

### 6단계: 테스트 및 배포
- 실제 PDF로 테스트
- Vercel 배포

## 문서별 추출 필드

| 문서 | 추출 필드 |
|------|----------|
| 계약서 | 계약당사자(갑/을), 계약일, 계약내용, 계약금액, 계약조건, 계약기간 |
| 세금계산서 | 공급자, 공급받는자, 작성일, 공급가액, 부가세, 품목 |
| 거래명세서 | 거래처, 거래일, 품목, 수량, 단가, 합계 |
| 회계전표 | 전표번호, 일자, 계정과목, 차변, 대변, 적요 |
| 통장입출금내역 | 거래일, 입금, 출금, 잔액, 거래내용, 상대방 |
| 취득처분전표 | 자산명, 취득/처분일, 금액, 상대방, 사유 |
| 원천징수신고서 | 귀속월, 인원, 총지급액, 소득세, 지방소득세 |
| 견적서 | 거래처, 작성일, 품목, 수량, 단가, 합계, 유효기간 |

## 저장 위치
`C:\Users\syoun\OneDrive\바탕 화면\ai agent\pdf-excel-converter`
