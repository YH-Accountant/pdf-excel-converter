import Anthropic from '@anthropic-ai/sdk'
import { DocumentType } from '@/app/single/page'
import { documentTemplates, documentTypeDetectionPrompt } from './templates'
import { validateAmountFields } from './amountUtils'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// 문서 유형 자동 인식
export async function detectDocumentType(base64Image: string, mediaType: string): Promise<DocumentType> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: base64Image,
            },
          },
          {
            type: 'text',
            text: documentTypeDetectionPrompt,
          },
        ],
      },
    ],
  })

  const textContent = response.content.find((c) => c.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('문서 유형을 인식할 수 없습니다.')
  }

  try {
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return parsed.documentType as DocumentType
    }
  } catch {
    // JSON 파싱 실패 시 텍스트에서 직접 추출
    const types: DocumentType[] = [
      'contract', 'taxInvoice', 'tradingStatement',
      'bankStatement', 'withholdingTax', 'estimate'
    ]
    for (const type of types) {
      if (textContent.text.includes(type)) {
        return type
      }
    }
  }

  return 'contract' // 기본값
}

// 단일 이미지에서 정보 추출
export async function extractDocumentData(
  base64Image: string,
  mediaType: string,
  documentType: DocumentType
): Promise<Record<string, string | number | null>> {
  const template = documentTemplates[documentType]

  // 템플릿이 없으면 기본값(계약서) 사용
  if (!template) {
    console.warn(`알 수 없는 문서 유형: ${documentType}, 계약서로 처리합니다.`)
    const defaultTemplate = documentTemplates['contract']
    return extractWithTemplate([{ base64: base64Image, mediaType }], defaultTemplate)
  }

  return extractWithTemplate([{ base64: base64Image, mediaType }], template)
}

// 여러 이미지에서 정보 추출 (모든 페이지를 한 번에 전송)
export async function extractFromMultipleImages(
  images: { base64: string; mediaType: string }[],
  documentType: DocumentType
): Promise<Record<string, string | number | null>> {
  const template = documentTemplates[documentType]

  if (!template) {
    console.warn(`알 수 없는 문서 유형: ${documentType}, 계약서로 처리합니다.`)
    const defaultTemplate = documentTemplates['contract']
    return extractWithTemplate(images, defaultTemplate)
  }

  return extractWithTemplate(images, template)
}

// PDF에서 직접 추출한 텍스트로 정보 추출 (이미지 변환 없이)
export async function extractFromText(
  pdfText: string,
  documentType: DocumentType
): Promise<Record<string, string | number | null>> {
  const template = documentTemplates[documentType]

  if (!template) {
    console.warn(`알 수 없는 문서 유형: ${documentType}, 계약서로 처리합니다.`)
    const defaultTemplate = documentTemplates['contract']
    return extractWithTextTemplate(pdfText, defaultTemplate)
  }

  return extractWithTextTemplate(pdfText, template)
}

// 텍스트에서 문서 유형 자동 인식
export async function detectDocumentTypeFromText(pdfText: string): Promise<DocumentType> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `다음 문서 텍스트를 분석하여 문서 유형을 판단해주세요.

문서 내용:
${pdfText.slice(0, 3000)}

${documentTypeDetectionPrompt}`,
      },
    ],
  })

  const textContent = response.content.find((c) => c.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('문서 유형을 인식할 수 없습니다.')
  }

  try {
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return parsed.documentType as DocumentType
    }
  } catch {
    const types: DocumentType[] = [
      'contract', 'taxInvoice', 'tradingStatement',
      'bankStatement', 'withholdingTax', 'estimate'
    ]
    for (const type of types) {
      if (textContent.text.includes(type)) {
        return type
      }
    }
  }

  return 'contract'
}

// 문서 섹션 정보 타입
export interface DocumentSection {
  documentType: DocumentType
  startIndex: number
  endIndex: number
  text: string
}

