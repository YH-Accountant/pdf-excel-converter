import { DocumentType } from '@/app/single/page'

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
    fields: ['slips'],
    prompt: `당신은 회계전표 분석 전문가입니다. 아래 회계전표에서 핵심 정보를 정확하게 추출해주세요.

[중요] 문서에 여러 개의 전표가 있으면 "slips" 배열에 모두 포함해야 합니다!

[추출 규칙]
각 전표마다 다음 정보를 추출:
1. slipNumber (전표번호) - 문서에 기재된 전표번호 그대로
2. slipDate (전표일자) - YYYY-MM-DD 형식
3. entries (분개 내역) - 배열 형식
   - 각 라인: accountCode(계정과목), debit(차변, 숫자), credit(대변, 숫자), description(적요)

[응답 형식 - 반드시 이 형식으로!]
{
  "slips": [
    {
      "slipNumber": "J2025-0001",
      "slipDate": "2025-01-15",
      "entries": [
        { "accountCode": "현금", "debit": 1000000, "credit": 0, "description": "매출대금 수령" },
        { "accountCode": "매출", "debit": 0, "credit": 1000000, "description": "상품 판매" }
      ]
    },
    {
      "slipNumber": "J2025-0002",
      "slipDate": "2025-01-16",
      "entries": [
        { "accountCode": "비품", "debit": 500000, "credit": 0, "description": "사무용품 구입" },
        { "accountCode": "보통예금", "debit": 0, "credit": 500000, "description": "대금 지급" }
      ]
    }
  ]
}

[중요]
- 전표가 1개든 10개든 반드시 "slips" 배열 안에 넣어주세요
- 각 전표의 차변 합계와 대변 합계가 일치해야 함 (복식부기 원칙)
- 문서에서 명확히 확인되지 않는 정보는 null로 표시`
  },

  bankStatement: {
    label: '통장 입출금내역',
    fields: ['companyDivision', 'transactionDate', 'deposit', 'withdrawal', 'balance', 'transactionContent', 'counterparty', 'transactions', 'totalWithdrawal'],
    prompt: `당신은 통장 입출금내역/이체확인증 분석 전문가입니다. 아래 문서에서 핵심 정보를 정확하게 추출해주세요.

[문서 유형]
- 이체확인증: 일괄이체 총액이 표시됨
- 거래내역조회: 개별 거래 내역이 나열됨

[추출 규칙]
0. companyDivision (사업장명/공장명)
   - 이체확인증에 기재된 사업장 구분명 (있는 경우)
   - 예: "제1공장", "제3공장"
   - 없으면 null

1. transactionDate (거래일)
   - YYYY-MM-DD 형식

2. totalWithdrawal (출금 총액) ★ 핵심 필드
   - 숫자만 (콤마 없이)
   - 이체확인증: "이체금액" 또는 "출금금액" 값
   - 거래내역조회: 모든 출금액의 합계 (합계 행이 있으면 그 값 사용)
   - 예: 29937410

3. transactions (개별 거래 내역)
   - 거래내역조회인 경우 배열로 추출
   - 각 거래: { "description": "적요/기재내용", "withdrawal": 출금액 }
   - 적요에 이름이 있으면 그대로 추출 (예: "김민수", "급여이체")

   예시:
   [
     { "description": "김민수", "withdrawal": 3866000 },
     { "description": "이서연", "withdrawal": 4590000 }
   ]

4. deposit (입금액)
   - 숫자만 (콤마 없이)
   - 없으면 0

5. withdrawal (출금액) - 단일 거래용
   - 숫자만 (콤마 없이)

6. balance (잔액)
   - 숫자만 (콤마 없이)

7. transactionContent (거래 내용)
   - 거래 적요 또는 메모

8. counterparty (거래 상대방)
   - 입금자 또는 출금 대상

[응답 형식 예시 - 이체확인증]
{
  "transactionDate": "2025-12-25",
  "totalWithdrawal": 29937410,
  "transactionContent": "12월 급여",
  "counterparty": "김민수 외 6명"
}

[응답 형식 예시 - 거래내역조회]
{
  "transactionDate": "2025-12-25",
  "totalWithdrawal": 29937410,
  "transactions": [
    { "description": "김민수", "withdrawal": 3866000 },
    { "description": "이서연", "withdrawal": 4590000 }
  ]
}

[중요]
- totalWithdrawal은 반드시 추출해야 합니다 (급여 크로스체크에 필수)
- 합계 행이 있으면 그 값을 totalWithdrawal로 사용
- 문서에서 명확히 확인되지 않는 정보는 null로 표시`
  },

  assetDisposal: {
    label: '자산취득처분',
    fields: ['transactionType', 'transactionDate', 'assetCategory', 'itemDetail', 'counterparty', 'acquisitionCost', 'disposalPrice', 'accountCode', 'slipNumber'],
    prompt: `당신은 회계감사 전문가입니다. 아래 전표/증빙에서 자산 취득 또는 처분 관련 정보를 추출해주세요.
이 정보는 감사 조서(Audit Working Paper)에 사용되며, GL(총계정원장)과 대사(Reconciliation)하는 데 활용됩니다.

[추출 규칙]
1. transactionType (거래유형)
   - "취득" 또는 "처분" 중 하나
   - 자산 계정이 차변에 있으면 "취득", 대변에 있으면 "처분"

2. transactionDate (거래일자)
   - YYYY-MM-DD 형식
   - GL 대사를 위한 Key 값

3. assetCategory (자산분류)
   - 계정과목 기준 분류
   - 예: "건물", "기계장치", "차량운반구", "비품", "소프트웨어" 등

4. itemDetail (품목상세) ★ 핵심 필드
   - 가능한 한 구체적인 모델명/품명 추출
   - 단순 "비품"이 아니라 "안마의자 바디프렌드 팬텀2", "맥북 프로 16인치 M3" 등
   - 업무 무관 자산 여부 판단에 사용됨
   - 적요, 품목명, 모델명 등에서 상세 정보 추출

5. counterparty (거래처)
   - 자산을 구입/판매한 상대방 회사명
   - GL 대사를 위한 Key 값

6. acquisitionCost (취득원가)
   - 숫자만 (콤마 없이)
   - 취득 시: 실제 취득금액 (공급가액 기준)
   - 처분 시: 해당 자산의 원래 취득원가 (알 수 있는 경우)

7. disposalPrice (처분가액)
   - 숫자만 (콤마 없이)
   - 처분 시에만 해당, 처분 대가로 받은 금액
   - 취득 건이면 null

8. accountCode (계정과목)
   - 전표상의 계정과목명
   - 예: "비품", "차량운반구", "유형자산처분손실" 등

9. slipNumber (전표번호)
   - 문서에 기재된 전표번호
   - GL 대사를 위한 Key 값

[중요]
- 이 데이터는 감사인이 '자산의 실재성 및 분류 적정성'을 판단하는 데 사용됩니다
- itemDetail(품목상세)을 최대한 구체적으로 추출해주세요 (업무 무관 자산 판단용)
- 문서에서 명확히 확인되지 않는 정보는 null로 표시`
  },

  withholdingTax: {
    label: '급여원천징수이행상황신고서',
    fields: ['companyDivision', 'attributionYearMonth', 'paymentYearMonth', 'numberOfPeople', 'totalPayment', 'incomeTax', 'localIncomeTax'],
    prompt: `당신은 원천징수 문서 분석 전문가입니다. 아래 문서는 원천징수이행상황신고서 또는 원천징수영수증입니다. 핵심 정보를 정확하게 추출해주세요.

[문서 유형]
- 원천징수이행상황신고서: 사업자가 세무서에 제출하는 신고서. 귀속연월/지급연월/총지급액 명시됨
- 원천징수영수증: 사업자가 근로자에게 발급하는 영수증. 총급여액/소득세 명시됨

[추출 규칙]
0. companyDivision (사업장명/공장명)
   - 문서에 기재된 사업장 구분명 (공장명, 지점명 등)
   - 전체 회사명이 아닌 사업장 구분명만 추출
   - 예: "제1공장", "제3공장", "본사", "서울지점"
   - 사업장 구분이 없으면 회사명 전체 기재

1. attributionYearMonth (귀속년월) ★ 가장 중요 — 반드시 추출
   - YYYY-MM 형식
   - 아래 순서대로 문서 전체를 꼼꼼히 확인하세요:
     1) "귀속연월", "귀속년월", "귀 속 연 월" 텍스트 옆/아래에 적힌 연도+월
     2) 문서 상단의 "____년 ____월 귀속" 형태
     3) 표 셀 안의 귀속월 값
   - 날짜 형식 변환 (어떤 형식이든 YYYY-MM으로 변환):
     * "2025년 1월", "2025년 01월" → "2025-01"
     * "2025.01", "2025/01", "25.01" → "2025-01"
     * "25년 1월", "25년 01월" → "2025-01"
     * 연도와 월이 분리된 칸에 있는 경우도 합쳐서 추출
   - 이 값이 null이면 이후 모든 크로스체크가 불가능합니다. 반드시 찾아내세요.
   - 예: "2025-01"

2. paymentYearMonth (지급연월) ★ 반드시 추출
   - YYYY-MM 형식
   - "지급연월", "지급년월", "지 급 연 월" 텍스트 옆/아래의 연도+월
   - 날짜 형식 변환은 귀속년월과 동일
   - 명시되지 않은 경우에만 귀속년월의 다음 달로 설정 (예: 귀속 2025-01 → "2025-02")
   - 예: "2025-02"

3. numberOfPeople (인원수)
   - 숫자만
   - 이행상황신고서: 신고서의 인원 수
   - 원천징수영수증: 1 (개인별 발급)

4. totalPayment (총 지급액)
   - 숫자만 (콤마 없이)
   - 이행상황신고서: "총지급액" 항목
   - 원천징수영수증: "총급여액" 또는 "급여총액" 항목
   - 예: 264000000

5. incomeTax (소득세)
   - 숫자만 (콤마 없이)
   - 예: 20420000

6. localIncomeTax (지방소득세)
   - 숫자만 (콤마 없이)
   - 소득세의 10%로 계산
   - 예: incomeTax가 20420000이면 localIncomeTax는 2042000

[중요]
- 원천징수영수증도 이 템플릿으로 처리합니다
- 지방소득세는 소득세의 10%입니다
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

6. totalAmount (합계 금액) ★ 핵심 필드 - 정확하게 추출!
   - 형식: "한글금액(숫자원, VAT 별도/포함)"
   - 반드시 문서에 기재된 합계금액을 정확히 읽을 것
   - 한글 금액이 있으면 한글을 숫자로 정확히 변환:
     * 이천육백사십만원 = 26,400,000원
     * 오천만원 = 50,000,000원
     * 일억원 = 100,000,000원
   - 예: "이천육백사십만원(26,400,000원, VAT 포함)"
   - 주의: 한글 금액과 숫자 금액이 일치해야 함!

7. validityPeriod (견적 유효기간)
   - 예: "견적일로부터 30일", "2025-02-28까지"

[중요]
- 금액 추출 시 한글 금액을 정확히 숫자로 변환할 것!
  * 만 = 10,000
  * 십만 = 100,000
  * 백만 = 1,000,000
  * 천만 = 10,000,000
  * 억 = 100,000,000
- 문서에서 명확히 확인되지 않는 정보는 null로 표시`
  },

  payroll: {
    label: '급여대장',
    fields: ['companyDivision', 'paymentYearMonth', 'paymentDate', 'companyName', 'employees', 'totalNetPay', 'totalGrossPay'],
    prompt: `당신은 급여대장 분석 전문가입니다. 아래 급여대장(더존 등 회계프로그램 출력물)에서 핵심 정보를 정확하게 추출해주세요.

[추출 규칙]
0. companyDivision (사업장명/공장명)
   - 급여대장에 기재된 사업장 또는 공장 구분명
   - 예: "제1공장", "제3공장", "본사"
   - 명시되지 않으면 companyName과 동일하게 기재

1. paymentYearMonth (귀속년월)
   - YYYY-MM 형식
   - 예: "2025-01"

2. paymentDate (지급일)
   - YYYY-MM-DD 형식
   - 급여 지급일

3. companyName (회사명)
   - 급여를 지급하는 회사명

4. employees (직원 목록) ★ 핵심 필드
   - 배열 형식으로 모든 직원 정보 추출
   - 각 직원: name(성명), baseSalary(기본급), allowances(수당합계), grossPay(지급총액), deductions(공제총액), netPay(실지급액)
   - netPay(실지급액)가 가장 중요! 반드시 추출할 것

   예시:
   [
     { "name": "홍길동", "baseSalary": 3000000, "allowances": 500000, "grossPay": 3500000, "deductions": 400000, "netPay": 3100000 },
     { "name": "김철수", "baseSalary": 2800000, "allowances": 300000, "grossPay": 3100000, "deductions": 350000, "netPay": 2750000 }
   ]

5. totalNetPay (실지급액 합계)
   - 모든 직원의 실지급액(netPay) 합계
   - 숫자만 (콤마 없이)
   - 예: 25800000

6. totalGrossPay (총지급액 합계)
   - 모든 직원의 지급총액(grossPay) 합계 (공제 전 금액)
   - 숫자만 (콤마 없이)
   - 원천징수이행상황신고서의 총지급액과 비교하는 데 사용됨
   - 예: 29800000

[응답 형식]
{
  "paymentYearMonth": "2025-01",
  "paymentDate": "2025-01-25",
  "companyName": "주식회사 OO",
  "employees": [
    { "name": "홍길동", "baseSalary": 3000000, "allowances": 500000, "grossPay": 3500000, "deductions": 400000, "netPay": 3100000 },
    { "name": "김철수", "baseSalary": 2800000, "allowances": 300000, "grossPay": 3100000, "deductions": 350000, "netPay": 2750000 }
  ],
  "totalNetPay": 5850000,
  "totalGrossPay": 6600000
}

[중요]
- 실지급액(netPay)은 급여 크로스체크에 사용되므로 정확하게 추출
- 모든 직원을 빠짐없이 추출
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
- withholdingTax: 급여원천징수이행상황신고서 또는 원천징수영수증 (급여 관련 원천징수 문서)
- estimate: 견적서
- payroll: 급여대장 (급여명세서, 급여지급내역, 급여대장 등)

JSON 형식으로 응답해주세요: { "documentType": "선택한유형" }`
