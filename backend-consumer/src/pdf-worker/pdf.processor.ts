import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Job } from 'bullmq';
import { PdfGeneratorService } from './pdf-generator.service';

@Processor('pdf-queue')
export class PdfProcessor extends WorkerHost {
  constructor(
    private readonly pdfGeneratorService: PdfGeneratorService,
    @Inject('PUBLISHER_MICROSERVICE') private readonly client: ClientProxy,
  ) {
    super();
  }

  async process(job: Job<{ title: string; client: string; html: string; createdAt: string }>): Promise<any> {
    const jobId = String(job.id);

    try {
      this.client.emit('report.status', {
        jobId,
        status: 'processing',
        progress: 35,
        title: job.data.title,
      });

      await job.updateProgress(35);

      const delay = process.env.PROCESSING_DELAY_MS !== undefined
        ? Number(process.env.PROCESSING_DELAY_MS)
        : 5000;

      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      const outputPath = await this.pdfGeneratorService.generatePdf(
        jobId,
        job.data.html,
        job.data.title,
      );

      await job.updateProgress(100);

      this.client.emit('report.completed', {
        jobId,
        title: job.data.title,
        filename: `report-${jobId}.pdf`,
        outputPath,
      });

      return {
        jobId,
        status: 'completed',
        outputPath,
      };
    } catch (error) {
      this.client.emit('report.failed', {
        jobId,
        error: error.message || 'Erro ao renderizar PDF',
      });

      throw error;
    }
  }
}
