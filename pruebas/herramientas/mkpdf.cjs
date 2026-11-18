const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const fs = require('fs');
(async () => {
  const pdf = await PDFDocument.create();
  const f = await pdf.embedFont(StandardFonts.Helvetica), b = await pdf.embedFont(StandardFonts.HelveticaBold);
  const paras = [
    'La insuficiencia cardiaca es un síndrome clínico caracterizado por síntomas como disnea y fatiga, causado por una alteración estructural o funcional del corazón.',
    'La clasificación de la NYHA divide a los pacientes en cuatro clases funcionales según la limitación de la actividad física.',
    'El tratamiento de primera línea en la insuficiencia cardiaca con fracción de expulsión reducida incluye inhibidores de la enzima convertidora de angiotensina, betabloqueadores y antagonistas de mineralocorticoides.',
    'Los péptidos natriuréticos son útiles para el diagnóstico; un BNP normal hace poco probable la insuficiencia cardiaca.',
    'La ecocardiografía es el estudio de elección para evaluar la fracción de expulsión del ventrículo izquierdo.',
    'Los datos de alarma incluyen hipotensión, edema agudo pulmonar y deterioro de la función renal.',
  ];
  for (let p = 1; p <= 40; p++) {
    const page = pdf.addPage([595, 842]); let y = 780;
    page.drawText(`Capítulo ${Math.ceil(p/5)} · Insuficiencia cardiaca (p. ${p})`, { x: 56, y, size: 15, font: b }); y -= 34;
    for (let k = 0; k < 6; k++) {
      const words = paras[(p + k) % paras.length].split(' '); let line = '';
      for (const w of words) { const c = line ? line + ' ' + w : w; if (f.widthOfTextAtSize(c, 11) > 480) { page.drawText(line, { x: 56, y, size: 11, font: f }); y -= 16; line = w; } else line = c; }
      page.drawText(line, { x: 56, y, size: 11, font: f }); y -= 26;
    }
    page.drawRectangle({ x: 56, y: 90, width: 480, height: 60, color: rgb(0.93,0.95,0.97) });
  }
  fs.writeFileSync(`${process.env.QC_TC || '/tmp/tc'}/test.pdf`, await pdf.save()); console.log('pdf ok');
})();
