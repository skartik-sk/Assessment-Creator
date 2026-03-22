import { Router } from 'express';
import multer from 'multer';
import { SourceFile } from '../types';

const MAX_SOURCE_FILE_SIZE = 10 * 1024 * 1024;
const MAX_EXTRACTED_TEXT_LENGTH = 12000;
const SUPPORTED_FILE_MESSAGE = 'Only PDF and text files are supported.';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_SOURCE_FILE_SIZE,
  },
});

const trimExtractedText = (value: string | undefined) => value?.replace(/\s+/g, ' ').trim().slice(0, MAX_EXTRACTED_TEXT_LENGTH);

export const uploadsRouter = Router();

uploadsRouter.post('/extract', upload.single('file'), async (request, response) => {
  try {
    const fileEntry = request.file;

    if (!fileEntry) {
      response.status(400).json({ success: false, error: 'File is required.' });
      return;
    }

    const normalizedType =
      fileEntry.mimetype || (fileEntry.originalname.toLowerCase().endsWith('.txt') ? 'text/plain' : 'application/octet-stream');
    const isTextFile = normalizedType === 'text/plain' || fileEntry.originalname.toLowerCase().endsWith('.txt');
    const isPdfFile = normalizedType === 'application/pdf' || fileEntry.originalname.toLowerCase().endsWith('.pdf');

    if (!isTextFile && !isPdfFile) {
      response.status(400).json({ success: false, error: SUPPORTED_FILE_MESSAGE });
      return;
    }

    const sourceFile: SourceFile = {
      name: fileEntry.originalname,
      type: normalizedType,
      size: fileEntry.size,
    };

    if (isTextFile) {
      sourceFile.extractedText = trimExtractedText(fileEntry.buffer.toString('utf-8'));
    }

    if (isPdfFile) {
      const { PDFParse } = await import('pdf-parse');
      const parser = new PDFParse({ data: fileEntry.buffer });

      try {
        const textResult = await parser.getText();
        sourceFile.extractedText = trimExtractedText(textResult.text);
      } finally {
        await parser.destroy();
      }
    }

    response.json({ success: true, data: sourceFile });
  } catch (error) {
    response.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process file.',
    });
  }
});
