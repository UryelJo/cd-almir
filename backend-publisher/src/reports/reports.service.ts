import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Subject, Observable } from 'rxjs';
import { CreateReportDto } from './dto/create-report.dto';

export interface ReportEvent {
  jobId: string;
  status: 'waiting' | 'processing' | 'completed' | 'failed';
  title?: string;
  progress?: number;
  downloadUrl?: string;
  error?: string;
  timestamp: string;
}

@Injectable()
export class ReportsService {
  private readonly events$ = new Subject<MessageEvent>();

  constructor(
    @InjectQueue('pdf-queue') private readonly pdfQueue: Queue,
  ) {}

  public buildHtmlTemplate(dto: CreateReportDto): string {
    if (dto.rawHtml && dto.rawHtml.trim().length > 0) {
      return dto.rawHtml;
    }

    const theme = dto.themeColor || '#18181b';
    const author = dto.author || 'Coordenação';
    const summary = dto.summary || 'Demonstrativo detalhado das atividades e serviços executados no período.';
    const notes = dto.notes || 'Documento emitido para fins de prestação de contas e controle interno.';
    const items = dto.items && dto.items.length > 0 ? dto.items : [
      { description: 'Consultoria Especializada', quantity: 1, unitPrice: 1250.0 },
      { description: 'Desenvolvimento e Integração', quantity: 4, unitPrice: 320.0 },
      { description: 'Suporte Técnico e Manutenção', quantity: 1, unitPrice: 500.0 },
    ];

    const total = items.reduce((acc, curr) => acc + (curr.quantity * curr.unitPrice), 0);
    const currentDate = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const itemsRows = items.map((item, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="padding: 12px 16px; font-size: 14px; color: #1e293b;">${item.description}</td>
        <td style="padding: 12px 16px; font-size: 14px; text-align: center; color: #475569;">${item.quantity}</td>
        <td style="padding: 12px 16px; font-size: 14px; text-align: right; color: #475569;">R$ ${Number(item.unitPrice).toFixed(2)}</td>
        <td style="padding: 12px 16px; font-size: 14px; text-align: right; font-weight: 600; color: #0f172a;">R$ ${(item.quantity * item.unitPrice).toFixed(2)}</td>
      </tr>
    `).join('');

    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${dto.title}</title>
  <style>
    @page {
      size: A4;
      margin: 20mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      color: #0f172a;
      background: #ffffff;
      line-height: 1.5;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 3px solid ${theme};
      padding-bottom: 20px;
      margin-bottom: 25px;
    }
    .brand h1 {
      margin: 0;
      font-size: 26px;
      color: ${theme};
      letter-spacing: -0.5px;
    }
    .brand p {
      margin: 4px 0 0 0;
      font-size: 13px;
      color: #64748b;
    }
    .meta-box {
      text-align: right;
      font-size: 12px;
      color: #64748b;
    }
    .meta-box strong {
      color: #1e293b;
    }
    .section-title {
      font-size: 16px;
      font-weight: 700;
      color: #1e293b;
      margin-top: 25px;
      margin-bottom: 10px;
      border-left: 4px solid ${theme};
      padding-left: 8px;
    }
    .summary-card {
      background: #f1f5f9;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 25px;
      font-size: 14px;
      color: #334155;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
      border-radius: 6px;
      overflow: hidden;
    }
    th {
      background: ${theme};
      color: #ffffff;
      font-weight: 600;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 12px 16px;
      text-align: left;
    }
    th.right, td.right {
      text-align: right;
    }
    th.center, td.center {
      text-align: center;
    }
    .total-container {
      margin-top: 20px;
      display: flex;
      justify-content: flex-end;
    }
    .total-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 14px 20px;
      min-width: 220px;
      text-align: right;
    }
    .total-box .label {
      font-size: 12px;
      color: #64748b;
      text-transform: uppercase;
      font-weight: 600;
    }
    .total-box .amount {
      font-size: 24px;
      font-weight: 800;
      color: ${theme};
      margin-top: 4px;
    }
    .footer {
      margin-top: 45px;
      border-top: 1px solid #e2e8f0;
      padding-top: 15px;
      font-size: 11px;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 600;
      background: #f1f5f9;
      color: #1e293b;
      border: 1px solid #cbd5e1;
      margin-bottom: 8px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <span class="badge">RELATÓRIO OFICIAL</span>
      <h1>${dto.title}</h1>
      <p>Cliente / Entidade: <strong>${dto.client}</strong></p>
    </div>
    <div class="meta-box">
      <div>Data de Emissão: <strong>${currentDate}</strong></div>
      <div>Autor: <strong>${author}</strong></div>
      <div>Status: <strong>Verificado</strong></div>
    </div>
  </div>

  <div class="section-title">Resumo Executivo</div>
  <div class="summary-card">
    ${summary}
  </div>

  <div class="section-title">Detalhamento dos Itens / Serviços</div>
  <table>
    <thead>
      <tr>
        <th>Descrição</th>
        <th class="center">Qtd</th>
        <th class="right">Valor Unitário</th>
        <th class="right">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemsRows}
    </tbody>
  </table>

  <div class="total-container">
    <div class="total-box">
      <div class="label">Valor Total Consolidado</div>
      <div class="amount">R$ ${total.toFixed(2)}</div>
    </div>
  </div>

  <div class="section-title">Observações</div>
  <p style="font-size: 13px; color: #475569; margin: 4px 0 10px 0;">
    ${notes}
  </p>

  <div class="footer">
    <span>Documento emitido eletronicamente</span>
    <span>Autenticidade e integridade verificadas</span>
  </div>
</body>
</html>
    `;
  }

  async enqueueReport(dto: CreateReportDto) {
    const html = this.buildHtmlTemplate(dto);
    const job = await this.pdfQueue.add('generate-pdf', {
      title: dto.title,
      client: dto.client,
      html: html,
      createdAt: new Date().toISOString(),
    }, {
      attempts: 3,
      removeOnComplete: 100,
      removeOnFail: 100,
    });

    this.broadcastEvent({
      jobId: String(job.id),
      status: 'waiting',
      title: dto.title,
      progress: 0,
      timestamp: new Date().toISOString(),
    });

    return {
      jobId: String(job.id),
      title: dto.title,
      status: 'waiting',
      message: 'Relatório adicionado à fila de processamento.',
      createdAt: new Date().toISOString(),
    };
  }

  async getQueueStatus() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.pdfQueue.getJobs(['waiting']),
      this.pdfQueue.getJobs(['active']),
      this.pdfQueue.getJobs(['completed']),
      this.pdfQueue.getJobs(['failed']),
    ]);

    const formatJob = (job: any, state: string) => ({
      id: String(job.id),
      state,
      title: job.data?.title || 'Relatório sem título',
      client: job.data?.client || 'Cliente Padrão',
      createdAt: job.data?.createdAt || new Date(job.timestamp).toISOString(),
      progress: job.progress || (state === 'completed' ? 100 : state === 'active' ? 50 : 0),
      downloadUrl: state === 'completed' ? `/api/reports/${job.id}/pdf` : null,
      failedReason: job.failedReason || null,
    });

    const all = [
      ...active.map(j => formatJob(j, 'active')),
      ...waiting.map(j => formatJob(j, 'waiting')),
      ...completed.map(j => formatJob(j, 'completed')),
      ...failed.map(j => formatJob(j, 'failed')),
    ].sort((a, b) => Number(b.id) - Number(a.id));

    return {
      counts: {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        total: waiting.length + active.length + completed.length + failed.length,
      },
      jobs: all,
    };
  }

  broadcastEvent(eventData: ReportEvent) {
    this.events$.next({
      data: eventData,
    } as MessageEvent);
  }

  getEventsObservable(): Observable<MessageEvent> {
    return this.events$.asObservable();
  }
}
