'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import * as pdfjsLib from 'pdfjs-dist'
import XLSX from 'xlsx-js-style'

interface PayrollEmployee {
  name: string
  netPay: number
}

interface BankTransaction {
  date: string
  description: string
  withdrawal: number
  matchedEmployee?: string
}

interface PayrollData {
  companyDivision: string
  yearMonth: string
  paymentDate: string
  employees: PayrollEmployee[]
  totalNetPay: number
  totalGrossPay: number
}

interface BankData {
  companyDivision?: string
  transactions: BankTransaction[]
  totalWithdrawal: number
  transferDate?: string
  transferMonth?: string
}

interface WithholdingData {
  companyDivision: string
  attributionYearMonth: string
  paymentYearMonth: string
  numberOfPeople: number
  totalPayment: number
  incomeTax: number
  localIncomeTax: number
}

interface MatchResult {
  name: string
  payrollAmount: number
  bankAmount: number
  difference: number
  isMatched: boolean
}

interface MonthGroup {
  groupKey: string
  companyDivision: string
  attributionMonth: string
  paymentMonth: string
  withholding: WithholdingData | null
  payroll: PayrollData | null
  bankList: BankData[]
  payrollTotal: number
  bankTotal: number
  withholdingTotal: number
  payrollGrossTotal: number
  difference: number
  isMatched: boolean
  attributionMonthMatched: boolean
  paymentMonthMatched: boolean
  withholdingMatchesGross: boolean
  individualMatches: MatchResult[]
}

interface ProcessingFile {
  file: File
  status: 'pending' | 'processing' | 'completed' | 'error'
  result?: any
  documentType?: string
  error?: string
}

