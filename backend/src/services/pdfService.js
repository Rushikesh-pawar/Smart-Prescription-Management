import PDFDocument from 'pdfkit';
import fs from 'node:fs';
import path from 'node:path';

const PDF_DIR = path.resolve('generated-pdfs');
fs.mkdirSync(PDF_DIR, { recursive: true });

export async function generatePrescriptionPDF({ doctor, patient, prescription }) {
  const fileName = `prescription-${prescription._id}.pdf`;
  const filePath = path.join(PDF_DIR, fileName);

  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    doc
      .fontSize(20)
      .font('Helvetica-Bold')
      .text(doctor.clinicName || 'Prescription', { align: 'center' });
    doc
      .fontSize(11)
      .font('Helvetica')
      .text(
        `Dr. ${doctor.name}${doctor.specialization ? ` · ${doctor.specialization}` : ''}`,
        { align: 'center' }
      );
    if (doctor.registrationNumber) {
      doc.fontSize(9).fillColor('gray').text(`Reg. No.: ${doctor.registrationNumber}`, {
        align: 'center',
      });
      doc.fillColor('black');
    }
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown();

    doc.fontSize(11);
    doc.text(`Patient: ${patient.name}`);
    doc.text(`Phone: ${patient.phone}${patient.email ? ' · ' + patient.email : ''}`);
    const vitalsBits = [
      `Age: ${prescription.ageAtVisit}`,
      `Sex: ${patient.sex}`,
      prescription.weightKg && `Weight: ${prescription.weightKg} kg`,
      prescription.heightCm && `Height: ${prescription.heightCm} cm`,
      prescription.bmi && `BMI: ${prescription.bmi}`,
    ].filter(Boolean);
    doc.text(vitalsBits.join(' · '));
    doc.text(`Date: ${new Date(prescription.createdAt).toLocaleString()}`);
    doc.moveDown();

    doc.fontSize(13).font('Helvetica-Bold').text('Diagnosis');
    doc.font('Helvetica').fontSize(11).text(prescription.diagnosis);

    if (prescription.icd10Codes?.length) {
      doc.moveDown(0.3);
      doc.fontSize(9).fillColor('gray');
      doc.text(
        'Suggested ICD-10: ' +
          prescription.icd10Codes
            .map((c) => `${c.code} (${c.description})`)
            .join(', ')
      );
      doc.fillColor('black');
    }
    doc.moveDown();

    doc.fontSize(13).font('Helvetica-Bold').text('Medications (Rx)');
    doc.font('Helvetica').fontSize(11);
    if (prescription.medications.length === 0) {
      doc.fillColor('gray').text('— none —').fillColor('black');
    }
    prescription.medications.forEach((m, i) => {
      doc.text(`${i + 1}.  ${m.name}${m.dosage ? ' — ' + m.dosage : ''}`);
      const detail = [m.frequency, m.duration, m.notes].filter(Boolean).join(' · ');
      if (detail) {
        doc.fontSize(10).fillColor('gray').text('     ' + detail).fillColor('black').fontSize(11);
      }
    });
    doc.moveDown();

    if (prescription.interactionFlags?.length) {
      doc.fontSize(13).font('Helvetica-Bold').fillColor('#b91c1c').text('⚠ Interaction Warnings');
      doc.font('Helvetica').fontSize(10).fillColor('black');
      prescription.interactionFlags.forEach((f) => {
        doc.text(`• [${f.severity}] ${f.drugs.join(' + ')}: ${f.description}`);
      });
      doc.moveDown();
    }

    if (prescription.patientFriendlySummary) {
      doc.fontSize(13).font('Helvetica-Bold').text('In Plain Language');
      doc.font('Helvetica').fontSize(11).text(prescription.patientFriendlySummary, {
        align: 'left',
      });
      doc.moveDown();
    }

    const sigY = Math.max(doc.y, 680);
    doc.fontSize(11).font('Helvetica').text(`Dr. ${doctor.name}`, 380, sigY + 30);
    doc.moveTo(380, sigY + 25).lineTo(540, sigY + 25).stroke();

    doc
      .fontSize(8)
      .fillColor('gray')
      .text(
        'Educational/portfolio project. Not for clinical use. Always consult a qualified medical professional.',
        50,
        780,
        { align: 'center', width: 495 }
      );
    doc.fillColor('black');

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  return {
    fileName,
    filePath,
    publicPath: `/pdfs/${fileName}`,
  };
}
