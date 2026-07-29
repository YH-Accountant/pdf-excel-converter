import { NextRequest, NextResponse } from 'next/server'
import { detectDocumentType, detectDocumentTypeFromText, detectMultipleDocumentTypesFromText, extractFromMultipleImages, extractFromText, extractMultipleDocumentsFromText } from '@/lib/claude'
import { DocumentType } from '@/app/single/page'
import { validateAndFixContractAmount } from '@/lib/koreanAmount'
import { groundAmountFields } from '@/lib/grounding'

// 금액 필드 검증 및 수정 (계약서, 견적서)
function postProcessFields(documentType: DocumentType, fields: Record<string, any>): Record<string, any> {
  // 계약서 금액 검증
  if (documentType === 'contract' && fields.contractAmount) {
    const originalAmount = fields.contractAmount
    const fixedAmount = validateAndFixContractAmount(String(fields.contractAmount))
    if (originalAmount !== fixedAmount) {
      console.log(`[계약서 금액 자동 수정] "${originalAmount}" -> "${fixedAmount}"`)
    }
    fields.contractAmount = fixedAmount
  }

  // 견적서 금액 검증
  if (documentType === 'estimate' && fields.totalAmount) {
    const originalAmount = fields.totalAmount
    const fixedAmount = validateAndFixContractAmount(String(fields.totalAmount))
    if (originalAmount !== fixedAmount) {
      console.log(`[견적서 금액 자동 수정] "${originalAmount}" -> "${fixedAmount}"`)
    }
    fields.totalAmount = fixedAmount
  }

  return fields
}

// 근거 검증: AI가 반환한 금액이 원문에 실제로 있는지 대조하고,
// 없는 값은 null로 버린 뒤 경고 문구를 모아 반환한다 (lib/grounding.ts)
function applyGrounding(
  documentType: DocumentType,
  fields: Record<string, any>,
  sourceText: string | undefined,
  warnings: string[]
): Record<string, any> {
  if (!sourceText) return fields
  const { fields: grounded, dropped } = groundAmountFields(documentType, fields, sourceText)
  for (const { field, value } of dropped) {
    const message = `${documentType}.${field}: 추출값 ${value}이(가) 원문에 없어 제외했습니다 (AI 생성 의심)`
    console.warn(`[근거 검증] ${message}`)
    warnings.push(message)
  }
  return grounded
}

