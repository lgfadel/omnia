import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from 'pdf-lib'

export interface RelatorioRow {
  condominium: string
  competencia: string | null
  defasagemLabel: string
  status: 'yellow' | 'red'
  balanceteDigital?: boolean | null
}

const PAGE_WIDTH = 595
const PAGE_HEIGHT = 842
const MARGIN = 50
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2

const COL_WIDTHS = {
  numero: 28,
  condominio: 248,
  competencia: 90,
  tipo: 28,
  defasagem: CONTENT_WIDTH - 28 - 248 - 90 - 28,
}

export function calculateHeaderBottomY(logoHeight: number): number {
  const startY = PAGE_HEIGHT - MARGIN
  const contentTopOffset = logoHeight > 0 ? logoHeight + 25 : 28
  return startY - contentTopOffset - 20
}

function formatDateNow(): string {
  const now = new Date()
  return now.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

interface PageContext {
  pdfDoc: PDFDocument
  helvetica: PDFFont
  helveticaBold: PDFFont
}

async function drawReportHeader(
  page: PDFPage,
  ctx: PageContext,
  logoImage: Awaited<ReturnType<PDFDocument['embedPng']>> | null
): Promise<number> {
  let yPosition = PAGE_HEIGHT - MARGIN
  let logoHeight = 0

  if (logoImage) {
    const maxWidth = 100
    const maxHeight = 60
    const aspect = logoImage.width / logoImage.height
    let logoWidth = maxWidth
    logoHeight = logoWidth / aspect
    if (logoHeight > maxHeight) {
      logoHeight = maxHeight
      logoWidth = logoHeight * aspect
    }
    page.drawImage(logoImage, {
      x: PAGE_WIDTH - MARGIN - logoWidth,
      y: yPosition - logoHeight,
      width: logoWidth,
      height: logoHeight,
    })
  }

  page.drawText('RELATÓRIO DE SITUAÇÃO DE BALANCETES', {
    x: MARGIN,
    y: yPosition - (logoHeight > 0 ? (logoHeight / 2) - 7 : 10),
    size: 13,
    font: ctx.helveticaBold,
    color: rgb(0.1, 0.1, 0.1),
  })

  yPosition = calculateHeaderBottomY(logoHeight) + 20

  page.drawText(`Gerado em: ${formatDateNow()}`, {
    x: MARGIN,
    y: yPosition,
    size: 9,
    font: ctx.helvetica,
    color: rgb(0.4, 0.4, 0.4),
  })
  yPosition -= 20

  return yPosition
}

function drawSummary(
  page: PDFPage,
  ctx: PageContext,
  yellowCount: number,
  redCount: number,
  yPosition: number
): number {
  page.drawRectangle({
    x: MARGIN,
    y: yPosition - 22,
    width: CONTENT_WIDTH,
    height: 28,
    color: rgb(0.97, 0.97, 0.97),
    borderColor: rgb(0.88, 0.88, 0.88),
    borderWidth: 0.5,
  })

  const total = yellowCount + redCount
  const summaryText = `Resumo:   Atenção: ${yellowCount}   Atrasado: ${redCount}   Total crítico: ${total}`
  page.drawText(summaryText, {
    x: MARGIN + 10,
    y: yPosition - 12,
    size: 9,
    font: ctx.helveticaBold,
    color: rgb(0.2, 0.2, 0.2),
  })

  return yPosition - 36
}

function drawSectionHeader(
  page: PDFPage,
  ctx: PageContext,
  label: string,
  bgColor: { r: number; g: number; b: number },
  yPosition: number
): number {
  page.drawRectangle({
    x: MARGIN,
    y: yPosition - 22,
    width: CONTENT_WIDTH,
    height: 28,
    color: rgb(bgColor.r, bgColor.g, bgColor.b),
  })
  page.drawText(label, {
    x: MARGIN + 8,
    y: yPosition - 11,
    size: 9,
    font: ctx.helveticaBold,
    color: rgb(1, 1, 1),
  })
  return yPosition - 38
}

function drawTableHeader(page: PDFPage, ctx: PageContext, yPosition: number): number {
  page.drawRectangle({
    x: MARGIN,
    y: yPosition - 5,
    width: CONTENT_WIDTH,
    height: 20,
    color: rgb(0.93, 0.93, 0.93),
  })

  let xPos = MARGIN + 5
  page.drawText('#', { x: xPos, y: yPosition, size: 8, font: ctx.helveticaBold, color: rgb(0.2, 0.2, 0.2) })
  xPos += COL_WIDTHS.numero

  page.drawText('CONDOMÍNIO', { x: xPos, y: yPosition, size: 8, font: ctx.helveticaBold, color: rgb(0.2, 0.2, 0.2) })
  xPos += COL_WIDTHS.condominio

  page.drawText('ÚLTIMO', { x: xPos, y: yPosition, size: 8, font: ctx.helveticaBold, color: rgb(0.2, 0.2, 0.2) })
  xPos += COL_WIDTHS.competencia

  page.drawText('TIPO', { x: xPos, y: yPosition, size: 8, font: ctx.helveticaBold, color: rgb(0.2, 0.2, 0.2) })
  xPos += COL_WIDTHS.tipo

  page.drawText('DEFASAGEM', { x: xPos, y: yPosition, size: 8, font: ctx.helveticaBold, color: rgb(0.2, 0.2, 0.2) })

  return yPosition - 22
}

function drawRow(
  page: PDFPage,
  ctx: PageContext,
  row: RelatorioRow,
  index: number,
  yPosition: number
): void {
  if (index % 2 === 1) {
    page.drawRectangle({
      x: MARGIN,
      y: yPosition - 4,
      width: CONTENT_WIDTH,
      height: 17,
      color: rgb(0.985, 0.985, 0.985),
    })
  }

  let xPos = MARGIN + 5

  page.drawText(String(index + 1), {
    x: xPos, y: yPosition, size: 8,
    font: ctx.helvetica, color: rgb(0.5, 0.5, 0.5),
  })
  xPos += COL_WIDTHS.numero

  const condText = row.condominium.substring(0, 46)
  page.drawText(condText, {
    x: xPos, y: yPosition, size: 8,
    font: ctx.helvetica, color: rgb(0.1, 0.1, 0.1),
  })
  xPos += COL_WIDTHS.condominio

  page.drawText(row.competencia ?? '—', {
    x: xPos, y: yPosition, size: 8,
    font: ctx.helvetica, color: rgb(0.1, 0.1, 0.1),
  })
  xPos += COL_WIDTHS.competencia

  const tipoLabel = row.balanceteDigital === true ? 'D' : 'I'
  page.drawText(tipoLabel, {
    x: xPos, y: yPosition, size: 8,
    font: ctx.helveticaBold, color: rgb(0.2, 0.2, 0.2),
  })
  xPos += COL_WIDTHS.tipo

  page.drawText(row.defasagemLabel, {
    x: xPos, y: yPosition, size: 8,
    font: ctx.helvetica, color: rgb(0.35, 0.35, 0.35),
  })
}

function needsNewPage(yPosition: number): boolean {
  return yPosition < MARGIN + 60
}

async function addPage(
  pdfDoc: PDFDocument,
  ctx: PageContext,
  logoImage: Awaited<ReturnType<PDFDocument['embedPng']>> | null
): Promise<{ page: PDFPage; y: number }> {
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  const y = await drawReportHeader(page, ctx, logoImage)
  return { page, y }
}

export async function generateBalancetesRelatorioPDF(
  yellowRows: RelatorioRow[],
  redRows: RelatorioRow[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()

  let logoImage: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null
  try {
    const res = await fetch('/assets/company-logo.png')
    if (res.ok) {
      logoImage = await pdfDoc.embedPng(await res.arrayBuffer())
    }
  } catch {
    // sem logo
  }

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const ctx: PageContext = { pdfDoc, helvetica, helveticaBold }

  let { page, y } = await addPage(pdfDoc, ctx, logoImage)

  // Resumo
  y = drawSummary(page, ctx, yellowRows.length, redRows.length, y)
  y -= 8

  const sections: { rows: RelatorioRow[]; label: string; color: { r: number; g: number; b: number } }[] = [
    { rows: yellowRows, label: 'ATENÇÃO — 2 meses de defasagem', color: { r: 0.72, g: 0.53, b: 0.04 } },
    { rows: redRows, label: 'ATRASADO — 3 ou mais meses de defasagem', color: { r: 0.75, g: 0.15, b: 0.15 } },
  ]

  for (const section of sections) {
    if (section.rows.length === 0) continue

    if (needsNewPage(y - 50)) {
      ;({ page, y } = await addPage(pdfDoc, ctx, logoImage))
    }

    y = drawSectionHeader(page, ctx, section.label, section.color, y)
    y = drawTableHeader(page, ctx, y)

    for (let i = 0; i < section.rows.length; i++) {
      if (needsNewPage(y)) {
        ;({ page, y } = await addPage(pdfDoc, ctx, logoImage))
        y = drawTableHeader(page, ctx, y)
      }
      drawRow(page, ctx, section.rows[i], i, y)
      y -= 17
    }

    y -= 12
  }

  return await pdfDoc.save()
}
