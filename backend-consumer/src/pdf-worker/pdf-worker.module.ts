import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PdfGeneratorService } from './pdf-generator.service';
import { PdfProcessor } from './pdf.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'pdf-queue',
    }),
    ClientsModule.register([
      {
        name: 'PUBLISHER_MICROSERVICE',
        transport: Transport.REDIS,
        options: {
          host: process.env.REDIS_HOST || 'localhost',
          port: Number(process.env.REDIS_PORT) || 6379,
        },
      },
    ]),
  ],
  providers: [PdfGeneratorService, PdfProcessor],
  exports: [PdfGeneratorService],
})
export class PdfWorkerModule {}

