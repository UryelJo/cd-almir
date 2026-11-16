import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PdfWorkerModule } from './pdf-worker/pdf-worker.module';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
      },
    }),
    PdfWorkerModule,
  ],
})
export class AppModule {}

