# Phase 3: Invoice Generation System

Complete invoice generation system with PDF generation, email notifications, and admin/vendor dashboards.

## Features

### 1. Invoice Types
- **Customer Invoices**: Sales invoices sent to customers
- **Vendor Payout Statements**: Payout details showing commission deductions
- **Platform Commission Invoices**: Commission invoices for the marketplace

### 2. Invoice Generation
- Automatic invoice generation from completed orders
- Manual invoice creation via admin panel
- Bulk auto-generation for all eligible orders
- Invoice numbering system (INV-{timestamp}-{random})

### 3. PDF Generation
- Professional PDF templates using PDFKit
- Branded invoice design
- Itemized product listing
- Tax and commission breakdowns
- Company logo and branding
- HSN code support

### 4. Email Notifications
- Automatic email sending with PDF attachment
- Customizable email templates
- Email delivery tracking
- Resend capability

### 5. Admin Dashboard
- View all invoices (customer, vendor, platform)
- Filter by type, status, vendor, date range
- Send invoices via email
- Mark invoices as paid
- Download PDFs
- Auto-generate invoices for completed orders
- Pagination support

### 6. Vendor Dashboard
- View payout statements
- Summary statistics (total payout, commission, pending, paid)
- Commission breakdown
- Download PDF statements
- Payment tracking

## Installation

### 1. Database Setup

Run the SQL migration to create invoice tables:

```bash
# Connect to your PostgreSQL database
psql -U your_user -d your_database -f create-invoices-tables.sql
```

Or manually:

```sql
-- Run the SQL from create-invoices-tables.sql
```

### 2. Install Dependencies

```bash
cd marketplace-backend
npm install pdfkit @types/pdfkit
```

### 3. Update App Module

Add the InvoicesModule to your main app.module.ts:

```typescript
import { InvoicesModule } from './modules/invoices/invoices.module';

@Module({
  imports: [
    // ... other modules
    InvoicesModule,
  ],
})
export class AppModule {}
```

### 4. Configure Environment Variables

Add to your `.env` file:

```env
# Upload directory for PDFs (optional, defaults to ./uploads/invoices)
UPLOAD_DIR=./uploads/invoices

# Company information for invoices
APP_NAME=Your Marketplace
APP_ADDRESS=Your Company Address
APP_PHONE=+91 1234567890
APP_EMAIL=info@yourmarketplace.com

# Email configuration (should already exist)
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=your-email@gmail.com
MAIL_PASSWORD=your-app-password
MAIL_FROM=Your Marketplace <noreply@yourmarketplace.com>
```

### 5. Create Upload Directory

```bash
mkdir -p uploads/invoices
```

## API Endpoints

### Admin Endpoints

```
GET    /api/invoices                    # Get all invoices with filters
POST   /api/invoices                    # Create invoice from order
GET    /api/invoices/:id                # Get invoice details
PATCH  /api/invoices/:id                # Update invoice
DELETE /api/invoices/:id                # Delete invoice
GET    /api/invoices/:id/download       # Download PDF
POST   /api/invoices/:id/send           # Send via email
PATCH  /api/invoices/:id/mark-paid      # Mark as paid
POST   /api/invoices/auto-generate      # Auto-generate for all orders
```

### Vendor Endpoints

```
GET    /api/invoices/vendor/:vendorId   # Get vendor invoices
GET    /api/invoices/:id                # Get invoice details
GET    /api/invoices/:id/download       # Download PDF
```

### Customer Endpoints

```
GET    /api/invoices/customer/:customerId  # Get customer invoices
GET    /api/invoices/:id                   # Get invoice details
GET    /api/invoices/:id/download          # Download PDF
```

## Usage

### 1. Auto-Generate Invoices

Navigate to Admin Dashboard → Invoices and click "Auto-Generate Invoices". This will:
- Find all delivered and paid orders without invoices
- Generate customer invoices
- Generate vendor payout statements
- Send email notifications

### 2. Manual Invoice Creation

