import { NestFactory } from '@nestjs/core';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const storageDir = process.env.PDF_STORAGE_PATH || path.join(process.cwd(), 'storage', 'pdfs');
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }

  const app = await NestFactory.createApplicationContext(AppModule);
  await app.init();
}

bootstrap();
