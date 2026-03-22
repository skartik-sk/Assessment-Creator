import { jsPDF } from 'jspdf';
import { GeneratedPaper } from '../types';

const PDF_MARGIN = 16;
const PDF_LINE_HEIGHT = 5.5;

const ensurePdfSpace = (doc: jsPDF, y: number, requiredHeight = PDF_LINE_HEIGHT) => {
  const pageHeight = doc.internal.pageSize.getHeight();

  if (y + requiredHeight <= pageHeight - PDF_MARGIN) {
    return y;
  }

  doc.addPage();
  return PDF_MARGIN;
};

const writeWrappedText = (
  doc: jsPDF,
  text: string,
  {
    x,
    y,
    maxWidth,
    fontSize = 11,
    fontStyle = 'normal',
    align = 'left',
    lineHeight = PDF_LINE_HEIGHT,
  }: {
    x: number;
    y: number;
    maxWidth: number;
    fontSize?: number;
    fontStyle?: 'normal' | 'bold' | 'italic' | 'bolditalic';
    align?: 'left' | 'center' | 'right';
    lineHeight?: number;
  }
) => {
  doc.setFont('helvetica', fontStyle);
  doc.setFontSize(fontSize);

  const lines = doc.splitTextToSize(text || ' ', maxWidth) as string[];
  let nextY = y;

  for (const line of lines) {
    nextY = ensurePdfSpace(doc, nextY, lineHeight);

    if (align === 'center') {
      doc.text(line, x, nextY, { align: 'center' });
    } else if (align === 'right') {
      doc.text(line, x, nextY, { align: 'right' });
    } else {
      doc.text(line, x, nextY);
    }

    nextY += lineHeight;
  }

  return nextY;
};

export const createPaperPdfDocument = (paper: GeneratedPaper) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - PDF_MARGIN * 2;
  const rightColumnX = pageWidth - PDF_MARGIN;
  let y = PDF_MARGIN;

  y = writeWrappedText(doc, paper.school, {
    x: pageWidth / 2,
    y,
    maxWidth: contentWidth,
    fontSize: 17,
    fontStyle: 'bold',
    align: 'center',
    lineHeight: 7,
  });
  y = writeWrappedText(doc, `Subject: ${paper.subject}`, {
    x: pageWidth / 2,
    y,
    maxWidth: contentWidth,
    fontSize: 12,
    fontStyle: 'bold',
    align: 'center',
  });
  y = writeWrappedText(doc, `Class: ${paper.classLevel}`, {
    x: pageWidth / 2,
    y,
    maxWidth: contentWidth,
    fontSize: 12,
    fontStyle: 'bold',
    align: 'center',
  });
  y += 3;

  y = ensurePdfSpace(doc, y, 8);
  doc.setDrawColor(31, 41, 55);
  doc.setLineWidth(0.4);
  doc.line(PDF_MARGIN, y, pageWidth - PDF_MARGIN, y);
  y += 7;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`Time Allowed: ${paper.timeAllowed}`, PDF_MARGIN, y);
  doc.text(`Maximum Marks: ${paper.maxMarks}`, rightColumnX, y, { align: 'right' });
  y += 8;

  y = writeWrappedText(doc, 'All questions are compulsory unless stated otherwise.', {
    x: PDF_MARGIN,
    y,
    maxWidth: contentWidth,
    fontSize: 10,
    fontStyle: 'bold',
  });
  y += 2;

  y = writeWrappedText(doc, 'Name: ____________________', {
    x: PDF_MARGIN,
    y,
    maxWidth: contentWidth,
    fontSize: 10,
  });
  y = writeWrappedText(doc, 'Roll Number: ____________________', {
    x: PDF_MARGIN,
    y,
    maxWidth: contentWidth,
    fontSize: 10,
  });
  y = writeWrappedText(doc, `Class: ${paper.classLevel}  Section: ____________________`, {
    x: PDF_MARGIN,
    y,
    maxWidth: contentWidth,
    fontSize: 10,
  });
  y += 5;

  for (const section of paper.sections) {
    y = ensurePdfSpace(doc, y, 24);
    y = writeWrappedText(doc, section.title, {
      x: pageWidth / 2,
      y,
      maxWidth: contentWidth,
      fontSize: 13,
      fontStyle: 'bold',
      align: 'center',
      lineHeight: 6.5,
    });
    y += 1;
    y = writeWrappedText(doc, section.subtitle, {
      x: PDF_MARGIN,
      y,
      maxWidth: contentWidth,
      fontSize: 11,
      fontStyle: 'bold',
    });
    y = writeWrappedText(doc, section.instructions, {
      x: PDF_MARGIN,
      y,
      maxWidth: contentWidth,
      fontSize: 10,
      fontStyle: 'italic',
    });
    y += 2;

    section.questions.forEach((question, index) => {
      y = writeWrappedText(doc, `${index + 1}. [${question.difficulty}] ${question.text} [${question.marks} Marks]`, {
        x: PDF_MARGIN,
        y,
        maxWidth: contentWidth,
        fontSize: 10,
        lineHeight: 5.25,
      });
      y += 1.25;
    });

    y += 4;
  }

  y = ensurePdfSpace(doc, y, 18);
  y = writeWrappedText(doc, 'End of Question Paper', {
    x: pageWidth / 2,
    y,
    maxWidth: contentWidth,
    fontSize: 11,
    fontStyle: 'bold',
    align: 'center',
  });
  y += 5;

  y = ensurePdfSpace(doc, y, 14);
  y = writeWrappedText(doc, 'Answer Key:', {
    x: PDF_MARGIN,
    y,
    maxWidth: contentWidth,
    fontSize: 13,
    fontStyle: 'bold',
    lineHeight: 6,
  });
  y += 1;

  paper.answerKey.forEach((answer, index) => {
    y = writeWrappedText(doc, `${index + 1}. ${answer}`, {
      x: PDF_MARGIN,
      y,
      maxWidth: contentWidth,
      fontSize: 10,
      lineHeight: 5.25,
    });
    y += 1.25;
  });

  return doc;
};

export const buildPaperPdfArrayBuffer = (paper: GeneratedPaper) => createPaperPdfDocument(paper).output('arraybuffer');
