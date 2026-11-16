import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface ReportItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface ReportJob {
  id: string;
  title: string;
  client: string;
  state: 'waiting' | 'active' | 'processing' | 'completed' | 'failed';
  progress: number;
  downloadUrl?: string | null;
  createdAt: string;
  failedReason?: string | null;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy {
  sseConnected = false;
  private eventSource: EventSource | null = null;
  apiUrl = '/api';

  reportTitle = 'Relatório de Prestação de Contas';
  clientName = 'Faculdade FEMA';
  authorName = 'Coordenação';
  themeColor = '#18181b';
  summaryText = 'Demonstrativo detalhado dos serviços prestados e custos apurados durante o período de exercício.';
  notesText = 'Documento emitido para fins de conferência, prestação de contas e controle interno.';
  
  useCustomHtml = false;
  customHtml = '';

  items: ReportItem[] = [
    { description: 'Consultoria Especializada', quantity: 1, unitPrice: 2400.0 },
    { description: 'Desenvolvimento e Integração', quantity: 2, unitPrice: 850.0 },
    { description: 'Manutenção de Sistemas', quantity: 1, unitPrice: 1200.0 },
    { description: 'Suporte Técnico e Treinamento', quantity: 1, unitPrice: 950.0 },
  ];

  submitting = false;
  batchSubmitting = false;
  jobs: ReportJob[] = [];
  queueCounts = {
    waiting: 0,
    active: 0,
    completed: 0,
    failed: 0,
    total: 0,
  };

  presetColors = [
    { name: 'Azul Real', hex: '#2563eb' },
    { name: 'Esmeralda', hex: '#10b981' },
    { name: 'Roxo Tech', hex: '#7c3aed' },
    { name: 'Laranja Solar', hex: '#f97316' },
    { name: 'Grafite', hex: '#334155' },
  ];

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.detectApiUrl();
    this.fetchInitialQueue();
    this.initSseConnection();
  }

  ngOnDestroy(): void {
    if (this.eventSource) {
      this.eventSource.close();
    }
  }

  private detectApiUrl() {
    if (window.location.port === '4200') {
      this.apiUrl = 'http://localhost:3000/api';
    } else {
      this.apiUrl = '/api';
    }
  }

  private initSseConnection() {
    const sseUrl = `${this.apiUrl}/reports/events`;

    try {
      this.eventSource = new EventSource(sseUrl);

      this.eventSource.onopen = () => {
        this.sseConnected = true;
        this.cdr.detectChanges();
      };

      this.eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          this.handleRealtimeEvent(payload);
        } catch {
          // Erro de parse ignorado silenciosamente
        }
      };

      this.eventSource.onerror = () => {
        this.sseConnected = false;
        this.cdr.detectChanges();
      };
    } catch {
      this.sseConnected = false;
    }
  }

  private handleRealtimeEvent(event: any) {
    const existingIndex = this.jobs.findIndex(j => j.id === String(event.jobId));
    const normalizedState = (event.status === 'processing' || event.status === 'active') ? 'active' : event.status;

    if (existingIndex !== -1) {
      this.jobs[existingIndex] = {
        ...this.jobs[existingIndex],
        state: normalizedState,
        progress: event.progress !== undefined ? event.progress : (normalizedState === 'completed' ? 100 : 50),
        downloadUrl: event.downloadUrl || (normalizedState === 'completed' ? `${this.apiUrl}/reports/${event.jobId}/pdf` : null),
        failedReason: event.error || null,
      };
    } else {
      this.jobs.unshift({
        id: String(event.jobId),
        title: event.title || `Relatório #${event.jobId}`,
        client: 'Processado em lote/evento',
        state: normalizedState,
        progress: event.progress || (normalizedState === 'completed' ? 100 : normalizedState === 'active' ? 50 : 0),
        downloadUrl: event.downloadUrl || (normalizedState === 'completed' ? `${this.apiUrl}/reports/${event.jobId}/pdf` : null),
        createdAt: event.timestamp || new Date().toISOString(),
        failedReason: event.error || null,
      });
    }

    this.recalculateCounts();
    this.cdr.detectChanges();
  }

  async fetchInitialQueue() {
    try {
      const response = await fetch(`${this.apiUrl}/reports`);
      if (response.ok) {
        const data = await response.json();
        this.queueCounts = data.counts || this.queueCounts;
        this.jobs = data.jobs || [];
        this.cdr.detectChanges();
      }
    } catch {
      // Ignora falha inicial se a API ainda estiver subindo
    }
  }

  private recalculateCounts() {
    let waiting = 0;
    let active = 0;
    let completed = 0;
    let failed = 0;

    for (const job of this.jobs) {
      if (job.state === 'waiting') waiting++;
      else if (job.state === 'active' || job.state === 'processing') active++;
      else if (job.state === 'completed') completed++;
      else if (job.state === 'failed') failed++;
    }

    this.queueCounts = {
      waiting,
      active,
      completed,
      failed,
      total: this.jobs.length,
    };
  }

  addItem() {
    this.items.push({
      description: 'Novo Item / Serviço',
      quantity: 1,
      unitPrice: 100.0,
    });
  }

  removeItem(index: number) {
    if (this.items.length > 1) {
      this.items.splice(index, 1);
    }
  }

  calculateTotal(): number {
    return this.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  }

  async submitReport() {
    if (!this.reportTitle || !this.clientName) {
      alert('Por favor, preencha o Título e o Nome do Cliente!');
      return;
    }

    this.submitting = true;

    const payload = {
      title: this.reportTitle,
      client: this.clientName,
      author: this.authorName,
      themeColor: this.themeColor,
      summary: this.summaryText,
      notes: this.notesText,
      items: this.items,
      rawHtml: this.useCustomHtml ? this.customHtml : undefined,
    };

    try {
      const response = await fetch(`${this.apiUrl}/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Falha no envio: ${response.statusText}`);
      }

      await this.fetchInitialQueue();
    } catch (err: any) {
      alert(`Erro ao enfileirar relatório: ${err.message}`);
    } finally {
      this.submitting = false;
      this.cdr.detectChanges();
    }
  }

  async submitBatchDemo() {
    this.batchSubmitting = true;
    const batchTemplates = [
      { title: 'Auditoria de Conformidade', client: 'Banco Alfa S.A.', color: '#18181b' },
      { title: 'Balanço Operacional', client: 'Logística Brasil', color: '#27272a' },
      { title: 'Prestação de Contas Q3', client: 'Grupo Varejo', color: '#3f3f46' },
      { title: 'Relatório de Atividades', client: 'Telecom Global', color: '#18181b' },
      { title: 'Certificado de Conclusão', client: 'Hospital Vida', color: '#27272a' },
    ];

    try {
      for (const item of batchTemplates) {
        await fetch(`${this.apiUrl}/reports`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: item.title,
            client: item.client,
            author: 'Coordenação',
            themeColor: item.color,
            summary: `Demonstrativo resumido das operações e apurações para ${item.client}.`,
            items: [
              { description: 'Verificação e auditoria de processos', quantity: 2, unitPrice: 450 },
              { description: 'Emissão de laudo técnico', quantity: 1, unitPrice: 600 },
            ],
            notes: 'Documento homologado eletronicamente.',
          }),
        });
      }
      await this.fetchInitialQueue();
    } finally {
      this.batchSubmitting = false;
      this.cdr.detectChanges();
    }
  }

  getPdfUrl(jobId: string): string {
    return `${this.apiUrl}/reports/${jobId}/pdf`;
  }

  openPdf(jobId: string) {
    window.open(this.getPdfUrl(jobId), '_blank');
  }
}
