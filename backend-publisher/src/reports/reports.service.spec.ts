import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { ReportsService, ReportEvent } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';

describe('ReportsService (Fluxo Real)', () => {
  let service: ReportsService;
  let mockQueue: any;

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn(),
      getJobs: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        {
          provide: getQueueToken('pdf-queue'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('buildHtmlTemplate', () => {
    it('deve gerar template HTML completo e válido com itens, cálculos e estilos', () => {
      const dto: CreateReportDto = {
        title: 'Relatório Financeiro Q3',
        client: 'Tech Corp',
        author: 'Audit Team',
        themeColor: '#10b981',
        summary: 'Resumo das operações trimestrais.',
        notes: 'Relatório gerado em ambiente seguro.',
        items: [
          { description: 'Consultoria Cloud', quantity: 2, unitPrice: 500.0 },
          { description: 'Setup Docker', quantity: 1, unitPrice: 1000.0 },
        ],
      };

      const html = service.buildHtmlTemplate(dto);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Relatório Financeiro Q3');
      expect(html).toContain('Tech Corp');
      expect(html).toContain('Audit Team');
      expect(html).toContain('#10b981');
      expect(html).toContain('Consultoria Cloud');
      expect(html).toContain('Setup Docker');
      // Total: 2*500 + 1*1000 = 2000.00
      expect(html).toContain('R$ 2000.00');
    });

    it('deve retornar o rawHtml diretamente quando fornecido pelo usuário', () => {
      const customHtml = '<html><body><h1>HTML Personalizado Direto</h1></body></html>';
      const dto: CreateReportDto = {
        title: 'Custom HTML Report',
        client: 'Client X',
        rawHtml: customHtml,
      };

      const html = service.buildHtmlTemplate(dto);
      expect(html).toBe(customHtml);
    });
  });

  describe('enqueueReport', () => {
    it('deve adicionar o job com o HTML montado na fila BullMQ e disparar evento inicial SSE', async () => {
      const dto: CreateReportDto = {
        title: 'Relatório de Produção',
        client: 'Indústria ABC',
        themeColor: '#2563eb',
      };

      const mockJob = {
        id: '42',
        data: { title: dto.title },
      };

      mockQueue.add.mockResolvedValue(mockJob);

      // Espiona o broadcast de eventos
      const broadcastSpy = jest.spyOn(service, 'broadcastEvent');

      const result = await service.enqueueReport(dto);

      // Valida chamada na fila BullMQ
      expect(mockQueue.add).toHaveBeenCalledWith(
        'generate-pdf',
        expect.objectContaining({
          title: 'Relatório de Produção',
          client: 'Indústria ABC',
          html: expect.stringContaining('Relatório de Produção'),
          createdAt: expect.any(String),
        }),
        expect.objectContaining({
          attempts: 3,
        }),
      );

      // Valida evento SSE emitido
      expect(broadcastSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: '42',
          status: 'waiting',
          title: 'Relatório de Produção',
          progress: 0,
        }),
      );

      // Valida resposta da função
      expect(result).toEqual({
        jobId: '42',
        title: 'Relatório de Produção',
        status: 'waiting',
        message: 'Relatório adicionado à fila de processamento.',
        createdAt: expect.any(String),
      });
    });
  });

  describe('getQueueStatus', () => {
    it('deve consultar a fila BullMQ para todos os estados e calcular métricas e ordenação', async () => {
      mockQueue.getJobs.mockImplementation((states: string[]) => {
        if (states.includes('waiting')) {
          return Promise.resolve([
            { id: '1', data: { title: 'Job 1', client: 'C1' }, timestamp: 1000 },
          ]);
        }
        if (states.includes('active')) {
          return Promise.resolve([
            { id: '2', data: { title: 'Job 2', client: 'C2' }, progress: 50, timestamp: 2000 },
          ]);
        }
        if (states.includes('completed')) {
          return Promise.resolve([
            { id: '3', data: { title: 'Job 3', client: 'C3' }, progress: 100, timestamp: 3000 },
          ]);
        }
        if (states.includes('failed')) {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });

      const status = await service.getQueueStatus();

      expect(status.counts).toEqual({
        waiting: 1,
        active: 1,
        completed: 1,
        failed: 0,
        total: 3,
      });

      // Ordenação decrescente por ID: 3, 2, 1
      expect(status.jobs.length).toBe(3);
      expect(status.jobs[0].id).toBe('3');
      expect(status.jobs[0].state).toBe('completed');
      expect(status.jobs[0].downloadUrl).toBe('/api/reports/3/pdf');

      expect(status.jobs[1].id).toBe('2');
      expect(status.jobs[1].state).toBe('active');
      expect(status.jobs[1].downloadUrl).toBeNull();
    });
  });

  describe('SSE Stream (broadcastEvent & getEventsObservable)', () => {
    it('deve transmitir eventos em tempo real para os subscribers do SSE', (done) => {
      const eventToEmit: ReportEvent = {
        jobId: '99',
        status: 'completed',
        title: 'Relatório Teste SSE',
        progress: 100,
        downloadUrl: '/api/reports/99/pdf',
        timestamp: new Date().toISOString(),
      };

      const observable = service.getEventsObservable();

      observable.subscribe({
        next: (messageEvent: any) => {
          expect(messageEvent.data).toEqual(eventToEmit);
          done();
        },
      });

      service.broadcastEvent(eventToEmit);
    });
  });
});

