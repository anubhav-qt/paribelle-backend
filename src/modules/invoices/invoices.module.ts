import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoicesService } from './invoices.service';
import { InvoicesController } from './invoices.controller';
import { InvoicePdfService } from './invoice-pdf.service';
import { Invoice } from './invoice.entity';
import { Order } from '../orders/order.entity';
import { SimpleEmailModule } from '../simple-email/simple-email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice, Order]),
    SimpleEmailModule,
  ],
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoicePdfService],
  exports: [InvoicesService, InvoicePdfService],
})
export class InvoicesModule {}
