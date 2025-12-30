import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Res,
} from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto, UpdateInvoiceDto, SendInvoiceDto } from './dto/create-invoice.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { InvoiceType } from './invoice.entity';
import { Response } from 'express';
import { InvoicePdfService } from './invoice-pdf.service';
import { UserRole } from '../users/user.entity';

@Controller('invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly invoicePdfService: InvoicePdfService,
  ) {}

  /**
   * Create invoice from order (Admin only)
   */
  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  create(@Body() createInvoiceDto: CreateInvoiceDto) {
    return this.invoicesService.createFromOrder(createInvoiceDto);
  }

  /**
   * Get all invoices with filters
   */
  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  findAll(
    @Query('type') type?: InvoiceType,
    @Query('status') status?: string,
    @Query('vendorId') vendorId?: string,
    @Query('customerId') customerId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.invoicesService.findAll({
      type,
      status: status as any,
      vendorId,
      customerId,
      startDate,
      endDate,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  /**
   * Get vendor invoices (for vendor dashboard)
   */
  @Get('vendor/:vendorId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.VENDOR_ADMIN)
  findVendorInvoices(
    @Param('vendorId') vendorId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.invoicesService.findAll({
      vendorId,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  /**
   * Get customer invoices (for customer dashboard)
   */
  @Get('customer/:customerId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CUSTOMER)
  findCustomerInvoices(
    @Param('customerId') customerId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.invoicesService.findAll({
      customerId,
      type: InvoiceType.CUSTOMER,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  /**
   * Get invoice by ID
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.invoicesService.findOne(id);
  }

  /**
   * Download invoice PDF
   */
  @Get(':id/download')
  async downloadPdf(@Param('id') id: string, @Res() res: Response) {
    const pdfBuffer = await this.invoicePdfService.generateInvoicePdf(id);
    const invoice = await this.invoicesService.findOne(id);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.send(pdfBuffer);
  }

  /**
   * Send invoice via email
   */
  @Post(':id/send')
  @Roles(UserRole.SUPER_ADMIN)
  sendInvoice(@Param('id') id: string, @Body() sendInvoiceDto?: SendInvoiceDto) {
    return this.invoicesService.sendInvoice(id, sendInvoiceDto);
  }

  /**
   * Mark invoice as paid
   */
  @Patch(':id/mark-paid')
  @Roles(UserRole.SUPER_ADMIN)
  markAsPaid(@Param('id') id: string) {
    return this.invoicesService.markAsPaid(id);
  }

  /**
   * Update invoice
   */
  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN)
  update(@Param('id') id: string, @Body() updateInvoiceDto: UpdateInvoiceDto) {
    return this.invoicesService.update(id, updateInvoiceDto);
  }

  /**
   * Delete invoice
   */
  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  delete(@Param('id') id: string) {
    return this.invoicesService.delete(id);
  }

  /**
   * Auto-generate invoices for completed orders (Admin only)
   */
  @Post('auto-generate')
  @Roles(UserRole.SUPER_ADMIN)
  autoGenerate() {
    return this.invoicesService.autoGenerateInvoices();
  }
}
