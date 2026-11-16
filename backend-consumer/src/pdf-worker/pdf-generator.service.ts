import { Injectable } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class PdfGeneratorService {
  async generatePdf(jobId: string, htmlContent: string, title?: string): Promise<string> {
    const storageDir = process.env.PDF_STORAGE_PATH || path.join(process.cwd(), 'storage', 'pdfs');
    
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }

    const outputPath = path.join(storageDir, `report-${jobId}.pdf`);

    const launchOptions: puppeteer.LaunchOptions = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
      ],
    };

    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    let browser: puppeteer.Browser | null = null;
    let page: puppeteer.Page | null = null;

    try {
      browser = await puppeteer.launch(launchOptions);
      page = await browser.newPage();

      await page.setViewport({ width: 1200, height: 1600 });
      await page.setContent(htmlContent, {
        waitUntil: 'load',
        timeout: 30000,
      });

      await page.pdf({
        path: outputPath,
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        margin: {
          top: '15mm',
          right: '15mm',
          bottom: '15mm',
          left: '15mm',
        },
      });

      return outputPath;
    } finally {
      if (page) {
        await page.close().catch(() => {});
      }
      if (browser) {
        await browser.close().catch(() => {});
      }
    }
  }
}
