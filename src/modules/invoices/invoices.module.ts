import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoicesService } from './invoices.service';
import { InvoicesController } from './invoices.controller';
import { InvoicePdfService } from './invoice-pdf.service';
import { Invoice } from './invoice.entity';
import { InvoiceItem } from './invoice-item.entity';
import { VendorBalance } from './vendor-balance.entity';
import { Order } from '../orders/order.entity';
import { Vendor } from '../vendors/vendor.entity';
import { SimpleEmailModule } from '../simple-email/simple-email.module';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice, InvoiceItem, VendorBalance, Order, Vendor]),
    SimpleEmailModule,
    AdminModule,
  ],
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoicePdfService],
  exports: [InvoicesService, InvoicePdfService],
})
export class InvoicesModule {}