```typescript
POST /api/invoices
{
  "orderId": "order-uuid",
  "type": "customer", // or "vendor" or "platform"
  "notes": "Thank you for your business",
  "terms": "Payment due within 30 days"
}
```

### 3. Send Invoice via Email

```typescript
POST /api/invoices/:id/send
{
  "recipientEmail": "customer@example.com", // optional, uses billing email by default
  "subject": "Your Invoice", // optional
  "message": "Please find your invoice attached" // optional
}
```

### 4. Download Invoice PDF

```
GET /api/invoices/:id/download
```

### 5. Query Invoices

```
GET /api/invoices?type=vendor&status=paid&startDate=2024-01-01&page=1&limit=20
```

## Integration with Orders

To automatically generate invoices when orders are completed, add this to your orders service:

```typescript
// In orders.service.ts
import { InvoicesService } from '../invoices/invoices.service';

async updateOrderStatus(orderId: string, status: OrderStatus) {
  // ... update order status
  
  // Auto-generate invoices when order is delivered
  if (status === OrderStatus.DELIVERED) {
    try {
      // Generate customer invoice
      await this.invoicesService.createFromOrder({
        orderId,
        type: InvoiceType.CUSTOMER,
      });
      
      // Generate vendor payout statement
      await this.invoicesService.createFromOrder({
        orderId,
        type: InvoiceType.VENDOR,
      });
    } catch (error) {
      this.logger.error('Failed to generate invoices:', error);
    }
  }
}
```

## Dashboard Pages

### Admin Dashboard
Navigate to: `/admin/invoices`

Features:
- View all invoices
- Filter by type and status
- Send invoices
- Mark as paid
- Download PDFs
- Auto-generate bulk invoices

### Vendor Dashboard
Navigate to: `/dashboard/invoices`

Features:
- View payout statements
- See commission breakdowns
- Download statements
- Track payment status
- Summary statistics

## Customization

### PDF Template

Edit `invoice-pdf.service.ts` to customize:
- Company logo
- Colors and branding
- Layout and formatting
- Additional fields

### Email Template

Edit `simple-email.service.ts` → `sendInvoiceEmail()` to customize:
- Email design
- Message content
- Branding

### Invoice Numbering

Edit `invoices.service.ts` → `generateInvoiceNumber()` to customize:
- Number format
- Prefix/suffix
- Sequential numbering

## Best Practices

1. **Backup**: Always backup invoice data and PDFs
2. **Testing**: Test email delivery before going live
3. **Storage**: Consider using cloud storage (S3, GCS) for PDFs in production
4. **Security**: Ensure proper authentication and authorization
5. **Compliance**: Follow local tax and invoicing regulations
6. **Automation**: Set up cron jobs for auto-generation and overdue detection

## Scheduled Tasks (Optional)

Add to your cron jobs or task scheduler:

```typescript
// Auto-generate invoices daily
@Cron('0 0 * * *') // Every day at midnight
async autoGenerateInvoices() {
  await this.invoicesService.autoGenerateInvoices();
}

// Mark overdue invoices
@Cron('0 1 * * *') // Every day at 1 AM
async markOverdueInvoices() {
  const invoices = await this.invoiceRepository.find({
    where: {
      status: Not(In(['paid', 'cancelled'])),
      dueDate: LessThan(new Date()),
    },
  });
  
  for (const invoice of invoices) {
    invoice.status = InvoiceStatus.OVERDUE;
    await this.invoiceRepository.save(invoice);
  }
}
```

## Troubleshooting

### PDFs not generating
- Check PDFKit installation: `npm list pdfkit`
- Ensure upload directory exists and has write permissions
- Check logs for errors

### Emails not sending
- Verify SMTP credentials
- Check email service logs
- Test email configuration separately

### Invoice numbers not unique
- Check database constraints
- Ensure proper transaction handling
- Consider using database sequences

## Support

For issues or questions:
1. Check the logs in `marketplace-backend/logs`
2. Review the error messages in the browser console
3. Verify database tables and relations
4. Test API endpoints directly using Postman/Insomnia

## License

Proprietary - Part of Marketplace System
