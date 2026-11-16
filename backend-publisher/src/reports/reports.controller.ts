import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Res,
  Sse,
  NotFoundException,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { Response } from 'express';
import { Observable } from 'rxjs';
import * as fs from 'fs';
import * as path from 'path';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';

@Controller('api/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async createReport(@Body() dto: CreateReportDto) {
    return this.reportsService.enqueueReport(dto);
  }

  @Get()
  async getReports() {
    return this.reportsService.getQueueStatus();
  }

  @Sse('events')
  sendEvents(): Observable<MessageEvent> {
    return this.reportsService.getEventsObservable();
  }

  @Get(':id/pdf')
  async downloadPdf(@Param('id') id: string, @Res() res: Response) {
    const storageDir = process.env.PDF_STORAGE_PATH || path.join(process.cwd(), 'storage', 'pdfs');
    const filePath = path.join(storageDir, `report-${id}.pdf`);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(`O relatório PDF #${id} ainda não está pronto ou não foi encontrado.`);
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="relatorio-${id}.pdf"`);
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  }

  @EventPattern('report.status')
  handleReportStatus(@Payload() data: { jobId: string; status: 'waiting' | 'processing'; progress?: number; title?: string }) {
    this.reportsService.broadcastEvent({
      jobId: String(data.jobId),
      status: data.status,
      title: data.title,
      progress: data.progress || 50,
      timestamp: new Date().toISOString(),
    });
  }

  @EventPattern('report.completed')
  handleReportCompleted(@Payload() data: { jobId: string; title?: string; filename: string }) {
    this.reportsService.broadcastEvent({
      jobId: String(data.jobId),
      status: 'completed',
      title: data.title,
      progress: 100,
      downloadUrl: `/api/reports/${data.jobId}/pdf`,
      timestamp: new Date().toISOString(),
    });
  }

  @EventPattern('report.failed')
  handleReportFailed(@Payload() data: { jobId: string; error: string }) {
    this.reportsService.broadcastEvent({
      jobId: String(data.jobId),
      status: 'failed',
      error: data.error,
      progress: 0,
      timestamp: new Date().toISOString(),
    });
  }
}
