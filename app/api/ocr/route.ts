import { NextRequest, NextResponse } from 'next/server'
import { extractTextFromImage, extractDocumentText } from '@/lib/googleOcr'

export async function POST(request: NextRequest) {
  try {
    const { images, useDocumentMode } = await request.json()

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json(
        { error: '이미지가 필요합니다.' },
        { status: 400 }
      )
    }

    console.log('=== Google OCR API 호출 ===')
    console.log('이미지 수:', images.length)
    console.log('문서 모드:', useDocumentMode ? 'Yes' : 'No')

    const textParts: string[] = []

    for (let i = 0; i < images.length; i++) {
      const { base64 } = images[i]
      console.log('페이지 ' + (i + 1) + ' 처리 중...')

      let text: string
      if (useDocumentMode) {
        text = await extractDocumentText(base64)
      } else {
        text = await extractTextFromImage(base64)
      }

      if (text) {
        textParts.push('[페이지 ' + (i + 1) + ']\n' + text)
      }
    }

    const fullText = textParts.join('\n\n')
    console.log('=== OCR 완료 ===')
    console.log('총 추출 텍스트 길이:', fullText.length)

    return NextResponse.json({ text: fullText })
  } catch (error) {
    console.error('Google OCR 오류:', error)
    return NextResponse.json(
      { error: 'OCR 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