// 같은 유형의 문서가 한 파일에 여러 건 들어있는 경우(여러 달치 이체확인증·원천징수신고서 등),
// AI는 템플릿 지시에 따라 { isMultipleDocuments: true, documents: [...] } 형태로 반환한다.
// 이 응답은 단일 문서의 fields 자리에 담겨 오므로, 소비자(batch/payroll)가 읽는 최상위로 승격한다.
// (승격하지 않으면 여러 달치가 fields 안에 묻혀 1건으로만 처리된다)
function buildExtractionResponse(
  documentType: DocumentType,
  rawFields: Record<string, any>,
  extractionMethod: string,
  sourceText?: string
) {
  const warnings: string[] = []

  if (rawFields?.isMultipleDocuments && Array.isArray(rawFields.documents)) {
    const documents = rawFields.documents.map((doc: any) => {
      const type = (doc?.documentType || documentType) as DocumentType
      const grounded = applyGrounding(type, doc?.fields || {}, sourceText, warnings)
      return { documentType: type, fields: postProcessFields(type, grounded) }
    })
    console.log(`=== 동일 유형 다중 문서 승격: ${documentType} ${documents.length}건 ===`)
    return NextResponse.json({
      isMultipleDocuments: true,
      documents,
      extractionMethod: `${extractionMethod}-multi`,
      ...(warnings.length > 0 && { groundingWarnings: warnings }),
    })
  }

  const grounded = applyGrounding(documentType, rawFields, sourceText, warnings)
  return NextResponse.json({
    documentType,
    fields: postProcessFields(documentType, grounded),
    extractionMethod,
    ...(warnings.length > 0 && { groundingWarnings: warnings }),
  })
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const fileCount = parseInt(formData.get('fileCount') as string) || 0
    const documentTypeParam = formData.get('documentType') as DocumentType | null
    const pdfText = formData.get('pdfText') as string | null

    // 파일 수집
    const files: File[] = []
    for (let i = 0; i < fileCount; i++) {
      const file = formData.get(`file${i}`) as File | null
      if (file) {
        files.push(file)
      }
    }

    // 단일 파일 호환성 유지
    if (files.length === 0) {
      const singleFile = formData.get('file') as File | null
      if (singleFile) {
        files.push(singleFile)
      }
    }

    if (files.length === 0 && !pdfText) {
      return NextResponse.json(
        { error: '파일이 필요합니다.' },
        { status: 400 }
      )
    }

    // PDF 텍스트가 있으면 텍스트 기반 추출 사용 (더 정확함)
    if (pdfText && pdfText.length > 100) {
      console.log('=== 텍스트 기반 추출 모드 ===')

      // 사용자가 문서 유형을 지정한 경우: 단일 문서 추출
      if (documentTypeParam) {
        const rawFields = await extractFromText(pdfText, documentTypeParam)
        return buildExtractionResponse(documentTypeParam, rawFields, 'text', pdfText)
      }

      // 문서 유형 미지정: 다중 문서 유형 감지 시도
      console.log('=== 다중 문서 유형 감지 시작 ===')
      const documentSections = await detectMultipleDocumentTypesFromText(pdfText)
      const detectedTypes = [...new Set(documentSections.map(s => s.documentType))]
      console.log('감지된 문서 유형들:', detectedTypes)

      // 여러 문서 유형이 감지된 경우: 각 유형별로 추출
      if (detectedTypes.length > 1) {
        console.log('=== 복합 증빙 PDF - 다중 추출 모드 ===')
        const multipleResults = await extractMultipleDocumentsFromText(pdfText, detectedTypes)

        // 후처리 (근거 검증 → 금액 검증)
        const warnings: string[] = []
        const processedResults = multipleResults.map(result => {
          const grounded = applyGrounding(result.documentType, result.fields, pdfText, warnings)
          return {
            documentType: result.documentType,
            fields: postProcessFields(result.documentType, grounded),
          }
        })

        return NextResponse.json({
          isMultipleDocuments: true,
          documents: processedResults,
          extractionMethod: 'text-multi',
          ...(warnings.length > 0 && { groundingWarnings: warnings }),
        })
      }

      // 단일 문서 유형만 감지된 경우 (같은 유형이 여러 건이면 buildExtractionResponse가 분리)
      const documentType = detectedTypes[0] || await detectDocumentTypeFromText(pdfText)
      const rawFields = await extractFromText(pdfText, documentType)
      return buildExtractionResponse(documentType, rawFields, 'text', pdfText)
    }

    // 이미지 기반 추출 (fallback)
    console.log('=== 이미지 기반 추출 모드 ===')
    const images: { base64: string; mediaType: string }[] = []

    for (const file of files) {
      // PDF인 경우 에러 (클라이언트에서 이미지로 변환되어야 함)
      if (file.type === 'application/pdf') {
        return NextResponse.json(
          { error: 'PDF는 클라이언트에서 이미지로 자동 변환됩니다. 잠시만 기다려주세요...' },
          { status: 400 }
        )
      }

      // 이미지 타입 검증
      if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'text/plain'].includes(file.type)) {
        return NextResponse.json(
          { error: `지원하지 않는 파일 형식입니다: ${file.name} (PNG, JPG, GIF, WEBP 지원)` },
          { status: 400 }
        )
      }

      // text/plain은 텍스트 추출 성공한 PDF (표시용)
      if (file.type === 'text/plain') {
        continue
      }

      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      images.push({
        base64: buffer.toString('base64'),
        mediaType: file.type,
      })
    }

    if (images.length === 0) {
      return NextResponse.json(
        { error: '이미지 파일이 필요합니다.' },
        { status: 400 }
      )
    }

    // 문서 유형 결정 (첫 번째 이미지로 판단)
    let documentType: DocumentType
    if (documentTypeParam) {
      documentType = documentTypeParam
    } else {
      documentType = await detectDocumentType(images[0].base64, images[0].mediaType)
    }

    // 모든 이미지를 한 번에 Claude에 전송하여 정보 추출
    let fields = await extractFromMultipleImages(images, documentType)

    // 후처리: 금액 검증 및 수정
    fields = postProcessFields(documentType, fields)

    return NextResponse.json({
      documentType,
      fields,
      pageCount: images.length,
      extractionMethod: 'image',
    })
  } catch (error) {
    console.error('추출 오류:', error)
    // Anthropic SDK 오류는 상태 코드를 갖고 있다. 속도 제한(429)·과부하(529)는
    // 잠시 뒤 재시도하면 성공하는 일시적 오류이므로, 500으로 뭉개지 않고
    // 그대로 전달해 클라이언트가 재시도 가능 여부를 판단할 수 있게 한다.
    const upstreamStatus = (error as { status?: unknown })?.status
    const status =
      typeof upstreamStatus === 'number' && upstreamStatus >= 400 && upstreamStatus <= 599
        ? upstreamStatus
        : 500
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '추출 중 오류가 발생했습니다.' },
      { status }
    )
  }
}
