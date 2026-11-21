export type ReportCell = string | number
export type ReportTable = { title: string; columns: string[]; rows: ReportCell[][] }

export interface ReportExport {
  year: number
  zone: string
  filename: string
  tables: ReportTable[]
  generatedAt: Date
  logo?: string
  company?: { name: string; nit: string; email: string; phone: string; logo: string }
}

const brand = { black: '111111', red: 'B8000B', dark: '252525', gray: '5F6068', line: 'E5E5E5', pale: 'F5F5F5', white: 'FFFFFF' }
const currency = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 2 })
const integer = new Intl.NumberFormat('es-CO')
const date = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short' })
const isMoney = (table: ReportTable, column: number) => /\bCOP\b/.test(table.columns[column] ?? '')
const isNumeric = (table: ReportTable, column: number) => isMoney(table, column) || table.rows.some((row) => typeof row[column] === 'number')

export async function buildReportPdf(report: ReportExport) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ format: 'a4', compress: true })
  const width = doc.internal.pageSize.getWidth()
  const height = doc.internal.pageSize.getHeight()
  const left = 15
  const right = width - left
  const contentTop = 50
  const bottom = height - 19
  let y = contentTop

  doc.setProperties({ title: 'SisFumi | Reporte anual ' + report.year, subject: report.zone, author: 'SisFumi' })

  for (const table of report.tables) {
    if (bottom - y < 34) {
      doc.addPage()
      y = contentTop
    }
    doc.setFillColor('#' + brand.red)
    doc.rect(left, y - 3.5, 1, 5, 'F')
    doc.setTextColor('#' + brand.black)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text(table.title, left + 3, y)
    y += 4

    if (!table.rows.length) {
      doc.setFont('helvetica', 'normal')
      doc.setTextColor('#' + brand.gray)
      doc.setFontSize(9)
      doc.text('Sin registros para el periodo seleccionado.', left + 3, y + 4)
      y += 15
      continue
    }

    const columns = Object.fromEntries(table.columns.map((_, index) => [
      index, isNumeric(table, index) ? { halign: 'right' as const } : {},
    ]))
    autoTable(doc, {
      startY: y,
      margin: { left, right: left, top: contentTop, bottom: 19 },
      head: [table.columns],
      body: table.rows.map((row) => row.map((value, index) =>
        typeof value === 'number' ? (isMoney(table, index) ? currency.format(value) : integer.format(value)) : value,
      )),
      showHead: 'everyPage',
      rowPageBreak: 'avoid',
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.5, textColor: '#'+brand.black, lineColor: '#'+brand.line, lineWidth: 0.15 },
      headStyles: { fillColor: '#'+brand.dark, textColor: '#'+brand.white, fontStyle: 'bold', lineWidth: 0 },
      alternateRowStyles: { fillColor: '#'+brand.pale },
      columnStyles: columns,
      didDrawPage: ({ cursor }) => { if (cursor) y = cursor.y + 11 },
    })
  }

  const pageCount = doc.getNumberOfPages()
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page)
    doc.setFillColor('#' + brand.black)
    doc.rect(0, 0, width, 32, 'F')
    doc.setFillColor('#' + brand.red)
    doc.rect(0, 32, width, 1.5, 'F')
    doc.setTextColor('#' + brand.white)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(19)
    if (report.logo) doc.addImage(report.logo, 'PNG', left - 6, 2, 35, 25.5, 'sisfumi-logo')
    const brandTextX = report.logo ? left + 27 : left
    doc.text('SisFumi', brandTextX, 15)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(report.company?.name || 'Control de Plagas', brandTextX, 22, { maxWidth: 105 })
    doc.setFontSize(11)
    doc.text('Reporte anual', right, 15, { align: 'right' })
    doc.setFontSize(9)
    doc.text(String(report.year), right, 22, { align: 'right' })
    doc.setTextColor('#' + brand.gray)
    doc.text('Zona: ' + report.zone, left, 42, { maxWidth: 97 })
    doc.text('Generado: ' + date.format(report.generatedAt), right, 42, { align: 'right' })
    doc.setDrawColor('#' + brand.line)
    doc.line(left, height - 14, right, height - 14)
    doc.setFontSize(8)
    doc.text('SisFumi  |  ' + [report.company?.nit ? 'NIT ' + report.company.nit : '', report.company?.email, report.company?.phone].filter(Boolean).join('  |  ').slice(0, 95), left, height - 9, { maxWidth: 135 })
    doc.text('Página ' + page + ' de ' + pageCount, right, height - 9, { align: 'right' })
  }
  return doc
}

