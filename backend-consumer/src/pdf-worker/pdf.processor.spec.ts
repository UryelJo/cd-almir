import { Test, TestingModule } from '@nestjs/testing';
import { PdfProcessor } from './pdf.processor';
import { PdfGeneratorService } from './pdf-generator.service';
import { Job } from 'bullmq';

describe('PdfProcessor (Worker BullMQ - Fluxo Real)', () => {
  let processor: PdfProcessor;
  let pdfGeneratorService: PdfGeneratorService;
  let mockClientProxy: any;

  beforeAll(() => {
    process.env.PROCESSING_DELAY_MS = '0';
  });

  beforeEach(async () => {
    mockClientProxy = {
      emit: jest.fn(),
    };

    const mockPdfGeneratorService = {
      generatePdf: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PdfProcessor,
        {
          provide: PdfGeneratorService,
          useValue: mockPdfGeneratorService,
        },
        {
          provide: 'PUBLISHER_MICROSERVICE',
          useValue: mockClientProxy,
        },
      ],
    }).compile();

    processor = module.get<PdfProcessor>(PdfProcessor);
    pdfGeneratorService = module.get<PdfGeneratorService>(PdfGeneratorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('deve processar o job com sucesso, emitir status inicial, gerar PDF e emitir conclusão via microserviço', async () => {
    const mockJob = {
      id: '101',
      data: {
        title: 'Relatório Trimestral',
        client: 'Empresa ABC',
        html: '<html><body>Conteúdo</body></html>',
        createdAt: '2026-11-16T15:00:00Z',
      },
      updateProgress: jest.fn().mockResolvedValue(true),
    } as unknown as Job<any>;

    const expectedOutputPath = '/app/storage/pdfs/report-101.pdf';
    jest.spyOn(pdfGeneratorService, 'generatePdf').mockResolvedValue(expectedOutputPath);

    const result = await processor.process(mockJob);

    // 1. Notificou o início do processamento para o microserviço
    expect(mockClientProxy.emit).toHaveBeenCalledWith('report.status', {
      jobId: '101',
      status: 'processing',
      progress: 35,
      title: 'Relatório Trimestral',
    });

    // 2. Atualizou progresso no BullMQ
    expect(mockJob.updateProgress).toHaveBeenCalledWith(35);

    // 3. Chamou o gerador de PDF Puppeteer com os dados reais
    expect(pdfGeneratorService.generatePdf).toHaveBeenCalledWith(
      '101',
      '<html><body>Conteúdo</body></html>',
      'Relatório Trimestral',
    );

    // 4. Atualizou progresso final no BullMQ
    expect(mockJob.updateProgress).toHaveBeenCalledWith(100);

    // 5. Notificou a conclusão com o nome do arquivo para o microserviço
    expect(mockClientProxy.emit).toHaveBeenCalledWith('report.completed', {
      jobId: '101',
      title: 'Relatório Trimestral',
      filename: 'report-101.pdf',
      outputPath: expectedOutputPath,
    });

    // 6. Retornou o resultado do job
    expect(result).toEqual({
      jobId: '101',
      status: 'completed',
      outputPath: expectedOutputPath,
    });
  });

  it('deve capturar falha no Puppeteer, emitir report.failed para o microserviço e relançar o erro', async () => {
    const mockJob = {
      id: '500',
      data: {
        title: 'Relatório com Falha',
        client: 'Empresa XYZ',
        html: '<html><body>Erro</body></html>',
        createdAt: '2026-11-16T15:00:00Z',
      },
      updateProgress: jest.fn().mockResolvedValue(true),
    } as unknown as Job<any>;

    const errorMsg = 'Chromium out of memory';
    jest.spyOn(pdfGeneratorService, 'generatePdf').mockRejectedValue(new Error(errorMsg));

    // Executa e valida que a exceção é relançada para o BullMQ registrar a falha
    await expect(processor.process(mockJob)).rejects.toThrow(errorMsg);

    // Valida que o evento de falha foi emitido para o microserviço Publisher
    expect(mockClientProxy.emit).toHaveBeenCalledWith('report.failed', {
      jobId: '500',
      error: errorMsg,
    });
  });
});

