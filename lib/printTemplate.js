// Shared print template — matches GAS getReportPrintCSS() exactly

export function getPrintCSS(orientation = 'portrait') {
  return `
    @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap');
    * { box-sizing: border-box; }
    body {
      font-family: 'Sarabun', 'Tahoma', sans-serif;
      margin: 0; padding: 5mm;
      font-size: 11px; color: #000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      background: white;
    }
    @page { size: A4 ${orientation}; margin: 15mm 20mm; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    th, td { border: 1px solid #000; padding: 3px 2px; text-align: center; vertical-align: middle; font-size: 11px; line-height: 1.2; }
    th { background-color: #e2e8f0 !important; font-weight: bold; color: #000; }
    .text-left { text-align: left !important; padding-left: 5px !important; }
    .nowrap { white-space: nowrap; }
    .col-total { font-weight: bold; background-color: #f1f5f9 !important; }
    .print-header { text-align: center; margin-bottom: 8px; }
    .print-header h2 { margin: 1px 0; font-size: 16px; }
    .print-header h3 { margin: 1px 0; font-size: 15px; }
    .print-header h4 { margin: 1px 0; font-size: 13px; font-weight: normal; }
    .signature-section-3 { display: flex; justify-content: space-between; margin-top: 15px; text-align: center; font-size: 12px; padding: 0 10px; page-break-inside: avoid; }
    .signature-box-3 { width: 30%; }
    .sign-line { border-bottom: 1px dotted #000; display: inline-block; width: 85%; margin-bottom: 3px; height: 18px; }
    .print-note-box { width: 95%; margin: 5px auto; padding: 6px; border: 1px solid #000; font-size: 11px; line-height: 1.3; text-align: left; border-radius: 5px; background: transparent; }
    .vertical-text { writing-mode: vertical-rl; transform: rotate(180deg); white-space: nowrap; font-size: 12px; margin: 0 auto; }
    .signature-boss { text-align: center; margin-top: 20px; font-size: 12px; page-break-inside: avoid; }
    @media print { .no-print, button, select, input, textarea { display: none !important; } }
    a { color: #000; text-decoration: none; }
  `;
}

export function makePrintHeader(schoolName, title, subtitle) {
  return `
    <div class="print-header">
      <h3>${title} <span>${schoolName}</span></h3>
      ${subtitle ? `<h4 style="margin-top:5px;font-weight:normal;">${subtitle}</h4>` : ''}
    </div>
  `;
}

// 2-person signature: teacher left, director right
export function makeSignature2(teacherName, directorName, schoolName) {
  return `
    <div class="signature-section-3" style="justify-content:space-around; margin-top:40px;">
      <div class="signature-box-3">
        <div class="sign-line" style="width:200px;"></div><br/>
        (${teacherName || '...........................'})<br/>ครูประจำชั้น
      </div>
      <div class="signature-box-3">
        <div class="sign-line" style="width:200px;"></div><br/>
        (${directorName || '...........................'})<br/>ผู้อำนวยการ${schoolName ? schoolName : ''}
      </div>
    </div>
  `;
}

// 3-person signature: teacher, witness/head, director
export function makeSignature3(teacherName, headName, directorName, schoolName) {
  return `
    <div class="signature-section-3" style="margin-top:40px;">
      <div class="signature-box-3">
        <div class="sign-line"></div><br/>
        (${teacherName || '...........................'})<br/>ครูประจำชั้น
      </div>
      <div class="signature-box-3">
        <div class="sign-line"></div><br/>
        (${headName || '...........................'})<br/>หัวหน้าฝ่ายวิชาการ
      </div>
      <div class="signature-box-3">
        <div class="sign-line"></div><br/>
        (${directorName || '...........................'})<br/>ผู้อำนวยการ${schoolName ? schoolName : ''}
      </div>
    </div>
  `;
}

export function makeNoteBox(content) {
  return `<div class="print-note-box">${content}</div>`;
}

export function makePrintWindow(bodyHtml, orientation = 'portrait') {
  const html = `<!DOCTYPE html><html><head>
    <meta charset="utf-8">
    <title>พิมพ์รายงาน</title>
    <style>${getPrintCSS(orientation)}</style>
  </head><body>
    ${bodyHtml}
  </body></html>`;
  const w = window.open('', '_blank', 'width=900,height=700');
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 800);
}
