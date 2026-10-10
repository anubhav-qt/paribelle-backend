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
  Request,
  NotFoundException,
  ForbiddenException,
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
import { isStoreAdmin } from '../../common/decorators/admin-only.decorator';

@Controller('invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly invoicePdfService: InvoicePdfService,
  ) {}

  /**
   * An invoice carries the customer's name, address and phone. Admins see
   * any; a customer only their own customer invoice. Anyone else gets the
   * same 404 as a made-up id.
   */
  private async findVisible(id: string, user: any) {
    const invoice = await this.invoicesService.findOne(id);
    if (!isStoreAdmin(user) && (invoice.customerId !== user?.id || invoice.type !== InvoiceType.CUSTOMER)) {
      throw new NotFoundException('Invoice not found');
    }
    return invoice;
  }

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
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.invoicesService.findAll({
      status: status as any,
      customerId,
      startDate,
      endDate,
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
    @Request() req,
    @Param('customerId') customerId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (!isStoreAdmin(req.user) && customerId !== req.user.id) {
      throw new ForbiddenException('You can only see your own invoices');
    }
    return this.invoicesService.findAll({
      customerId,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  /**
   * Get invoice by ID
   */
  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.findVisible(id, req.user);
  }

  /**
   * Download invoice PDF
   */
  @Get(':id/download')
  async downloadPdf(@Request() req, @Param('id') id: string, @Res() res: Response) {
    const invoice = await this.findVisible(id, req.user);
    const pdfBuffer = await this.invoicePdfService.generateInvoicePdf(id);

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
