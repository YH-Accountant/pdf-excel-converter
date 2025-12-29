import { DocumentType } from '@/app/page'

// 문서 유형별 추출 필드 정의
export const documentTemplates: Record<DocumentType, {
  label: string
  fields: string[]
  prompt: string
}> = {
  contract: {
    label: '계약서',
    fields: ['partyA', 'partyB', 'contractDate', 'contractContent', 'contractAmount', 'contractTerms', 'contractPeriod'],
    prompt: `이 계약서에서 다음 정보를 추출해주세요:
- partyA: 계약당사자 갑 (회사명 또는 이름)
- partyB: 계약당사자 을 (회사명 또는 이름)
- contractDate: 계약일 (YYYY-MM-DD 형식)
- contractContent: 계약 내용 요약
- contractAmount: 계약 금액 (숫자만)
- contractTerms: 주요 계약 조건
- contractPeriod: 계약 기간`
  },

  taxInvoice: {
    label: '세금계산서',
    fields: ['supplier', 'receiver', 'issueDate', 'supplyValue', 'taxAmount', 'items'],
    prompt: `이 세금계산서에서 다음 정보를 추출해주세요:
- supplier: 공급자 (사업자명)
- receiver: 공급받는자 (사업자명)
- issueDate: 작성일 (YYYY-MM-DD 형식)
- supplyValue: 공급가액 (숫자만)
- taxAmount: 부가세 (숫자만)
- items: 품목명`
  },

  tradingStatement: {
    label: '거래명세서',
    fields: ['tradingPartner', 'tradingDate', 'items', 'quantity', 'unitPrice', 'totalAmount'],
    prompt: `이 거래명세서에서 다음 정보를 추출해주세요:
- tradingPartner: 거래처명
- tradingDate: 거래일 (YYYY-MM-DD 형식)
- items: 품목명
- quantity: 수량 (숫자만)
- unitPrice: 단가 (숫자만)
- totalAmount: 합계 금액 (숫자만)`
  },

  accountingSlip: {
    label: '회계전표',
    fields: ['slipNumber', 'slipDate', 'accountCode', 'debit', 'credit', 'description'],
    prompt: `이 회계전표에서 다음 정보를 추출해주세요:
- slipNumber: 전표번호
- slipDate: 전표일자 (YYYY-MM-DD 형식)
- accountCode: 계정과목
- debit: 차변 금액 (숫자만)
- credit: 대변 금액 (숫자만)
- description: 적요 (거래 내용)`
  },

  bankStatement: {
    label: '통장 입출금내역',
    fields: ['transactionDate', 'deposit', 'withdrawal', 'balance', 'transactionContent', 'counterparty'],
    prompt: `이 통장 입출금내역에서 다음 정보를 추출해주세요:
- transactionDate: 거래일 (YYYY-MM-DD 형식)
- deposit: 입금액 (숫자만, 없으면 0)
- withdrawal: 출금액 (숫자만, 없으면 0)
- balance: 잔액 (숫자만)
- transactionContent: 거래 내용
- counterparty: 거래 상대방`
  },

  assetDisposal: {
    label: '취득처분전표',
    fields: ['assetName', 'acquisitionDate', 'amount', 'counterparty', 'reason'],
    prompt: `이 취득/처분 전표에서 다음 정보를 추출해주세요:
- assetName: 자산명
- acquisitionDate: 취득 또는 처분일 (YYYY-MM-DD 형식)
- amount: 금액 (숫자만)
- counterparty: 거래 상대방
- reason: 취득/처분 사유`
  },

  withholdingTax: {
    label: '급여원천징수이행상황신고서',
    fields: ['attributionMonth', 'numberOfPeople', 'totalPayment', 'incomeTax', 'localIncomeTax'],
    prompt: `이 원천징수이행상황신고서에서 다음 정보를 추출해주세요:
- attributionMonth: 귀속 연월 (YYYY-MM 형식)
- numberOfPeople: 인원수 (숫자만)
- totalPayment: 총 지급액 (숫자만)
- incomeTax: 소득세 (숫자만)
- localIncomeTax: 지방소득세 (숫자만)`
  },

  estimate: {
    label: '견적서',
    fields: ['tradingPartner', 'createdDate', 'items', 'quantity', 'unitPrice', 'totalAmount', 'validityPeriod'],
    prompt: `이 견적서에서 다음 정보를 추출해주세요:
- tradingPartner: 거래처명 (견적 받는 곳)
- createdDate: 작성일 (YYYY-MM-DD 형식)
- items: 품목명
- quantity: 수량 (숫자만)
- unitPrice: 단가 (숫자만)
- totalAmount: 합계 금액 (숫자만)
- validityPeriod: 견적 유효기간`
  },
}

// 문서 유형 자동 인식 프롬프트
export const documentTypeDetectionPrompt = `이 문서의 유형을 판별해주세요. 다음 중 하나를 선택하세요:
- contract: 계약서 (용역계약서, 매매계약서, 임대차계약서 등)
- taxInvoice: 세금계산서
- tradingStatement: 거래명세서
- accountingSlip: 회계전표 (분개전표, 입금전표, 출금전표 등)
- bankStatement: 통장 입출금내역
- assetDisposal: 취득처분전표 (자산 취득/처분 관련)
- withholdingTax: 급여원천징수이행상황신고서
- estimate: 견적서

JSON 형식으로 응답해주세요: { "documentType": "선택한유형" }`
