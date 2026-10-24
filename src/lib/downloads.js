// Real file downloads: CSV, Excel (.xlsx) and the invoice as a PDF.
// Everything is made in the browser and saved to the computer's Downloads folder.
// The Excel and PDF libraries (jszip, pdf-lib) load only when those buttons are clicked.
import { toCsv, fdate, amountInWords } from './format.js';

/** Hands a file to the browser, which saves it like any other download. */
export function saveFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// 'invoice_no' -> 'Invoice no'
const heading = (key) => key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
const withHeadings = (rows) => rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [heading(k), v])));

/** CSV file. The "﻿" at the start makes Excel read ₹ and Indian names correctly. */
export function downloadCsv(filename, rows) {
  saveFile(new Blob(['﻿' + toCsv(withHeadings(rows))], { type: 'text/csv;charset=utf-8' }), filename);
}

// ---------------------------------------------------------------- Excel
const xml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const colName = (i) => { let s = ''; for (i += 1; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s; return s; };

/**
 * A real .xlsx file. An .xlsx is a zip of a few XML files; this builds the smallest valid set:
 * one sheet, a bold header row, numbers stored as numbers (so Excel can add them up), and column widths.
 */
export async function downloadXlsx(filename, sheetName, rows) {
  const { default: JSZip } = await import('jszip');
  const cols = rows.length ? Object.keys(rows[0]) : [];
  const widths = cols.map((c) => Math.min(40, Math.max(heading(c).length, ...rows.map((r) => String(r[c] ?? '').length)) + 2));
  const cell = (v, ref, style = 0) => (typeof v === 'number' && Number.isFinite(v)
    ? `<c r="${ref}" s="${style || 2}"><v>${v}</v></c>`
    : `<c r="${ref}" t="inlineStr"${style ? ` s="${style}"` : ''}><is><t xml:space="preserve">${xml(v)}</t></is></c>`);
  const header = `<row r="1">${cols.map((c, i) => cell(heading(c), `${colName(i)}1`, 1)).join('')}</row>`;
  const body = rows.map((r, n) => `<row r="${n + 2}">${cols.map((c, i) => cell(r[c], `${colName(i)}${n + 2}`)).join('')}</row>`).join('');

  const zip = new JSZip();
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`);
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  zip.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xml(sheetName.slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets></workbook>`);
  zip.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  // Style 1 = bold header with grey fill, style 2 = numbers with 2 decimals and thousands separator
  zip.file('xl/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8F5EC"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="3"><xf xfId="0"/><xf xfId="0" fontId="1" fillId="2" applyFont="1" applyFill="1"/><xf xfId="0" numFmtId="164" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`);
  zip.file('xl/worksheets/sheet1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${header}${body}</sheetData></worksheet>`);

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveFile(blob, filename);
}

// ---------------------------------------------------------------- PDF
/**
 * The invoice (or quotation) as an A4 PDF, laid out like the on-screen invoice.
 * The PDF's built-in fonts have no ₹ sign, so amounts are written as "Rs. 1,23,456.00".
 */
export async function downloadInvoicePdf(inv, seller, settings, { title = 'TAX INVOICE', dueLabel = 'Due date' } = {}) {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  doc.setTitle(`${title} ${inv.no}`);
  doc.setAuthor(seller.name);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const hex = (h) => { const n = parseInt(String(h || '#0B6E4F').replace('#', ''), 16); return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255); };
  const ACCENT = hex(settings.accent), INK = rgb(0.09, 0.13, 0.11), MUTED = rgb(0.34, 0.38, 0.36), LINE = rgb(0.87, 0.89, 0.87), SOFT = rgb(0.95, 0.965, 0.95), WHITE = rgb(1, 1, 1);
  const rs = (n) => 'Rs. ' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const clean = (s) => String(s ?? '').replace(/₹\s?/g, 'Rs. ').replace(/[^\x20-\x7E]/g, (ch) => ({ '–': '-', '—': '-', '’': "'", '‘': "'", '“': '"', '”': '"', '·': '-', '×': 'x', '→': '->' }[ch] ?? ''));

  const W = 595.28, H = 841.89, M = 40;
  let page = doc.addPage([W, H]);
  let y = H - M;
  const text = (s, x, yy, { size = 9.5, f = font, color = INK, align = 'left', maxW } = {}) => {
    let str = clean(s);
    if (maxW && f.widthOfTextAtSize(str, size) > maxW) { while (str.length > 1 && f.widthOfTextAtSize(`${str}...`, size) > maxW) str = str.slice(0, -1); str += '...'; }
    const w = f.widthOfTextAtSize(str, size);
    page.drawText(str, { x: align === 'right' ? x - w : align === 'center' ? x - w / 2 : x, y: yy, size, font: f, color });
  };
  const wrap = (s, maxW, size = 9, f = font) => {
    const words = clean(s).split(/\s+/); const lines = []; let cur = '';
    for (const w of words) { const next = cur ? `${cur} ${w}` : w; if (f.widthOfTextAtSize(next, size) > maxW && cur) { lines.push(cur); cur = w; } else cur = next; }
    if (cur) lines.push(cur);
    return lines;
  };
  const newPageIfNeeded = (need) => { if (y - need < M + 40) { page = doc.addPage([W, H]); y = H - M; } };

  // Header band (with the uploaded logo, if it is a PNG or JPG)
  const bandH = 112;
  page.drawRectangle({ x: 0, y: H - bandH, width: W, height: bandH, color: ACCENT });
  let tx = M;
  const logo = settings.logo || '';
  if (/^data:image\/(png|jpe?g);base64,/.test(logo)) {
    try {
      const img = logo.startsWith('data:image/png') ? await doc.embedPng(logo) : await doc.embedJpg(logo);
      const box = 52, scale = Math.min(box / img.width, box / img.height);
      page.drawRectangle({ x: M, y: H - 30 - box - 6, width: box + 12, height: box + 12, color: WHITE });
      page.drawImage(img, { x: M + 6 + (box - img.width * scale) / 2, y: H - 30 - box + (box - img.height * scale) / 2, width: img.width * scale, height: img.height * scale });
      tx = M + box + 26;
    } catch { /* unreadable logo: leave it out */ }
  }
  text(seller.name, tx, H - 46, { size: 18, f: bold, color: WHITE });
  [seller.address, `${seller.stateName} - State code ${seller.state}`, `GSTIN ${seller.gstin || '-'}`].forEach((l, i) => text(l, tx, H - 64 - i * 13, { size: 9.5, color: WHITE }));
  text(title, W - M, H - 40, { size: 9, f: bold, color: WHITE, align: 'right' });
  text(inv.no, W - M, H - 62, { size: 18, f: bold, color: WHITE, align: 'right' });
  text(`Date ${fdate(inv.date)}`, W - M, H - 80, { size: 9.5, color: WHITE, align: 'right' });
  text(`${dueLabel} ${fdate(inv.due || inv.valid)}`, W - M, H - 93, { size: 9.5, color: WHITE, align: 'right' });
  y = H - bandH - 22;

  // Bill to + place of supply boxes
  const boxW = (W - 2 * M - 14) / 2, boxH = 66;
  const intra = inv.type === 'INTRA';
  [[M, 'Bill to', [inv.c.name, `${inv.c.city}, ${inv.c.stateName}`, `GSTIN ${inv.c.gstin || 'Unregistered'}`]],
    [M + boxW + 14, 'Place of supply', [`${inv.c.stateName} (${inv.c.state})`, intra ? 'Intra-state supply: CGST + SGST' : 'Inter-state supply: IGST']]].forEach(([x, label, lines]) => {
    page.drawRectangle({ x, y: y - boxH, width: boxW, height: boxH, color: SOFT });
    text(label, x + 12, y - 16, { size: 8.5, f: bold, color: MUTED });
    lines.forEach((l, i) => text(l, x + 12, y - 31 - i * 13, { size: 9.5, f: i === 0 ? bold : font, color: i === 0 ? INK : MUTED, maxW: boxW - 24 }));
  });
  y -= boxH + 26;

  // Items table
  const showHsn = settings.showHsn !== false;
  const cols = [
    ['#', 18, 'left'], ['Item', 0, 'left'], ...(showHsn ? [['HSN/SAC', 48, 'left']] : []), ['Qty', 50, 'right'], ['Rate', 62, 'right'], ['Taxable', 70, 'right'],
    ...(intra ? [['CGST', 56, 'right'], ['SGST', 56, 'right']] : [['IGST', 64, 'right']]), ['Amount', 74, 'right'],
  ];
  const fixed = cols.reduce((s, c) => s + c[1], 0);
  cols[1][1] = W - 2 * M - fixed; // item column takes the rest
  const xs = []; let cx = M; for (const c of cols) { xs.push(cx); cx += c[1]; }
  const colX = (i) => (cols[i][2] === 'right' ? xs[i] + cols[i][1] - 4 : xs[i]);
  const drawHead = () => {
    cols.forEach((c, i) => text(c[0], colX(i), y, { size: 8.5, f: bold, color: MUTED, align: c[2] }));
    y -= 7; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.8, color: LINE }); y -= 14;
  };
  drawHead();
  inv.lines.forEach((l, n) => {
    const nameLines = wrap(l.name, cols[1][1] - 8, 9.5).slice(0, 3);
    const extra = l.disc > 0 ? 1 : 0;
    const rowH = Math.max(nameLines.length + extra, 2) * 12 + 6;
    newPageIfNeeded(rowH); if (y > H - M - 5) drawHead();
    const vals = [String(n + 1), null, ...(showHsn ? [l.hsn || ''] : []), `${l.qty} ${l.unit}`, rs(l.rate), rs(l.taxable),
      ...(intra ? [rs(l.cgst), rs(l.sgst)] : [rs(l.igst)]), rs(l.amount)];
    vals.forEach((v, i) => { if (v != null) text(v.replace('Rs. ', ''), colX(i), y, { size: 9, f: i === vals.length - 1 ? bold : font, color: i === 0 ? MUTED : INK, align: cols[i][2] }); });
    nameLines.forEach((t, k) => text(t, xs[1], y - k * 12, { size: 9.5 }));
    if (extra) text(`Discount ${l.disc}%`, xs[1], y - nameLines.length * 12, { size: 8, color: MUTED });
    const rateText = intra ? `${l.gst / 2}%` : `${l.gst}%`;
    const taxCols = intra ? [cols.length - 3, cols.length - 2] : [cols.length - 2];
    taxCols.forEach((i) => text(rateText, colX(i), y - 11, { size: 7.5, color: MUTED, align: 'right' }));
    y -= rowH - 4;
    page.drawLine({ start: { x: M, y: y + 4 }, end: { x: W - M, y: y + 4 }, thickness: 0.5, color: LINE });
    y -= 10;
  });
  text('Amounts in Indian Rupees (Rs.)', W - M, y, { size: 7.5, color: MUTED, align: 'right' });
  y -= 22;

  // Totals (right) and amount in words, bank, terms (left)
  newPageIfNeeded(170);
  const top = y, rx = W - M, lx = W - M - 210;
  const totals = [['Taxable value', inv.t.taxable], ...(inv.t.discount > 0 ? [['Discount', -inv.t.discount]] : []),
    ...(intra ? [['CGST', inv.t.cgst], ['SGST', inv.t.sgst]] : [['IGST', inv.t.igst]])];
  totals.forEach(([k, v]) => { text(k, lx, y, { size: 9.5, color: MUTED }); text(rs(v), rx, y, { size: 9.5, align: 'right' }); y -= 15; });
  page.drawLine({ start: { x: lx, y: y + 6 }, end: { x: rx, y: y + 6 }, thickness: 0.8, color: LINE });
  y -= 10;
  text('Grand total', lx, y, { size: 10.5, f: bold });
  text(rs(inv.t.total), rx, y - 1, { size: 14, f: bold, color: ACCENT, align: 'right' });
  if (inv.balance != null && inv.balance !== inv.t.total) { y -= 18; text('Balance due', lx, y, { size: 9.5, f: bold }); text(rs(inv.balance), rx, y, { size: 9.5, f: bold, align: 'right' }); }
  const totalsBottom = y;

  y = top;
  const leftW = lx - M - 24;
  const block = (label, body) => {
    if (!body) return;
    text(label, M, y, { size: 8.5, f: bold, color: MUTED }); y -= 12;
    wrap(body, leftW, 9).forEach((l) => { text(l, M, y, { size: 9 }); y -= 12; });
    y -= 6;
  };
  block('Amount in words', amountInWords(inv.t.total));
  block('Bank details', settings.bank);
  block('Terms', settings.terms);
  if (inv.notes || settings.notes) { wrap(inv.notes || settings.notes, leftW, 9).forEach((l) => { text(l, M, y, { size: 9, f: font, color: MUTED }); y -= 12; }); }

  // Signature
  y = Math.min(y, totalsBottom) - 40;
  newPageIfNeeded(60);
  page.drawLine({ start: { x: M, y: y + 22 }, end: { x: W - M, y: y + 22 }, thickness: 0.5, color: LINE, dashArray: [3, 3] });
  text(`For ${seller.name}`, W - M, y, { size: 9.5, f: bold, align: 'right' });
  text('Authorised signatory', W - M, y - 34, { size: 9, color: MUTED, align: 'right' });

  // Footer on every page
  doc.getPages().forEach((p, i, all) => {
    p.drawText(clean(`${inv.no} - page ${i + 1} of ${all.length} - made with InvoiceDesk`), { x: M, y: 24, size: 7.5, font, color: MUTED });
  });

  const bytes = await doc.save();
  saveFile(new Blob([bytes], { type: 'application/pdf' }), `${inv.no}.pdf`);
}
