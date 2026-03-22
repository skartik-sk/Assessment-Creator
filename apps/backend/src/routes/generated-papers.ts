import { Router } from 'express';
import { GeneratedPaperModel } from '../db/models/GeneratedPaper';
import { getDemoPapersByAssignmentId } from '../demo-store';
import { isDbConfigured } from '../db/mongodb';
import { buildPaperPdfArrayBuffer } from '../pdf/build';
import { addPdfJob, waitForPdfJob } from '../queue/setup';
import { getCache, setCache } from '../redis/client';
import { GeneratedPaper } from '../types';

export const generatedPapersRouter = Router();

const toArrayBuffer = (pdfBuffer: ArrayBuffer | Uint8Array) => {
  if (pdfBuffer instanceof ArrayBuffer) {
    return pdfBuffer;
  }

  const normalized = new ArrayBuffer(pdfBuffer.byteLength);
  new Uint8Array(normalized).set(pdfBuffer);
  return normalized;
};

generatedPapersRouter.get('/:id', async (request, response) => {
  try {
    const { id } = request.params;
    const cacheKey = `generated-papers:${id}`;
    const cached = await getCache<GeneratedPaper[]>(cacheKey);

    if (cached?.length) {
      response.json({ success: true, data: cached });
      return;
    }

    const papers = !isDbConfigured() ? getDemoPapersByAssignmentId(id) : await GeneratedPaperModel.findByAssignmentId(id);
    if (papers.length === 0) {
      response.status(404).json({ success: false, error: 'Generated paper not found.' });
      return;
    }

    await setCache(cacheKey, papers);
    response.json({ success: true, data: papers });
  } catch (error) {
    response.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch generated paper.',
    });
  }
});

generatedPapersRouter.get('/:id/pdf', async (request, response) => {
  try {
    const { id } = request.params;
    const paper = !isDbConfigured()
      ? getDemoPapersByAssignmentId(id)[0] ?? null
      : (await GeneratedPaperModel.findByAssignmentId(id))[0] ?? null;

    if (!paper) {
      response.status(404).json({ success: false, error: 'Generated paper not found.' });
      return;
    }

    const fileName = `question-paper-${paper.assignmentId}.pdf`;

    if (process.env.REDIS_URL) {
      const job = await addPdfJob({ paper });
      const result = await waitForPdfJob(String(job.id));

      if (!result?.success || !result.pdfBase64) {
        response.status(500).json({ success: false, error: result?.error || 'Failed to generate PDF.' });
        return;
      }

      response.setHeader('Content-Type', 'application/pdf');
      response.setHeader('Content-Disposition', `attachment; filename="${result.fileName || fileName}"`);
      response.setHeader('Cache-Control', 'no-store');
      response.send(Buffer.from(result.pdfBase64, 'base64'));
      return;
    }

    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    response.setHeader('Cache-Control', 'no-store');
    response.send(Buffer.from(toArrayBuffer(buildPaperPdfArrayBuffer(paper))));
  } catch (error) {
    response.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate PDF.',
    });
  }
});