export async function buildReportWorkbook(report: ReportExport) {
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'SisFumi'
  workbook.created = report.generatedAt
  workbook.title = 'SisFumi | Reporte anual ' + report.year
  const fill = (color: string) => ({ type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF' + color } })
  const font = (color: string, size: number, bold = false) => ({ name: 'Calibri', size, bold, color: { argb: 'FF' + color } })
  const sheetNames = new Set<string>()
  const logoId = report.logo ? workbook.addImage({ base64: report.logo, extension: 'png' }) : undefined

  for (const table of report.tables) {
    const base = table.title.replace(/[:\\/?*\[\]]/g, ' ').trim().slice(0, 31) || 'Reporte'
    let name = base
    for (let i = 2; sheetNames.has(name.toLowerCase()); i++) {
      const suffix = ' ' + i
      name = base.slice(0, 31 - suffix.length) + suffix
    }
    sheetNames.add(name.toLowerCase())
    const sheet = workbook.addWorksheet(name, {
      properties: { tabColor: { argb: 'FF' + brand.red } },
      views: [{ state: 'frozen', ySplit: 5, showGridLines: false }],
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:5' },
    })
    const width = Math.max(2, table.columns.length)
    for (const row of [2, 3]) sheet.mergeCells(row, 1, row, width)
    const titleColumn = logoId === undefined ? 1 : 2
    if (width > titleColumn) sheet.mergeCells(1, titleColumn, 1, width)
    const title = sheet.getCell(1, titleColumn)
    title.value = 'SisFumi  |  ' + table.title
    title.fill = fill(brand.black)
    title.font = font(brand.white, 18, true)
    title.alignment = { vertical: 'middle', indent: 1 }
    sheet.getRow(1).height = logoId === undefined ? 36 : 46
    if (logoId !== undefined) {
      sheet.getCell('A1').fill = fill(brand.black)
      sheet.addImage(logoId, { tl: { col: 0, row: 0 }, ext: { width: 84, height: 61 }, editAs: 'oneCell' })
    }
    const context = sheet.getCell('A2')
    context.value = 'Periodo ' + report.year + '  |  ' + report.zone
    context.fill = fill(brand.red)
    context.font = font(brand.white, 11, true)
    context.alignment = { vertical: 'middle', indent: 1, wrapText: true }
    sheet.getRow(2).height = 24
    sheet.getCell('A3').value = 'Generado ' + date.format(report.generatedAt) + '  |  Hora de Colombia'
    sheet.getCell('A3').font = font(brand.gray, 10)
    sheet.getRow(3).height = 19

    sheet.getCell('A4').value = [report.company?.name, report.company?.nit && 'NIT ' + report.company.nit, report.company?.email, report.company?.phone].filter(Boolean).join('  |  ')
    sheet.getCell('A4').font = font(brand.gray, 10)
    sheet.mergeCells(4, 1, 4, width)
    const header = sheet.getRow(5)
    header.values = table.columns
    header.height = 28
    header.eachCell((cell) => {
      cell.fill = fill(brand.dark)
      cell.font = font(brand.white, 11, true)
      cell.alignment = { vertical: 'middle', wrapText: true, indent: 1 }
    })
    const longestByColumn = table.columns.map((label) => label.length)
    for (const values of table.rows) {
      const row = sheet.addRow(values)
      row.height = 22
      row.eachCell((cell, index) => {
        const value = cell.value
        longestByColumn[index - 1] = Math.max(longestByColumn[index - 1] ?? 0, String(value ?? '').length)
        if (typeof value === 'string' && value.length > 48) row.height = Math.max(row.height, Math.ceil(value.length / 48) * 15)
        cell.fill = fill(row.number % 2 === 0 ? brand.white : brand.pale)
        cell.font = font(brand.black, 11, index === 1)
        cell.alignment = { vertical: 'middle', horizontal: typeof value === 'number' ? 'right' : 'left', wrapText: true, indent: 1 }
        if (typeof value === 'number') cell.numFmt = isMoney(table, index - 1) ? '"COP" #,##0.00;[Red]-"COP" #,##0.00' : '#,##0.##'
      })
    }
    if (table.rows.length) {
      sheet.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5 + table.rows.length, column: table.columns.length } }
    } else {
      sheet.mergeCells(6, 1, 6, width)
      const empty = sheet.getCell('A6')
      empty.value = 'Sin registros para el periodo seleccionado.'
      empty.font = font(brand.gray, 11)
      sheet.getRow(6).height = 22
    }
    longestByColumn.forEach((length, index) => {
      sheet.getColumn(index + 1).width = Math.min(58, Math.max(index === 0 ? 28 : 16, length + 5, isMoney(table, index) ? 23 : 0))
    })
    sheet.headerFooter.oddFooter = 'SisFumi  |  Reportes&C&A&R&P de &N'
  }
  return workbook
}

async function loadCompanyLogo(): Promise<string> {
  const response = await fetch('/logo.png')
  if (!response.ok) throw new Error('No se pudo cargar el logo de la empresa.')
  const blob = await response.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('No se pudo leer el logo de la empresa.'))
    reader.onerror = () => reject(new Error('No se pudo leer el logo de la empresa.'))
    reader.readAsDataURL(blob)
  })
}

export async function downloadReport(report: ReportExport, format: 'pdf' | 'xlsx') {
  const brandedReport = { ...report, logo: report.company?.logo || await loadCompanyLogo() }
  if (format === 'pdf') {
    const pdf = await buildReportPdf(brandedReport)
    pdf.save(report.filename + '.pdf')
    return
  }
  const [workbook, { default: fileSaver }] = await Promise.all([buildReportWorkbook(brandedReport), import('file-saver')])
  const buffer = await workbook.xlsx.writeBuffer()
  fileSaver.saveAs(new Blob([buffer as unknown as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), report.filename + '.xlsx')
}
