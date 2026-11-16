import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import * as fs from 'fs';
import * as path from 'path';

describe('ReportsController (Fluxo Real)', () => {
  let controller: ReportsController;
  let reportsService: ReportsService;

  const mockReportsService = {
    enqueueReport: jest.fn(),
    getQueueStatus: jest.fn(),
    getEventsObservable: jest.fn(),
    broadcastEvent: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        {
          provide: ReportsService,
          useValue: mockReportsService,
        },
      ],
    }).compile();

    controller = module.get<ReportsController>(ReportsController);
    reportsService = module.get<ReportsService>(ReportsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createReport', () => {
    it('deve repassar o DTO para o serviço e retornar a confirmação do enfileiramento', async () => {
      const dto: CreateReportDto = {
        title: 'Relatório de Demonstração',
        client: 'Universidade',
      };

      const mockResponse = {
        jobId: '10',
        title: dto.title,
        status: 'waiting' as const,
        message: 'Relatório adicionado à fila de processamento.',
        createdAt: new Date().toISOString(),
      };

      mockReportsService.enqueueReport.mockResolvedValue(mockResponse);

      const result = await controller.createReport(dto);

      expect(mockReportsService.enqueueReport).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getReports', () => {
    it('deve retornar a visão geral de status e contagens da fila', async () => {
      const mockQueueStatus = {
        counts: { waiting: 2, active: 1, completed: 5, failed: 0, total: 8 },
        jobs: [],
      };

      mockReportsService.getQueueStatus.mockResolvedValue(mockQueueStatus);

      const result = await controller.getReports();

      expect(mockReportsService.getQueueStatus).toHaveBeenCalled();
      expect(result).toEqual(mockQueueStatus);
    });
  });

  describe('downloadPdf', () => {
    it('deve lançar NotFoundException se o arquivo PDF não existir no disco', async () => {
      const mockRes: any = {
        setHeader: jest.fn(),
      };

      // ID inexistente
      await expect(controller.downloadPdf('99999', mockRes)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deve configurar headers e fazer o stream do arquivo quando o PDF existir', async () => {
      // Cria temporariamente um arquivo de teste no storage
      const storageDir = process.env.PDF_STORAGE_PATH || path.join(process.cwd(), 'storage', 'pdfs');
      if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
      }

      const testJobId = 'test-unit-1';
      const testFilePath = path.join(storageDir, `report-${testJobId}.pdf`);
      fs.writeFileSync(testFilePath, '%PDF-1.4 Mock PDF Content');

      try {
        const mockPipe = jest.fn();
        const mockRes: any = {
          setHeader: jest.fn(),
        };

        // Espiona createReadStream para validar o pipe
        jest.spyOn(fs, 'createReadStream').mockReturnValue({
          pipe: mockPipe,
        } as any);

        await controller.downloadPdf(testJobId, mockRes);

        expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
        expect(mockRes.setHeader).toHaveBeenCalledWith(
          'Content-Disposition',
          `inline; filename="relatorio-${testJobId}.pdf"`,
        );
        expect(mockPipe).toHaveBeenCalledWith(mockRes);
      } finally {
        if (fs.existsSync(testFilePath)) {
          fs.unlinkSync(testFilePath);
        }
        jest.restoreAllMocks();
      }
    });
  });

  describe('Microservice Event Patterns (Redis)', () => {
    it('deve processar evento report.status emitido pelo worker consumer e propagar via SSE', () => {
      controller.handleReportStatus({
        jobId: '15',
        status: 'processing',
        progress: 40,
        title: 'Relatório em Andamento',
      });

      expect(mockReportsService.broadcastEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: '15',
          status: 'processing',
          progress: 40,
          title: 'Relatório em Andamento',
        }),
      );
    });

    it('deve processar evento report.completed emitido pelo worker consumer e propagar via SSE', () => {
      controller.handleReportCompleted({
        jobId: '15',
        title: 'Relatório Concluído',
        filename: 'report-15.pdf',
      });

      expect(mockReportsService.broadcastEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: '15',
          status: 'completed',
          title: 'Relatório Concluído',
          progress: 100,
          downloadUrl: '/api/reports/15/pdf',
        }),
      );
    });

    it('deve processar evento report.failed emitido pelo worker consumer e propagar via SSE', () => {
      controller.handleReportFailed({
        jobId: '15',
        error: 'Erro de renderização do Chromium',
      });

      expect(mockReportsService.broadcastEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: '15',
          status: 'failed',
          error: 'Erro de renderização do Chromium',
          progress: 0,
        }),
      );
    });
  });
});