export default function PayrollPage() {
  const [files, setFiles] = useState<ProcessingFile[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [monthGroups, setMonthGroups] = useState<MonthGroup[]>([])
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const initialized = useRef(false)

  useEffect(() => {
    if (!initialized.current && typeof window !== 'undefined') {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs`
      initialized.current = true
    }
  }, [])

  const extractTextFromPdf = async (pdfFile: File): Promise<string> => {
    const arrayBuffer = await pdfFile.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({
      data: arrayBuffer,
      cMapUrl: 'https://unpkg.com/pdfjs-dist@4.10.38/cmaps/',
      cMapPacked: true,
      useSystemFonts: true,
      standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@4.10.38/standard_fonts/',
    }).promise
    let fullText = ''
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()
      fullText += `[페이지 ${i}]\n${textContent.items.map((item: any) => item.str).join(' ')}\n\n`
    }
    return fullText
  }

  const convertPdfToBase64Images = async (pdfFile: File): Promise<{ base64: string; mediaType: string }[]> => {
    const arrayBuffer = await pdfFile.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    const images: { base64: string; mediaType: string }[] = []
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const scale = 3
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')!
      canvas.height = viewport.height
      canvas.width = viewport.width
      await page.render({ canvasContext: context, viewport }).promise
      images.push({ base64: canvas.toDataURL('image/png').split(',')[1], mediaType: 'image/png' })
    }
    return images
  }

  const convertImageToBase64 = async (imageFile: File): Promise<{ base64: string; mediaType: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        resolve({ base64: result.split(',')[1], mediaType: imageFile.type })
      }
      reader.onerror = reject
      reader.readAsDataURL(imageFile)
    })
  }

  const callGoogleOcr = async (images: { base64: string; mediaType: string }[]): Promise<string> => {
    const response = await fetch('/api/ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images, useDocumentMode: true }),
    })
    if (!response.ok) throw new Error('OCR 처리 실패')
    const data = await response.json()
    return data.text
  }

  const isValidFile = (file: File): boolean => {
    const validTypes = [
      'application/pdf',
      'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ]
    const name = file.name.toLowerCase()
    return validTypes.includes(file.type) || name.endsWith('.xls') || name.endsWith('.xlsx')
  }

  const parseWithholdingDatesFromText = (text: string): { attributionYearMonth: string; paymentYearMonth: string } => {
    let attributionYearMonth = ''
    let paymentYearMonth = ''

    const attrMatch =
      text.match(/귀\s*속\s*연\s*월[^0-9]*(\d{4})\s*년\s*(\d{1,2})\s*월/) ||
      text.match(/귀\s*속\s*연\s*월[^0-9]*(\d{4})[-./](\d{1,2})/) ||
      text.match(/귀속[^0-9]{0,10}(\d{4})\s*년?\s*(\d{1,2})\s*월/)
    if (attrMatch) {
      attributionYearMonth = `${attrMatch[1]}-${String(parseInt(attrMatch[2])).padStart(2, '0')}`
    }

    const payMatch =
      text.match(/지\s*급\s*연\s*월[^0-9]*(\d{4})\s*년\s*(\d{1,2})\s*월/) ||
      text.match(/지\s*급\s*연\s*월[^0-9]*(\d{4})[-./](\d{1,2})/) ||
      text.match(/지급[^0-9]{0,10}(\d{4})\s*년?\s*(\d{1,2})\s*월/)
    if (payMatch) {
      paymentYearMonth = `${payMatch[1]}-${String(parseInt(payMatch[2])).padStart(2, '0')}`
    }

    return { attributionYearMonth, paymentYearMonth }
  }

  const parseBankTransfersFromOcrText = (text: string): Array<{ transactionDate: string; totalWithdrawal: number; companyDivision: string }> => {
    const results: Array<{ transactionDate: string; totalWithdrawal: number; companyDivision: string }> = []

    // 사업장명 추출: "(주)가상물산 제1공장" → "제1공장"
    const companyMatch = text.match(/\([주株]\)\s*[^\s\n]+\s+([가-힣]+(?:공장|본사|지사|센터|사업장))/)
    const companyDivision = companyMatch ? companyMatch[1].trim() : ''

    const pages = text.split(/===\s*페이지\s*\d+\s*===/).filter((p) => p.trim())
    for (const page of pages) {
      const dateMatch = page.match(/(\d{4}-\d{2}-\d{2})\s+\d{2}:\d{2}:\d{2}/)
      const amountMatch = page.match(/(\d+)건\s*\/\s*([\d,]+)원/)
      if (dateMatch && amountMatch) {
        results.push({
          transactionDate: dateMatch[1],
          totalWithdrawal: parseInt(amountMatch[2].replace(/,/g, ''), 10),
          companyDivision,
        })
      }
    }
    return results
  }

  const isExcelFile = (f: ProcessingFile): boolean => {
    const name = f.file.name.toLowerCase()
    return (
      f.file.type === 'application/vnd.ms-excel' ||
      f.file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      name.endsWith('.xls') || name.endsWith('.xlsx')
    )
  }

  const readExcelAsText = (file: File, targetAttributionYearMonth?: string): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = e.target?.result
          const wb = XLSX.read(data, { type: 'array' })
          const MAX_CHARS = 20000
          const sheetNames = wb.SheetNames

          const sheetMeta = sheetNames.map((sheetName) => {
            const ws = wb.Sheets[sheetName]
            const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][]
            const headerText = rows.slice(0, 5).flat().filter(Boolean).join(' ')
            const attrMatch = headerText.match(/귀속[^0-9]*(\d{4})년\s*(\d{1,2})월/)
            const payMatch = headerText.match(/지급[^0-9]*(\d{4})년\s*(\d{1,2})월/)
            let attributionYearMonth = attrMatch ? `${attrMatch[1]}-${attrMatch[2].padStart(2, '0')}` : ''
            if (!attributionYearMonth) {
              // 제2공장처럼 "귀속" 키워드 없이 "2025년 09월 급여 대장" 형태인 경우: 시트명 + 헤더 연도
              const sheetMonthMatch = sheetName.match(/(\d{1,2})월/)
              const yearMatch = headerText.match(/(\d{4})년/)
              if (sheetMonthMatch && yearMatch) {
                attributionYearMonth = `${yearMatch[1]}-${sheetMonthMatch[1].padStart(2, '0')}`
              }
            }
            return {
              sheetName,
              attributionYearMonth,
              paymentYearMonth: payMatch ? `${payMatch[1]}-${payMatch[2].padStart(2, '0')}` : '',
            }
          })

          let selectedMeta = sheetMeta[sheetMeta.length - 1]
          if (targetAttributionYearMonth) {
            const match = sheetMeta.find((m) => m.attributionYearMonth === targetAttributionYearMonth)
            if (match) selectedMeta = match
          }

          const ws = wb.Sheets[selectedMeta.sheetName]
          const csv = XLSX.utils.sheet_to_csv(ws)
          const metaSummary = sheetMeta.map((m) => `${m.sheetName}(귀속${m.attributionYearMonth || '?'})`).join(', ')

          let text =
            `[전체 시트: ${metaSummary}]\n` +
            `[선택된 시트: ${selectedMeta.sheetName} / 귀속: ${selectedMeta.attributionYearMonth || '?'} / 지급: ${selectedMeta.paymentYearMonth || '?'}]\n\n` +
            `[시트: ${selectedMeta.sheetName}]\n${csv}\n\n`

          if (text.length > MAX_CHARS) text = text.slice(0, MAX_CHARS) + '\n...(이하 생략)'
          resolve(text)
        } catch (err) {
          reject(err)
        }
      }
      reader.onerror = reject
      reader.readAsArrayBuffer(file)
    })

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const droppedFiles = Array.from(e.dataTransfer.files).filter(isValidFile)
    setFiles((prev) => [...prev, ...droppedFiles.map((file) => ({ file, status: 'pending' as const }))])
  }, [])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).filter(isValidFile)
      setFiles((prev) => [...prev, ...selectedFiles.map((file) => ({ file, status: 'pending' as const }))])
    }
  }

  const processFile = async (fileItem: ProcessingFile, targetAttributionYearMonth?: string, forceOcr = false): Promise<any> => {
    const formData = new FormData()

    if (fileItem.file.type === 'application/pdf') {
      const text = await extractTextFromPdf(fileItem.file)
      const contentOnly = text.replace(/\[페이지 \d+\]\s*/g, '').trim()
      const contentLength = contentOnly.length

      if (!forceOcr && contentLength >= 50) {
        formData.append('pdfText', text)
        formData.append('file0', new File([fileItem.file], fileItem.file.name, { type: 'text/plain' }))
        formData.append('fileCount', '1')
      } else {
        const images = await convertPdfToBase64Images(fileItem.file)
        const ocrText = await callGoogleOcr(images)
        if (ocrText && ocrText.length > 50) {
          formData.append('pdfText', ocrText)
          formData.append('file0', new File([fileItem.file], fileItem.file.name, { type: 'text/plain' }))
          formData.append('fileCount', '1')
        } else {
          for (let idx = 0; idx < images.length; idx++) {
            const img = images[idx]
            const binary = atob(img.base64)
            const array = new Uint8Array(binary.length)
            for (let j = 0; j < binary.length; j++) array[j] = binary.charCodeAt(j)
            const blob = new Blob([array], { type: 'image/png' })
            formData.append(`file${idx}`, new File([blob], fileItem.file.name.replace('.pdf', `_page${idx + 1}.png`), { type: 'image/png' }))
          }
          formData.append('fileCount', images.length.toString())
        }
      }
    } else if (isExcelFile(fileItem)) {
      const text = await readExcelAsText(fileItem.file, targetAttributionYearMonth)
      formData.append('pdfText', text)
      formData.append('file0', new File([fileItem.file], fileItem.file.name, { type: 'text/plain' }))
      formData.append('fileCount', '1')
    } else if (fileItem.file.type.startsWith('image/')) {
      const imageData = await convertImageToBase64(fileItem.file)
      const ocrText = await callGoogleOcr([imageData])
      if (ocrText && ocrText.length > 50) {
        formData.append('pdfText', ocrText)
        formData.append('file0', new File([fileItem.file], fileItem.file.name, { type: 'text/plain' }))
        formData.append('fileCount', '1')
      } else {
        formData.append('file0', fileItem.file)
        formData.append('fileCount', '1')
      }
    }

    const response = await fetch('/api/extract', { method: 'POST', body: formData })
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || '추출 실패')
    }
    return response.json()
  }

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  const runCrossCheck = async () => {
    if (files.length === 0) { setError('파일을 업로드해주세요.'); return }

    setIsProcessing(true)
    setError(null)
    setMonthGroups([])
    setExpandedMonth(null)

    const pendingFiles = files.filter((f) => f.status === 'pending')
    const excelFiles = pendingFiles.filter(isExcelFile)
    const nonExcelFiles = pendingFiles.filter((f) => !isExcelFile(f))

    // 원천징수 먼저 처리
    const sortedNonExcel = [...nonExcelFiles].sort((a, b) =>
      (a.file.name.toLowerCase().includes('원천') ? 0 : 1) -
      (b.file.name.toLowerCase().includes('원천') ? 0 : 1)
    )

    const withholdingList: WithholdingData[] = []
    const rawBankList: BankData[] = []

    try {
      // Phase 1: PDF/이미지 처리
      for (let i = 0; i < sortedNonExcel.length; i++) {
        const fileItem = sortedNonExcel[i]
        const fileIndex = files.findIndex((f) => f.file === fileItem.file)
        setFiles((prev) => prev.map((f, idx) => idx === fileIndex ? { ...f, status: 'processing' } : f))

        try {
          // 귀속/지급연월 추출: 텍스트 PDF는 직접 파싱, 이미지 PDF는 OCR 후 파싱
          let directParsedDates = { attributionYearMonth: '', paymentYearMonth: '' }
          let cachedOcrText: string | null = null
          if (fileItem.file.type === 'application/pdf') {
            const rawText = await extractTextFromPdf(fileItem.file)
            directParsedDates = parseWithholdingDatesFromText(rawText)

            // 텍스트에서 귀속연월 못 찾았고 이미지 PDF인 경우 → OCR 후 재시도
            if (!directParsedDates.attributionYearMonth) {
              const contentOnly = rawText.replace(/\[페이지 \d+\]\s*/g, '').trim()
              if (contentOnly.length < 50) {
                const images = await convertPdfToBase64Images(fileItem.file)
                const ocrText = await callGoogleOcr(images)
                if (ocrText) {
                  cachedOcrText = ocrText
                  directParsedDates = parseWithholdingDatesFromText(ocrText)
                }
              }
            }
          }

          let result = await processFile(fileItem)
          let documents = result.isMultipleDocuments ? result.documents : [result]

          // bankStatement 날짜 없으면 regex 직접 파싱 (금액만 있고 날짜 없는 경우도 포함)
          const needsOcrRetry = documents.some(
            (doc: any) =>
              doc.documentType === 'bankStatement' &&
              !doc.fields?.transactionDate &&
              !doc.fields?.transferDate
          )
          if (needsOcrRetry && fileItem.file.type === 'application/pdf') {
            // 캐시된 OCR 텍스트로 직접 파싱 (이체확인증 전용 regex)
            const ocrForParsing = cachedOcrText ?? await (async () => {
              const images = await convertPdfToBase64Images(fileItem.file)
              return callGoogleOcr(images)
            })()
            if (ocrForParsing) {
              const bankEntries = parseBankTransfersFromOcrText(ocrForParsing)
              if (bankEntries.length > 0) {
                console.log(`이체확인증 직접 파싱 성공: ${bankEntries.length}건`)
                documents = bankEntries.map((e) => ({
                  documentType: 'bankStatement',
                  fields: { transactionDate: e.transactionDate, totalWithdrawal: e.totalWithdrawal, companyDivision: e.companyDivision },
                }))
              } else {
                // regex도 실패 → Claude 마지막 시도
                result = await processFile(fileItem, undefined, true)
                documents = result.isMultipleDocuments ? result.documents : [result]
              }
            }
          }

          for (const doc of documents) {
            if (doc.documentType === 'withholdingTax') {
              withholdingList.push({
                companyDivision: doc.fields.companyDivision || '',
                attributionYearMonth: doc.fields.attributionYearMonth || directParsedDates.attributionYearMonth,
                paymentYearMonth: doc.fields.paymentYearMonth || directParsedDates.paymentYearMonth,
                numberOfPeople: doc.fields.numberOfPeople || 0,
                totalPayment: doc.fields.totalPayment || 0,
                incomeTax: doc.fields.incomeTax || 0,
                localIncomeTax: doc.fields.localIncomeTax || 0,
              })
            } else if (doc.documentType === 'bankStatement') {
              let totalWithdrawal = 0
              if (doc.fields.totalWithdrawal) {
                totalWithdrawal = typeof doc.fields.totalWithdrawal === 'number'
                  ? doc.fields.totalWithdrawal
                  : parseInt(String(doc.fields.totalWithdrawal).replace(/,/g, '')) || 0
              } else if (doc.fields.withdrawal) {
                totalWithdrawal = typeof doc.fields.withdrawal === 'number'
                  ? doc.fields.withdrawal
                  : parseInt(String(doc.fields.withdrawal).replace(/,/g, '')) || 0
              }
              const transferDateRaw = doc.fields.transactionDate || doc.fields.transferDate || ''
              const transferDateStr = String(transferDateRaw)
              const transferMonthMatch =
                transferDateStr.match(/(\d{4})[-./](0?[1-9]|1[0-2])/) ||
                transferDateStr.match(/(\d{4})년\s*(0?[1-9]|1[0-2])월/) ||
                transferDateStr.match(/(\d{4})(0[1-9]|1[0-2])\d{2}/)
              const transferMonth = transferMonthMatch
                ? `${transferMonthMatch[1]}-${String(parseInt(transferMonthMatch[2])).padStart(2, '0')}`
                : ''
              rawBankList.push({
                companyDivision: doc.fields.companyDivision || '',
                transactions: doc.fields.transactions || [],
                totalWithdrawal,
                transferDate: String(transferDateRaw),
                transferMonth,
              })
            }
          }

          setFiles((prev) => prev.map((f, idx) =>
            idx === fileIndex
              ? { ...f, status: 'completed', result, documentType: documents.map((d: any) => d.documentType).join(', ') }
              : f
          ))
        } catch (err) {
          setFiles((prev) => prev.map((f, idx) =>
            idx === fileIndex ? { ...f, status: 'error', error: (err as Error).message } : f
          ))
        }

        if (i < sortedNonExcel.length - 1) await delay(3000)
      }

      // Phase 2: 월별+사업장별 그룹 구성
      const groupMap = new Map<string, MonthGroup>()

      if (withholdingList.length > 0) {
        for (const w of withholdingList) {
          const key = w.attributionYearMonth || '__fallback__'
          let paymentMonth = w.paymentYearMonth
          if (!paymentMonth && w.attributionYearMonth) {
            const [yr, mo] = w.attributionYearMonth.split('-').map(Number)
            const nextMo = mo === 12 ? 1 : mo + 1
            const nextYr = mo === 12 ? yr + 1 : yr
            paymentMonth = `${nextYr}-${String(nextMo).padStart(2, '0')}`
          }
          groupMap.set(key, {
            groupKey: key,
            companyDivision: w.companyDivision || '',
            attributionMonth: w.attributionYearMonth,
            paymentMonth,
            withholding: w,
            payroll: null,
            bankList: [],
            payrollTotal: 0,
            bankTotal: 0,
            withholdingTotal: w.totalPayment || 0,
            payrollGrossTotal: 0,
            difference: 0,
            isMatched: false,
            attributionMonthMatched: false,
            paymentMonthMatched: false,
            withholdingMatchesGross: false,
            individualMatches: [],
          })
        }
      } else {
        groupMap.set('__fallback__', {
          groupKey: '__fallback__',
          companyDivision: '',
          attributionMonth: '',
          paymentMonth: '',
          withholding: null,
          payroll: null,
          bankList: [],
          payrollTotal: 0,
          bankTotal: 0,
          withholdingTotal: 0,
          payrollGrossTotal: 0,
          difference: 0,
          isMatched: false,
          attributionMonthMatched: false,
          paymentMonthMatched: false,
          withholdingMatchesGross: false,
          individualMatches: [],
        })
      }

      // Phase 3: Excel → 사업장별 시트 매칭 후 Claude 처리
      // 그룹의 귀속월 목록 (중복 제거) — 각 unique 월마다 Excel 처리 1회
      const uniqueMonths = [
        ...new Set(
          Array.from(groupMap.values())
            .map((g) => g.attributionMonth)
            .filter((m) => m && m !== '__fallback__')
        ),
      ] as string[]
      const monthsToProcess: (string | undefined)[] =
        uniqueMonths.length > 0 ? uniqueMonths : [undefined]

      for (const excelFileItem of excelFiles) {
        const fileIndex = files.findIndex((f) => f.file === excelFileItem.file)
        setFiles((prev) => prev.map((f, idx) => idx === fileIndex ? { ...f, status: 'processing' } : f))

        let excelCallCount = 0

        for (const targetMonth of monthsToProcess) {
          if (excelCallCount > 0 || sortedNonExcel.length > 0) await delay(3000)
          excelCallCount++

          try {
            const result = await processFile(excelFileItem, targetMonth)
            const documents = result.isMultipleDocuments ? result.documents : [result]

            for (const doc of documents) {
              if (doc.documentType === 'payroll') {
                const payrollMonth = doc.fields.paymentYearMonth || ''

                // 귀속월로 그룹 찾기
                let targetGroup = payrollMonth ? groupMap.get(payrollMonth) : null

                // 귀속월 비어있는 그룹 fallback
                if (!targetGroup && payrollMonth) {
                  for (const group of groupMap.values()) {
                    if (!group.attributionMonth && !group.payroll && group.groupKey !== '__fallback__') {
                      group.attributionMonth = payrollMonth
                      if (!group.paymentMonth) {
                        const [yr, mo] = payrollMonth.split('-').map(Number)
                        const nextMo = mo === 12 ? 1 : mo + 1
                        const nextYr = mo === 12 ? yr + 1 : yr
                        group.paymentMonth = `${nextYr}-${String(nextMo).padStart(2, '0')}`
                      }
                      targetGroup = group
                      break
                    }
                  }
                }

                // __fallback__ 그룹
                if (!targetGroup) {
                  const fb = groupMap.get('__fallback__')
                  if (fb) {
                    targetGroup = fb
                    if (payrollMonth) {
                      targetGroup.attributionMonth = payrollMonth
                      if (!targetGroup.paymentMonth) {
                        const [yr, mo] = payrollMonth.split('-').map(Number)
                        const nextMo = mo === 12 ? 1 : mo + 1
                        const nextYr = mo === 12 ? yr + 1 : yr
                        targetGroup.paymentMonth = `${nextYr}-${String(nextMo).padStart(2, '0')}`
                      }
                    }
                  }
                }

                if (targetGroup) {
                  targetGroup.payroll = {
                    companyDivision: doc.fields.companyDivision || '',
                    yearMonth: payrollMonth,
                    paymentDate: doc.fields.paymentDate || '',
                    employees: doc.fields.employees || [],
                    totalNetPay: doc.fields.totalNetPay || 0,
                    totalGrossPay: doc.fields.totalGrossPay || 0,
                  }
                }
              }
            }
          } catch {
            // 개별 시트 실패 시 다음 월 계속 진행
          }
        }

        setFiles((prev) => prev.map((f, idx) =>
          idx === fileIndex
            ? { ...f, status: 'completed', documentType: monthsToProcess.length > 1 ? `payroll (${monthsToProcess.length}개월)` : 'payroll' }
            : f
        ))
      }

      // Phase 3.5: 이체확인증 → 사업장+지급월 기준 그룹 매칭 (Excel 처리 후 지급월 확정된 뒤 실행)
      for (const bank of rawBankList) {
        let matched = false
        if (bank.transferMonth) {
          for (const group of groupMap.values()) {
            if (group.paymentMonth === bank.transferMonth) {
              group.bankList.push(bank)
              matched = true
              break
            }
          }
        }
        if (!matched) {
          const firstGroup = groupMap.values().next().value
          if (firstGroup) firstGroup.bankList.push(bank)
        }
      }

      // Phase 4: 크로스체크 계산
      const finalGroups: MonthGroup[] = []
      for (const group of groupMap.values()) {
        const payrollTotal =
          group.payroll?.totalNetPay ||
          group.payroll?.employees?.reduce((sum, e) => sum + (e.netPay || 0), 0) ||
          0
        const payrollGrossTotal =
          group.payroll?.totalGrossPay ||
          group.payroll?.employees?.reduce((sum: number, e: any) => sum + (e.grossPay || 0), 0) ||
          0
        const bankTotal = group.bankList.reduce((sum, b) => sum + b.totalWithdrawal, 0)
        const difference = payrollTotal - bankTotal
        const isMatched = Math.abs(difference) < 100
        const withholdingMatchesGross =
          (group.withholding?.totalPayment || 0) > 0 &&
          payrollGrossTotal > 0 &&
          Math.abs((group.withholding?.totalPayment || 0) - payrollGrossTotal) < 1000

        const attributionMonthMatched =
          !!group.payroll?.yearMonth &&
          group.payroll.yearMonth === group.withholding?.attributionYearMonth

        const bankTransferMonths = group.bankList.map((b) => b.transferMonth || '').filter(Boolean)
        const paymentMonthMatched =
          bankTransferMonths.length > 0 &&
          !!group.paymentMonth &&
          bankTransferMonths.every((m) => m === group.paymentMonth)

        const individualMatches: MatchResult[] = []
        if (group.payroll?.employees && group.payroll.employees.length > 0) {
          for (const emp of group.payroll.employees) {
            const allTx = group.bankList.flatMap((b) => b.transactions)
            const matchedTx = allTx.find(
              (tx: any) => tx.description?.includes(emp.name) || emp.name?.includes(tx.description)
            )
            const bankAmount = matchedTx?.withdrawal || 0
            individualMatches.push({
              name: emp.name,
              payrollAmount: emp.netPay,
              bankAmount,
              difference: emp.netPay - bankAmount,
              isMatched: bankAmount > 0 ? Math.abs(emp.netPay - bankAmount) < 100 : false,
            })
          }
        }

        finalGroups.push({
          ...group,
          payrollTotal,
          bankTotal,
          withholdingTotal: group.withholding?.totalPayment || 0,
          payrollGrossTotal,
          difference,
          isMatched,
          attributionMonthMatched,
          paymentMonthMatched,
          withholdingMatchesGross,
          individualMatches,
        })
      }

      finalGroups.sort((a, b) => a.attributionMonth.localeCompare(b.attributionMonth))
      setMonthGroups(finalGroups)

    } catch (err) {
      console.error('크로스체크 오류:', err)
      setError(err instanceof Error ? err.message : '처리 중 오류가 발생했습니다.')
    } finally {
      setIsProcessing(false)
    }
  }

  const removeFile = (index: number) => setFiles((prev) => prev.filter((_, i) => i !== index))

  const clearAll = () => {
    setFiles([])
    setMonthGroups([])
    setExpandedMonth(null)
    setError(null)
  }

  const formatNumber = (num: number) => new Intl.NumberFormat('ko-KR').format(num)

  const toggleExpanded = (key: string) =>
    setExpandedMonth((prev) => (prev === key ? null : key))

  const stats = {
    total: files.length,
    pending: files.filter((f) => f.status === 'pending').length,
    processing: files.filter((f) => f.status === 'processing').length,
    completed: files.filter((f) => f.status === 'completed').length,
    error: files.filter((f) => f.status === 'error').length,
  }

  const detectedTypes = {
    payroll: monthGroups.some((g) => g.payroll !== null),
    bank: monthGroups.some((g) => g.bankList.length > 0),
    withholding: monthGroups.some((g) => g.withholding !== null),
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 transition-all duration-500">
      <div className="max-w-6xl mx-auto py-12 px-4">
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors bg-white/60 backdrop-blur-sm px-3 py-1.5 rounded-lg"
          >
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            메인으로
          </Link>
        </div>

        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/30 backdrop-blur-sm mb-4">
            <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">급여 검증</h1>
          <p className="text-gray-600">
            급여대장, 원천징수신고서, 통장내역을 업로드하면 월별로 자동 크로스체크합니다
          </p>
        </div>

        <div className="bg-white/80 backdrop-blur-sm border border-white/50 shadow-lg rounded-2xl p-6 space-y-6">
          {/* 파일 업로드 */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer
              ${files.length > 0 ? 'border-purple-400 bg-purple-50/50' : 'border-gray-300 hover:border-purple-400'}
              ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <input
              type="file"
              accept=".pdf,image/*,.xls,.xlsx"
              onChange={handleFileInput}
              className="hidden"
              id="payroll-file-upload"
              multiple
              disabled={isProcessing}
            />
            <label htmlFor="payroll-file-upload" className="cursor-pointer">
              <div className="w-16 h-16 mx-auto bg-purple-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-gray-600 font-medium">급여 관련 파일을 드래그하거나 클릭하여 업로드</p>
              <p className="text-sm text-gray-400 mt-1">
                급여대장(Excel/PDF), 원천징수신고서, 이체확인증 — 여러 달 가능
              </p>
            </label>
          </div>

          {/* 파일 목록 */}
          {files.length > 0 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex gap-4 text-sm">
                  <span className="text-gray-600">전체: {stats.total}</span>
                  <span className="text-yellow-600">대기: {stats.pending}</span>
                  <span className="text-blue-600">처리중: {stats.processing}</span>
                  <span className="text-green-600">완료: {stats.completed}</span>
                  <span className="text-red-600">오류: {stats.error}</span>
                </div>
                <button onClick={clearAll} disabled={isProcessing} className="text-sm text-red-500 hover:text-red-700 disabled:opacity-50">
                  전체 삭제
                </button>
              </div>

              {isProcessing && (
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${((stats.completed + stats.error) / stats.total) * 100}%` }}
                  />
                </div>
              )}

              <div className="max-h-40 overflow-y-auto space-y-2">
                {files.map((fileItem, index) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-3 rounded-lg text-sm
                      ${fileItem.status === 'pending' ? 'bg-gray-50' : ''}
                      ${fileItem.status === 'processing' ? 'bg-blue-50 border border-blue-200' : ''}
                      ${fileItem.status === 'completed' ? 'bg-green-50' : ''}
                      ${fileItem.status === 'error' ? 'bg-red-50' : ''}`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {fileItem.status === 'pending' && <span className="w-5 h-5 rounded-full bg-gray-300 flex-shrink-0" />}
                      {fileItem.status === 'processing' && <span className="w-5 h-5 rounded-full border-2 border-purple-600 border-t-transparent animate-spin flex-shrink-0" />}
                      {fileItem.status === 'completed' && <span className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white text-xs flex-shrink-0">O</span>}
                      {fileItem.status === 'error' && <span className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-white text-xs flex-shrink-0">X</span>}
                      <span className="truncate">{fileItem.file.name}</span>
                      {fileItem.documentType && (
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs flex-shrink-0">{fileItem.documentType}</span>
                      )}
                      {fileItem.error && <span className="text-red-600 text-xs">{fileItem.error}</span>}
                    </div>
                    {!isProcessing && (
                      <button onClick={() => removeFile(index)} className="text-gray-400 hover:text-red-500 ml-2 flex-shrink-0">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 크로스체크 버튼 */}
          {files.length > 0 && stats.pending > 0 && (
            <button
              onClick={runCrossCheck}
              disabled={isProcessing}
              className="w-full py-3 px-4 bg-purple-600 text-white font-medium rounded-xl hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-lg hover:shadow-xl"
            >
              {isProcessing
                ? `처리 중... (${stats.completed + stats.error}/${stats.total})`
                : `크로스체크 실행 (${stats.pending}개 파일)`}
            </button>
          )}

          {/* 에러 */}
          {error && (
            <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100">{error}</div>
          )}

          {/* 감지된 문서 */}
          {(detectedTypes.payroll || detectedTypes.bank || detectedTypes.withholding) && (
            <div className="flex gap-3 flex-wrap items-center">
              <span className="text-sm text-gray-600">감지된 문서:</span>
              {detectedTypes.payroll && (
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">급여대장</span>
              )}
              {detectedTypes.withholding && (
                <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm">
                  원천징수신고서{monthGroups.filter((g) => g.withholding).length > 1 ? ` (${monthGroups.filter((g) => g.withholding).length}건)` : ''}
                </span>
              )}
              {detectedTypes.bank && (
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                  통장내역{monthGroups.flatMap((g) => g.bankList).length > 1 ? ` (${monthGroups.flatMap((g) => g.bankList).length}건)` : ''}
                </span>
              )}
            </div>
          )}

          {/* 결과 테이블 */}
          {monthGroups.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-base font-semibold text-gray-900">크로스체크 결과</h3>
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-500">귀속월</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-500">급여대장</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-500">원천징수</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-500">이체출금</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-500">귀속월</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-500">지급월</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-500">총액</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-500">결과</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthGroups.flatMap((group) => {
                      const isExpanded = expandedMonth === group.groupKey
                      const hasIndividual = group.individualMatches.length > 0
                      const colSpan = 8

                      const mainRow = (
                        <tr
                          key={group.groupKey}
                          onClick={() => hasIndividual && toggleExpanded(group.groupKey)}
                          className={`border-b border-gray-100 transition-colors
                            ${hasIndividual ? 'cursor-pointer hover:bg-gray-50' : ''}
                            ${!group.isMatched ? 'bg-red-50/40' : ''}`}
                        >
                          <td className="py-3 px-4 font-medium">
                            <div className="flex items-center gap-1.5">
                              <span>{group.attributionMonth || '-'}</span>
                              {hasIndividual && (
                                <span className="text-gray-400 text-xs">{isExpanded ? '▲' : '▼'}</span>
                              )}
                            </div>
                          </td>
                          <td className="text-right py-3 px-4 tabular-nums">
                            {group.payrollTotal > 0 ? formatNumber(group.payrollTotal) : '-'}
                            {group.payroll?.employees && group.payroll.employees.length > 0 && (
                              <span className="text-xs text-gray-400 ml-1">({group.payroll.employees.length}명)</span>
                            )}
                          </td>
                          <td className="text-right py-3 px-4 tabular-nums">
                            <div>{group.withholdingTotal > 0 ? formatNumber(group.withholdingTotal) : '-'}</div>
                            {group.payrollGrossTotal > 0 && (
                              <div className="text-xs text-gray-400 mt-0.5">
                                급여총액: {formatNumber(group.payrollGrossTotal)}
                                <span className={`ml-1 font-medium ${group.withholdingMatchesGross ? 'text-green-500' : 'text-red-500'}`}>
                                  {group.withholdingMatchesGross ? '✓' : '✗'}
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="text-right py-3 px-4 tabular-nums">
                            {group.bankTotal > 0 ? formatNumber(group.bankTotal) : '-'}
                            {group.bankList.length > 1 && (
                              <span className="text-xs text-gray-400 ml-1">({group.bankList.length}건)</span>
                            )}
                          </td>
                          <td className="text-center py-3 px-4">
                            {group.withholding ? (
                              <span className={group.attributionMonthMatched ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
                                {group.attributionMonthMatched ? '✓' : '✗'}
                              </span>
                            ) : <span className="text-gray-300">-</span>}
                          </td>
                          <td className="text-center py-3 px-4">
                            {group.bankList.length > 0 && group.withholding ? (
                              <span className={group.paymentMonthMatched ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
                                {group.paymentMonthMatched ? '✓' : '✗'}
                              </span>
                            ) : <span className="text-gray-300">-</span>}
                          </td>
                          <td className="text-center py-3 px-4">
                            {group.withholdingTotal > 0 && group.payrollGrossTotal > 0 ? (
                              <span className={group.withholdingMatchesGross ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
                                {group.withholdingMatchesGross ? '✓' : '✗'}
                              </span>
                            ) : <span className="text-gray-300">-</span>}
                          </td>
                          <td className="text-center py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              group.isMatched ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {group.isMatched ? '일치' : '불일치'}
                            </span>
                          </td>
                        </tr>
                      )

                      if (!isExpanded || !hasIndividual) return [mainRow]

                      const expandedRow = (
                        <tr key={`expanded-${group.groupKey}`}>
                          <td colSpan={colSpan} className="p-0 border-b border-gray-200">
                            <div className="bg-gray-50/80 px-6 py-4">
                              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                                개인별 매칭 — {group.companyDivision ? `${group.companyDivision} ` : ''}{group.attributionMonth}
                              </p>
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-gray-200">
                                    <th className="text-left py-2 px-2 text-gray-500 font-medium">이름</th>
                                    <th className="text-right py-2 px-2 text-gray-500 font-medium">급여대장</th>
                                    <th className="text-right py-2 px-2 text-gray-500 font-medium">통장</th>
                                    <th className="text-right py-2 px-2 text-gray-500 font-medium">차이</th>
                                    <th className="text-center py-2 px-2 text-gray-500 font-medium">결과</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {group.individualMatches.map((match, matchIdx) => (
                                    <tr key={matchIdx} className="border-b border-gray-100 last:border-0">
                                      <td className="py-2 px-2">{match.name}</td>
                                      <td className="text-right py-2 px-2 tabular-nums">{formatNumber(match.payrollAmount)}</td>
                                      <td className="text-right py-2 px-2 tabular-nums">
                                        {match.bankAmount > 0 ? formatNumber(match.bankAmount) : '-'}
                                      </td>
                                      <td className={`text-right py-2 px-2 tabular-nums ${match.bankAmount > 0 && match.difference !== 0 ? 'text-red-600' : ''}`}>
                                        {match.bankAmount > 0 ? formatNumber(match.difference) : '-'}
                                      </td>
                                      <td className="text-center py-2 px-2">
                                        {match.isMatched
                                          ? <span className="text-green-600 font-medium">O</span>
                                          : match.bankAmount > 0
                                          ? <span className="text-red-600 font-medium">X</span>
                                          : <span className="text-gray-300">-</span>}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              <p className="text-xs text-gray-400 mt-3">
                                * 통장 적요에 직원 이름이 포함된 경우에만 개인별 매칭이 가능합니다.
                              </p>
                            </div>
                          </td>
                        </tr>
                      )

                      return [mainRow, expandedRow]
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600 mb-3">지원 문서 유형</p>
          <div className="flex flex-wrap justify-center gap-2">
            {['급여대장 (Excel/PDF)', '원천징수신고서', '이체확인증 / 통장내역'].map((type) => (
              <span key={type} className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/60 text-gray-600 backdrop-blur-sm">
                {type}
              </span>
            ))}
          </div>
          <p className="mt-3 text-gray-500 text-sm">
            한 사업장·여러 달치 파일을 한 번에 업로드하면 자동으로 월별 그룹핑합니다.
          </p>
        </div>
      </div>
    </div>
  )
}