// 텍스트에서 여러 문서 유형 감지 (PDF 내 복합 증빙 처리)
export async function detectMultipleDocumentTypesFromText(pdfText: string): Promise<DocumentSection[]> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `다음 PDF 텍스트에 여러 종류의 증빙 문서가 포함되어 있는지 분석해주세요.

=== 문서 텍스트 ===
${pdfText}
=== 텍스트 끝 ===

[분석 요청]
1. 이 PDF에 포함된 모든 증빙 문서 유형을 식별해주세요.
2. 각 문서의 시작과 끝 위치(대략적인 텍스트 구간)를 파악해주세요.
3. 하나의 PDF에 여러 유형의 증빙이 섞여 있을 수 있습니다.

[증빙 문서 유형]
- taxInvoice: 전자세금계산서 ("전자세금계산서" 명칭, 승인번호, 양측 사업자등록번호, 작성일자, 공급가액/세액)
- tradingStatement: 거래명세서 (품목·수량·단가 나열 + 인수자/인계자, 납품, 영수/청구 등 실제 거래 증빙 표현)
- contract: 계약서 (갑·을 호칭, 조항 번호(제1조...), 서명/날인란, 계약금액)
- bankStatement: 통장입출금내역, 이체확인증, 거래내역조회 (이체일시/거래일시, 출금/입금계좌, 은행명, 이체금액, 잔액)
- withholdingTax: 원천징수이행상황신고서 (귀속연월+지급연월 함께 표기, 소득구분(근로/사업 등), 징수의무자, 원천징수세액 집계)
- estimate: 견적서 (품목·수량·단가 나열 + 유효기간, 견적일, 귀하/귀중 등 거래 성립 전 제안 표현)
- payroll: 급여대장 (직원별 행 나열, 기본급·수당, 4대보험 공제액, 차인지급액(실지급액))

[중요 구분 기준]
- 위 괄호 안 단서는 우선 근거일 뿐, 단서가 없다고 해당 유형을 배제하지 말 것 (문서 전체로 종합 판단)
- payroll(급여대장): 직원 이름(또는 사번)별로 금액이 나열됨. 귀속월은 급여대장에도 나오므로
  귀속연월만으로 withholdingTax로 판단하지 말 것 — 소득구분·징수의무자가 있으면 withholdingTax
- tradingStatement vs estimate: 표 구조가 같으므로 거래의 성립 여부로 구분.
  인수자/납품/영수·청구(거래 완료) → tradingStatement / 유효기간·견적일·귀하(제안 단계) → estimate
- bankStatement(통장내역): 이체확인증, 거래내역조회, 계좌 입출금 내역
- contract vs estimate: 제목이 아니라 문서의 법적 상태로 판단.
  쌍방 기명날인·합의 완료 → contract / 유효기간·제안 등 회신 대기 상태(미체결) → estimate

[응답 형식]
JSON 배열로 응답해주세요:
{
  "documents": [
    {
      "documentType": "taxInvoice",
      "description": "전자세금계산서 - (주)ABC에서 발행",
      "approximateLocation": "문서 상단 ~ 중간"
    },
    {
      "documentType": "tradingStatement",
      "description": "거래명세서 - (주)ABC 3월분",
      "approximateLocation": "문서 중간 ~ 하단"
    }
  ]
}

만약 하나의 문서 유형만 있다면 배열에 하나만 포함하세요.`,
      },
    ],
  })

  const textContent = response.content.find((c) => c.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('문서 유형을 인식할 수 없습니다.')
  }

  console.log('=== 다중 문서 유형 감지 응답 ===')
  console.log(textContent.text)
  console.log('==================')

  try {
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      const documents = parsed.documents || []

      // DocumentSection 배열로 변환
      const sections: DocumentSection[] = documents.map((doc: any, index: number) => ({
        documentType: doc.documentType as DocumentType,
        startIndex: index * Math.floor(pdfText.length / documents.length),
        endIndex: (index + 1) * Math.floor(pdfText.length / documents.length),
        text: pdfText, // 전체 텍스트 (추후 분리 로직에서 사용)
      }))

      return sections.length > 0 ? sections : [{
        documentType: 'contract',
        startIndex: 0,
        endIndex: pdfText.length,
        text: pdfText
      }]
    }
  } catch (e) {
    console.error('다중 문서 감지 파싱 오류:', e)
  }

  // 파싱 실패 시 단일 문서로 처리
  return [{ documentType: 'contract', startIndex: 0, endIndex: pdfText.length, text: pdfText }]
}

// 각 문서 유형별로 텍스트에서 정보 추출 (다중 문서 처리)
export async function extractMultipleDocumentsFromText(
  pdfText: string,
  documentTypes: DocumentType[]
): Promise<{ documentType: DocumentType; fields: Record<string, any> }[]> {
  const results: { documentType: DocumentType; fields: Record<string, any> }[] = []

  for (const docType of documentTypes) {
    const template = documentTemplates[docType]
    if (!template) continue

    const fields: Record<string, any> = await extractWithTextTemplateForType(pdfText, template)

    if (fields && Object.keys(fields).some(k => fields[k] !== null)) {
      results.push({ documentType: docType, fields })
    }
  }

  return results
}

// 특정 문서 유형에 맞는 정보만 추출
async function extractWithTextTemplateForType(
  pdfText: string,
  template: { label: string; fields: string[]; prompt: string }
): Promise<Record<string, string | number | null>> {
  console.log(`=== ${template.label} 추출 시작 ===`)

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `다음 PDF 텍스트에서 "${template.label}" 정보만 추출해주세요.
이 PDF에는 여러 종류의 증빙이 섞여 있을 수 있습니다. "${template.label}"에 해당하는 내용만 찾아서 추출하세요.

=== 문서 텍스트 ===
${pdfText}
=== 텍스트 끝 ===

${template.prompt}

[중요 지침]
1. "${template.label}"에 해당하는 정보만 추출하세요.
2. 해당 문서 유형이 없으면 모든 필드를 null로 반환하세요.
3. 다른 유형의 증빙 정보는 무시하세요.

JSON 형식으로 응답해주세요.`,
      },
    ],
  })

  const textContent = response.content.find((c) => c.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    return {}
  }

  try {
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return validateAmountFields(parsed)
    }
  } catch (e) {
    console.error(`${template.label} 파싱 오류:`, e)
  }

  return {}
}

