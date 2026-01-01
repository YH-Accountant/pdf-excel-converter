import { DocumentType } from '@/app/page'

// 문서 유형별 추출 필드 정의
export const documentTemplates: Record<DocumentType, {
  label: string
  fields: string[]
  prompt: string
}> = {
  contract: {
    label: '계약서',
    fields: ['contractTitle', 'partyA', 'partyB', 'contractDate', 'contractContent', 'contractAmount', 'contractTerms', 'contractPeriod'],
    prompt: `당신은 계약서 분석 전문가입니다. 아래 계약서 이미지에서 핵심 정보를 정확하게 추출해주세요.

[추출 규칙]
1. contractTitle (계약서 제목)
   - 계약의 핵심 내용을 나타내는 간결한 제목
   - 문서에 제목이 있으면 그대로, 없으면 핵심 키워드로 생성
   - 예: "산업용 스마트 센서 공급계약", "사무실 임대차계약", "SI개발 용역계약"

2. partyA (계약당사자 갑)
   - 실제 계약을 체결하는 법인 또는 개인의 정식 명칭
   - "수신", "발신", "참조", "수신처장" 등 문서 수발신 정보는 제외
   - 예: "주식회사 OO", "OO 대표이사 홍길동"

2. partyB (계약당사자 을)
   - 실제 계약을 체결하는 상대방 법인 또는 개인의 정식 명칭
   - 문서 수발신 정보는 제외

3. contractDate (계약일)
   - YYYY-MM-DD 형식
   - 계약 체결일 또는 계약서 작성일

4. contractContent (계약 내용)
   - 계약의 목적과 핵심 내용을 2-3문장으로 요약
   - 예: "OO 제품 공급 계약. 갑이 을에게 월 100개의 제품을 공급하고 을은 대금을 지급함."

5. contractAmount (계약 금액)
   - 형식: "한글금액(숫자, VAT 별도/포함)"
   - 반드시 한글 금액과 숫자 금액이 일치하는지 검증할 것!
   - 한글 금액 변환 규칙:
     * 일 = 1, 이 = 2, 삼 = 3, 사 = 4, 오 = 5, 육 = 6, 칠 = 7, 팔 = 8, 구 = 9
     * 십 = 10, 백 = 100, 천 = 1,000, 만 = 10,000, 억 = 100,000,000
     * 예: 팔천오백삼십만원 = 8530만 = 85,300,000원
     * 예: 일억이천삼백만원 = 1억 2300만 = 123,000,000원
   - 문서에 숫자만 있으면: 숫자를 한글로 변환하여 기재
   - 문서에 한글만 있으면: 한글을 숫자로 변환하여 기재
   - 예: "팔천오백삼십만원(85,300,000원, VAT 별도)"
   - 금액이 명시되지 않은 경우: "명시되지 않음"

6. contractTerms (주요 계약 조건)
   - 핵심 조건만 3-5개 항목으로 요약
   - 반드시 각 조건을 줄바꿈(\n)으로 구분
   - 형식: "1) 조건1\n2) 조건2\n3) 조건3"
   - 예: "1) 납품기한: 30일 이내\n2) 대금지급: 납품 후 30일\n3) 하자보증: 1년"

7. contractPeriod (계약 기간)
   - 시작일 ~ 종료일 형식
   - 예: "2025-01-01 ~ 2027-12-31 (3년)"
   - 기간이 명시되지 않은 경우: "명시되지 않음"

[중요]
- 문서에서 명확히 확인되지 않는 정보는 null로 표시
- 추측하지 말고 문서에 있는 내용만 추출
- 금액은 반드시 한글과 숫자가 일치하는지 계산하여 검증할 것 (가장 중요!)`
  },

  taxInvoice: {
    label: '세금계산서',
    fields: ['supplier', 'receiver', 'issueDate', 'items', 'supplyValue', 'taxAmount', 'totalAmount', 'unpaidAmount'],
    prompt: `당신은 세금계산서 분석 전문가입니다. 아래 세금계산서에서 핵심 정보를 정확하게 추출해주세요.

[추출 규칙]
1. supplier (공급자)
   - 사업자등록번호와 함께 표기
   - 예: "주식회사 OO (123-45-67890)"

2. receiver (공급받는자)
   - 사업자등록번호와 함께 표기
   - 예: "주식회사 XX (098-76-54321)"

3. issueDate (작성일)
   - YYYY-MM-DD 형식

4. items (품목)
   - 주요 품목명 나열
   - 여러 개인 경우 콤마로 구분

5. supplyValue (공급가액)
   - 숫자만 (콤마 없이)
   - 예: 10000000

6. taxAmount (부가세)
   - 숫자만 (콤마 없이)
   - 예: 1000000

7. totalAmount (총액)
   - 공급가액 + 부가세
   - 숫자만 (콤마 없이)
   - 예: 11000000

8. unpaidAmount (미지급금)
   - 미지급 금액이 있는 경우에만 기재
   - 숫자만 (콤마 없이)
   - 없으면 null

[중요]
- 문서에서 명확히 확인되지 않는 정보는 null로 표시`
  },

  tradingStatement: {
    label: '거래명세서',
    fields: ['supplier', 'tradingPartner', 'tradingDate', 'items', 'quantity', 'unitPrice', 'totalAmount'],
    prompt: `당신은 거래명세서 분석 전문가입니다. 아래 거래명세서에서 핵심 정보를 정확하게 추출해주세요.

[추출 규칙]
1. supplier (공급자)
   - 사업자등록번호와 함께 표기
   - 예: "주식회사 OO (123-45-67890)"

2. tradingPartner (거래처명)
   - 거래 상대방 회사명 또는 상호

3. tradingDate (거래일)
   - YYYY-MM-DD 형식

4. items (품목명)
   - 주요 품목 나열 (여러 개인 경우 콤마로 구분)

5. quantity (수량)
   - 총 수량 (숫자만)
   - 여러 품목인 경우 각각 표기: "품목A: 100, 품목B: 50"

6. unitPrice (단가)
   - 숫자만 (콤마 없이)
   - 여러 품목인 경우 각각 표기

7. totalAmount (합계 금액)
   - 형식: "한글금액(숫자, VAT 별도/포함)"
   - 한글 금액이 있으면 한글 금액을 우선 기재
   - 예: "일천만원(10,000,000원, VAT 별도)"

[중요]
- 문서에서 명확히 확인되지 않는 정보는 null로 표시`
  },

  accountingSlip: {
    label: '회계전표',
    fields: ['slipNumber', 'slipDate', 'entries'],
    prompt: `당신은 회계전표 분석 전문가입니다. 아래 회계전표에서 핵심 정보를 정확하게 추출해주세요.

[추출 규칙]
1. slipNumber (전표번호)
   - 문서에 기재된 전표번호 그대로

2. slipDate (전표일자)
   - YYYY-MM-DD 형식

3. entries (분개 내역) - 배열 형식으로 추출
   - 회계전표에 있는 모든 분개 라인을 배열로 추출
   - 각 라인은 다음 필드를 포함:
     * accountCode: 계정과목명
     * debit: 차변 금액 (숫자만, 없으면 0)
     * credit: 대변 금액 (숫자만, 없으면 0)
     * description: 적요/거래내용

[응답 형식 예시]
{
  "slipNumber": "J2025-0001",
  "slipDate": "2025-01-15",
  "entries": [
    { "accountCode": "현금", "debit": 1000000, "credit": 0, "description": "매출대금 수령" },
    { "accountCode": "매출", "debit": 0, "credit": 1000000, "description": "상품 판매" }
  ]
}

[중요]
- 전표에 여러 줄의 분개가 있으면 모두 entries 배열에 포함
- 차변 합계와 대변 합계가 일치해야 함 (복식부기 원칙)
- 문서에서 명확히 확인되지 않는 정보는 null로 표시`
  },

  bankStatement: {
    label: '통장 입출금내역',
    fields: ['transactionDate', 'deposit', 'withdrawal', 'balance', 'transactionContent', 'counterparty'],
    prompt: `당신은 통장 입출금내역 분석 전문가입니다. 아래 통장 내역에서 핵심 정보를 정확하게 추출해주세요.

[추출 규칙]
1. transactionDate (거래일)
   - YYYY-MM-DD 형식
   - 여러 거래가 있으면 가장 최근 거래일

2. deposit (입금액)
   - 숫자만 (콤마 없이)
   - 없으면 0

3. withdrawal (출금액)
   - 숫자만 (콤마 없이)
   - 없으면 0

4. balance (잔액)
   - 숫자만 (콤마 없이)
   - 가장 최근 잔액

5. transactionContent (거래 내용)
   - 거래 적요 또는 내용

6. counterparty (거래 상대방)
   - 입금자 또는 출금 대상

[중요]
- 여러 거래가 있는 경우 주요 거래 또는 최근 거래 기준으로 추출
- 문서에서 명확히 확인되지 않는 정보는 null로 표시`
  },

  assetDisposal: {
    label: '취득처분전표',
    fields: ['assetName', 'acquisitionDate', 'amount', 'counterparty', 'reason'],
    prompt: `당신은 자산 취득/처분 전표 분석 전문가입니다. 아래 전표에서 핵심 정보를 정확하게 추출해주세요.

[추출 규칙]
1. assetName (자산명)
   - 취득 또는 처분 대상 자산의 정확한 명칭
   - 예: "업무용 차량 (소나타)", "사무용 컴퓨터"

2. acquisitionDate (취득/처분일)
   - YYYY-MM-DD 형식

3. amount (금액)
   - 형식: "한글금액(숫자, VAT 별도/포함)"
   - 한글 금액이 있으면 한글 금액을 우선 기재
   - 예: "삼천만원(30,000,000원, VAT 포함)"

4. counterparty (거래 상대방)
   - 자산을 구입/판매한 상대방

5. reason (취득/처분 사유)
   - 간단한 사유 설명
   - 예: "업무용 차량 교체", "노후 장비 매각"

[중요]
- 문서에서 명확히 확인되지 않는 정보는 null로 표시`
  },

  withholdingTax: {
    label: '급여원천징수이행상황신고서',
    fields: ['attributionMonth', 'numberOfPeople', 'totalPayment', 'incomeTax', 'localIncomeTax'],
    prompt: `당신은 원천징수이행상황신고서 분석 전문가입니다. 아래 신고서에서 핵심 정보를 정확하게 추출해주세요.

[추출 규칙]
1. attributionMonth (귀속 연월)
   - YYYY-MM 형식
   - 예: "2025-01"

2. numberOfPeople (인원수)
   - 숫자만
   - 총 인원수

3. totalPayment (총 지급액)
   - 숫자만 (콤마 없이)
   - 예: 50000000

4. incomeTax (소득세)
   - 숫자만 (콤마 없이)

5. localIncomeTax (지방소득세)
   - 숫자만 (콤마 없이)

[중요]
- 문서에서 명확히 확인되지 않는 정보는 null로 표시`
  },

  estimate: {
    label: '견적서',
    fields: ['tradingPartner', 'createdDate', 'items', 'quantity', 'unitPrice', 'totalAmount', 'validityPeriod'],
    prompt: `당신은 견적서 분석 전문가입니다. 아래 견적서에서 핵심 정보를 정확하게 추출해주세요.

[추출 규칙]
1. tradingPartner (거래처명)
   - 견적을 받는 회사 또는 고객명

2. createdDate (작성일)
   - YYYY-MM-DD 형식

3. items (품목명)
   - 주요 품목 나열 (여러 개인 경우 콤마로 구분)

4. quantity (수량)
   - 숫자만
   - 여러 품목인 경우: "품목A: 10, 품목B: 5"

5. unitPrice (단가)
   - 숫자만 (콤마 없이)
   - 여러 품목인 경우 각각 표기

6. totalAmount (합계 금액)
   - 형식: "한글금액(숫자, VAT 별도/포함)"
   - 한글 금액이 있으면 한글 금액을 우선 기재
   - 예: "오천만원(50,000,000원, VAT 별도)"

7. validityPeriod (견적 유효기간)
   - 예: "견적일로부터 30일", "2025-02-28까지"

[중요]
- 문서에서 명확히 확인되지 않는 정보는 null로 표시`
  },
}

// 문서 유형 자동 인식 프롬프트
export const documentTypeDetectionPrompt = `이 문서의 유형을 판별해주세요. 다음 중 하나를 선택하세요:
- contract: 계약서 (용역계약서, 매매계약서, 임대차계약서, 공급계약서 등)
- taxInvoice: 세금계산서
- tradingStatement: 거래명세서
- accountingSlip: 회계전표 (분개전표, 입금전표, 출금전표 등)
- bankStatement: 통장 입출금내역
- assetDisposal: 취득처분전표 (자산 취득/처분 관련)
- withholdingTax: 급여원천징수이행상황신고서
- estimate: 견적서

JSON 형식으로 응답해주세요: { "documentType": "선택한유형" }`
