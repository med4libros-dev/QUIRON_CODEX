const { PDFDocument, StandardFonts } = require('pdf-lib'); const fs = require('fs');
(async () => { const pdf = await PDFDocument.create(); const f = await pdf.embedFont(StandardFonts.Helvetica);
  for (let p = 1; p <= 800; p++) { const pg = pdf.addPage([595, 842]); for (let l = 0; l < 45; l++) pg.drawText(`Página ${p} · línea ${l} · Fisiopatología de la sepsis y choque séptico, manejo inicial`, { x: 40, y: 800 - l * 17, size: 10, font: f }); }
  fs.writeFileSync('/tmp/tc/big.pdf', await pdf.save()); console.log('big', fs.statSync('/tmp/tc/big.pdf').size); })();