// 텍스트 기반 템플릿 추출 (다중 문서 처리에서도 사용)
export async function extractWithTextTemplate(
  pdfText: string,
  template: { label: string; fields: string[]; prompt: string }
): Promise<Record<string, string | number | null>> {
  console.log('=== PDF 텍스트 기반 추출 시작 ===')
  console.log('텍스트 길이:', pdfText.length)

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `다음은 PDF 문서에서 직접 추출한 텍스트입니다. 이 텍스트를 분석하여 정보를 추출해주세요.

=== 문서 텍스트 ===
${pdfText}
=== 텍스트 끝 ===

${template.prompt}

[중요 지침]
1. 위 텍스트에서 정확히 기재된 내용만 추출하세요.
2. 금액의 경우 한글 금액(예: 육십억원)과 숫자 금액(예: 6,000,000,000원)이 있으면 반드시 둘 다 확인하여 일치하는지 검증하세요.
3. 한글 금액이 기준입니다. 한글 금액을 우선으로 추출하고, 괄호 안에 숫자를 포함하세요.
4. 문서에 명시되지 않은 정보는 null로 표시하세요.

JSON 형식으로 응답해주세요.
예시 형식: { "fieldName": "값" }`,
      },
    ],
  })

  const textContent = response.content.find((c) => c.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('정보를 추출할 수 없습니다.')
  }

  console.log('=== Claude 응답 (텍스트 기반) ===')
  console.log(textContent.text)
  console.log('==================')

  try {
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      console.log('=== 파싱된 JSON (검증 전) ===')
      console.log(parsed)

      const validated = validateAmountFields(parsed)
      console.log('=== 검증된 JSON (검증 후) ===')
      console.log(validated)
      console.log('==================')
      return validated
    }
  } catch (e) {
    console.error('JSON 파싱 오류:', e)
  }

  console.log('=== 파싱 실패, 빈 객체 반환 ===')
  const emptyResult: Record<string, null> = {}
  template.fields.forEach((field) => {
    emptyResult[field] = null
  })
  return emptyResult
}

// 템플릿으로 추출 (여러 이미지 지원)
async function extractWithTemplate(
  images: { base64: string; mediaType: string }[],
  template: { label: string; fields: string[]; prompt: string }
): Promise<Record<string, string | number | null>> {

  // 여러 이미지를 content 배열에 추가
  const contentParts: Anthropic.ContentBlockParam[] = []

  // 모든 이미지 추가
  images.forEach((img) => {
    contentParts.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: img.mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
        data: img.base64,
      },
    })
  })

  // 프롬프트 추가
  const pageInfo = images.length > 1 ? `\n\n[중요] 위 ${images.length}개 이미지는 동일한 문서의 연속된 페이지입니다. 모든 페이지를 종합하여 정보를 추출해주세요.` : ''

  contentParts.push({
    type: 'text',
    text: `${template.prompt}${pageInfo}

[중요 지침 - 이미지 기반 추출]
1. 이미지의 모든 텍스트를 매우 주의깊게 읽어주세요. 글자 하나하나를 정확히 확인하세요.
2. 금액 추출 시 특히 주의하세요:
   - 한글 금액(예: 육십억원)과 숫자 금액(예: 6,000,000,000원)이 모두 있으면 반드시 둘 다 확인
   - 한글 금액이 기준입니다. 한글 금액을 우선으로 추출하고, 괄호 안에 숫자를 포함하세요
   - "육십억"과 "육억"은 완전히 다른 금액입니다 (60억 vs 6억)
3. 추측하지 마세요. 문서에 실제로 보이는 내용만 추출하세요.
4. 글자가 불명확하거나 읽기 어려운 경우 null을 반환하세요.
5. 회사명, 금액, 날짜 등 핵심 정보는 여러 번 확인 후 추출하세요.

JSON 형식으로 응답해주세요. 찾을 수 없는 정보는 null로 표시하세요.
예시 형식: { "fieldName": "값" }`,
  })

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: contentParts,
      },
    ],
  })

  const textContent = response.content.find((c) => c.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('정보를 추출할 수 없습니다.')
  }

  // 디버깅: Claude 응답 로그
  console.log('=== Claude 응답 ===')
  console.log(textContent.text)
  console.log('==================')

  try {
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      console.log('=== 파싱된 JSON (검증 전) ===')
      console.log(parsed)

      // 금액 필드 검증 및 교정
      const validated = validateAmountFields(parsed)
      console.log('=== 검증된 JSON (검증 후) ===')
      console.log(validated)
      console.log('==================')
      return validated
    }
  } catch (e) {
    console.error('JSON 파싱 오류:', e)
  }

  // 파싱 실패 시 빈 객체 반환
  console.log('=== 파싱 실패, 빈 객체 반환 ===')
  const emptyResult: Record<string, null> = {}
  template.fields.forEach((field) => {
    emptyResult[field] = null
  })
  return emptyResult
}
