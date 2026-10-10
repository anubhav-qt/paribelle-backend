# Invoice and Return Handling Strategy

## Invoice Generation Flow

### 1. Customer Invoice (Immediate on Payment)
- **Trigger**: When `paymentStatus` changes to `PAID`
- **Timing**: Immediately after payment confirmation
- **Location**: `orders.service.ts` -> `updatePaymentStatus()`
- **Purpose**: Customers need invoices for their records immediately after payment
- **Type**: `InvoiceType.CUSTOMER`

### 2. Vendor Payout Invoice (On Delivery)
- **Trigger**: When order status is `delivered` AND `paymentStatus` is `paid`
- **Timing**: After successful delivery
- **Location**: `invoices.service.ts` -> `autoGenerateInvoices()`
- **Purpose**: Vendor gets paid only after successful delivery
- **Type**: `InvoiceType.VENDOR`

### 3. Platform Commission Invoice (On Delivery)
- **Trigger**: Same as vendor payout
- **Timing**: After successful delivery
- **Type**: `InvoiceType.PLATFORM`

## Return Handling Strategy

### When Order is Returned

#### Option 1: Mark Invoice as Cancelled (Current Implementation)
```typescript
// Update invoice status to CANCELLED
invoice.status = InvoiceStatus.CANCELLED;
invoice.notes = `Order returned on ${returnDate}. Reason: ${returnReason}`;
await invoiceRepository.save(invoice);
```

**Pros:**
- Simple implementation
- Keeps original invoice for audit trail
- Clear status indication

**Cons:**
- Doesn't handle partial returns well
- No formal credit note

#### Option 2: Credit Note System (Recommended)

Create a new invoice type `CREDIT_NOTE`:

```typescript
export enum InvoiceType {
  CUSTOMER = 'customer',
  VENDOR = 'vendor',
  PLATFORM = 'platform',
  CREDIT_NOTE = 'credit_note', // NEW
}
```

When order is returned:
```typescript
// 1. Mark original invoice as cancelled
originalInvoice.status = InvoiceStatus.CANCELLED;

// 2. Create credit note
const creditNote = await invoicesService.createFromOrder({
  orderId: order.id,
  type: InvoiceType.CREDIT_NOTE,
  notes: `Credit note for returned order ${order.orderNumber}. Original invoice: ${originalInvoice.invoiceNumber}`,
});

// 3. Link credit note to original invoice
creditNote.relatedInvoiceId = originalInvoice.id;
creditNote.total = -originalInvoice.total; // Negative amount
```

### Implementation Steps for Returns

1. **Add return status tracking**
```typescript
// order.entity.ts
@Column({ type: 'timestamp', nullable: true, name: 'returned_at' })
returnedAt: Date;

@Column({ type: 'text', nullable: true, name: 'return_reason' })
returnReason: string;
```

2. **Create return handler in orders.service.ts**
```typescript
async handleOrderReturn(orderId: string, returnReason: string) {
  const order = await this.findOne(orderId);
  
  // Update order status
  order.status = OrderStatus.RETURNED;
  order.returnedAt = new Date();
  order.returnReason = returnReason;
  await this.orderRepository.save(order);
  
  // Handle invoices
  const customerInvoice = await this.invoicesService.findByOrder(orderId, 'customer');
  if (customerInvoice) {
    await this.invoicesService.cancelInvoice(customerInvoice.id, returnReason);
  }
  
  // Prevent vendor payout invoice generation
  // (it won't be created since order status is RETURNED, not DELIVERED)
  
  // Process refund
  await this.processRefund(order);
  
  return order;
}
```

3. **Add invoice cancellation method**
```typescript
// invoices.service.ts
async cancelInvoice(invoiceId: string, reason: string): Promise<Invoice> {
  const invoice = await this.findOne(invoiceId);
  
  invoice.status = InvoiceStatus.CANCELLED;
  invoice.notes = invoice.notes 
    ? `${invoice.notes}\n\nCANCELLED: ${reason}` 
    : `CANCELLED: ${reason}`;
  
  return await this.invoiceRepository.save(invoice);
}
```

### Return Window Policy

Current implementation in `orders/page.tsx`:
- Returns allowed within **7 days of delivery**
- Check: `deliveredAt` date vs current date
- Button disabled if past 7 days

### Return Process Flow

```
Customer requests return
  ↓
Validate return eligibility (within 7 days)
  ↓
Update order status to RETURNED
  ↓
Cancel customer invoice (mark as CANCELLED)
  ↓
Block vendor payout invoice generation
  ↓
Process refund
  ↓
Send notifications
```

## Best Practices

1. **Always Keep Original Invoice**: Never delete invoices, only mark as cancelled
2. **Audit Trail**: Log all status changes with timestamps and reasons
3. **Refund Tracking**: Link refund transactions to cancelled invoices
4. **Email Notifications**: Send updated invoice/credit note to customer
5. **Vendor Notification**: Alert vendor if payout was already processed

## Database Considerations

Add these columns if implementing full return handling:
```sql
-- invoices table
ALTER TABLE invoices ADD COLUMN related_invoice_id UUID REFERENCES invoices(id);
ALTER TABLE invoices ADD COLUMN cancelled_at TIMESTAMP;
ALTER TABLE invoices ADD COLUMN cancellation_reason TEXT;

-- orders table (already have some)
ALTER TABLE orders ADD COLUMN returned_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN return_reason TEXT;
ALTER TABLE orders ADD COLUMN return_approved_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN refund_amount DECIMAL(10,2);
ALTER TABLE orders ADD COLUMN refund_status VARCHAR(50);
```

## Current Status

✅ Customer invoices generate on payment
✅ Vendor invoices generate on delivery
✅ Return button disables after 7 days
⏳ Invoice cancellation on return (needs implementation)
⏳ Credit note system (optional enhancement)
⏳ Refund processing (needs implementation)
