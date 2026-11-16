import { Test, TestingModule } from '@nestjs/testing';
import { PdfGeneratorService } from './pdf-generator.service';
import * as fs from 'fs';
import * as path from 'path';

describe('PdfGeneratorService (Renderização Real com Puppeteer)', () => {
  let service: PdfGeneratorService;
  const testStorageDir = path.join(process.cwd(), 'test-storage-pdfs');
  const originalStorageEnv = process.env.PDF_STORAGE_PATH;

  beforeAll(() => {
    process.env.PDF_STORAGE_PATH = testStorageDir;
    if (!fs.existsSync(testStorageDir)) {
      fs.mkdirSync(testStorageDir, { recursive: true });
    }
  });

  afterAll(() => {
    process.env.PDF_STORAGE_PATH = originalStorageEnv;
    if (fs.existsSync(testStorageDir)) {
      fs.rmSync(testStorageDir, { recursive: true, force: true });
    }
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PdfGeneratorService],
    }).compile();

    service = module.get<PdfGeneratorService>(PdfGeneratorService);
  });

  it('deve ser instanciado corretamente', () => {
    expect(service).toBeDefined();
  });

  it('deve renderizar um documento HTML e salvar um arquivo PDF real e válido em disco', async () => {
    const jobId = 'unit-test-render-1';
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            h1 { color: #2563eb; }
          </style>
        </head>
        <body>
          <h1>Relatório de Teste Automatizado</h1>
          <p>Este arquivo foi gerado pelo Puppeteer para validação do pipeline de PDF.</p>
        </body>
      </html>
    `;

    const outputPath = await service.generatePdf(jobId, htmlContent, 'Teste Unitário');

    // 1. Verifica se o caminho retornado corresponde ao esperado
    expect(outputPath).toBe(path.join(testStorageDir, `report-${jobId}.pdf`));

    // 2. Verifica se o arquivo realmente existe fisicamente no disco
    expect(fs.existsSync(outputPath)).toBe(true);

    // 3. Verifica se o tamanho é maior que zero
    const stats = fs.statSync(outputPath);
    expect(stats.size).toBeGreaterThan(100);

    // 4. Verifica se a assinatura binária é de um documento PDF válido (%PDF-)
    const buffer = fs.readFileSync(outputPath);
    const pdfHeader = buffer.subarray(0, 5).toString('ascii');
    expect(pdfHeader).toBe('%PDF-');
  }, 45000); // Timeout ampliado para inicialização do Puppeteer
});

