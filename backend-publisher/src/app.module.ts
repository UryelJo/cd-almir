import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
      },
    }),
    ReportsModule,
  ],
})
export class AppModule {}

