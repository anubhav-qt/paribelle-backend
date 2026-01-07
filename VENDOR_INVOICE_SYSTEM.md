# Vendor Invoice System Documentation

## Overview

The Vendor Invoice System manages financial transactions between the marketplace and vendors, including payouts for delivered orders, deductions for returns/cancellations, and commission tracking. The system is designed to avoid data redundancy by reusing existing order items and invoice infrastructure.

## Customer Invoice vs Vendor Invoice

### Key Difference: Same Order, Different Invoices

**Important:** Customer and Vendor invoices are **separate invoices** for different purposes, but they share the same underlying order data to avoid redundancy.

#### Customer Invoice (InvoiceType.CUSTOMER)
```typescript
Purpose: Receipt for customer's purchase
Recipient: Customer who bought the products
Amount: ₹1,000 (full order total)
Items: Loaded from order.items
Shows: What customer paid for
Created: When payment is completed
```

#### Vendor Invoice (InvoiceType.VENDOR)
```typescript
Purpose: Payout statement for vendor
Recipient: Vendor who sold the products
Amount: ₹900 (order total minus commission)
Commission: ₹100 (deducted from vendor's payout)
Items: Same order.items (no duplication!)
Shows: What vendor will receive
Created: When order is delivered
```

### Example: One Order, Two Invoices

```typescript
Order #ORD-123: Customer purchases ₹1,000 worth of products from Vendor A
    ↓
Customer Invoice: INV-001 (CUSTOMER)
  - Recipient: john@customer.com
  - Amount: ₹1,000
  - Note: "Thank you for your purchase"
  - Items: [Product A: ₹500, Product B: ₹500]
    ↓
Vendor Invoice: INV-002 (VENDOR)  
  - Recipient: vendorA@store.com
  - Amount: ₹900
  - Commission: -₹100 (10%)
  - Payout: ₹900
  - Note: "Vendor payout for delivered order"
  - Items: Same [Product A: ₹500, Product B: ₹500] (from order.items!)
```

### Comparison Table

| Aspect | Customer Invoice | Vendor Invoice |
|--------|-----------------|----------------|
| **Recipient** | Customer | Vendor |
| **Amount** | Full price (₹1,000) | Price minus commission (₹900) |
| **Purpose** | Proof of purchase | Payout statement |
| **Created When** | On payment | On delivery |
| **Commission** | Not shown/applied | Deducted and displayed |
| **Tax** | Charged to customer | May differ based on vendor GST status |
| **Billing Info** | Customer's shipping address | Vendor's business address |
| **Items Source** | order.items | Same order.items (no duplication) |
| **PDF Content** | Customer-focused terms | Vendor-focused payout details |

### What's Shared (No Redundancy)
- ✅ Same order reference
- ✅ Same items (loaded from order.items table)
- ✅ Same product details
- ✅ Same order date and order number
- ✅ Same item quantities and base prices

### What's Different
- ❌ Different invoice numbers (INV-001 vs INV-002)
- ❌ Different invoice types (CUSTOMER vs VENDOR)
- ❌ Different total amounts (full price vs price-commission)
- ❌ Different recipients (customer vs vendor)
- ❌ Different notes and terms
- ❌ Different billing information
- ❌ Commission is only shown on vendor invoice

### Why Two Invoices?

1. **Legal Requirement**: Customers need purchase receipts, vendors need payout statements
2. **Different Information**: Customer doesn't need to see vendor's commission breakdown
3. **Separate PDFs**: Different layouts and content for different audiences
4. **Accounting**: Separate records for customer payments and vendor payouts
5. **Tax Compliance**: Different tax treatments for B2C (customer) vs B2B (vendor)

## Architecture

### Core Principles

1. **Zero Redundancy**: Invoice items are loaded directly from `order_items` table via relations
2. **Code Reuse**: All vendor invoices use existing `createFromOrder()` and invoice creation methods
3. **Aggregate Tracking**: `vendor_balances` table stores calculated totals for performance
4. **Single Source of Truth**: Order items remain the authoritative source for line items

### Database Schema

#### Invoices Table (Existing)
```sql
-- Used for both customer and vendor invoices
CREATE TABLE invoices (
  type VARCHAR(50),  -- 'CUSTOMER' | 'VENDOR' | 'PLATFORM'
  total DECIMAL(10, 2),  -- Positive = payout, Negative = deduction
  commission_amount DECIMAL(10, 2),
  payout_amount DECIMAL(10, 2),
  -- Invoice items loaded from order.items relation
);
```

#### Vendor Balances Table (New)
```sql
CREATE TABLE vendor_balances (
  vendor_id UUID UNIQUE,
  total_sales DECIMAL(10, 2),        -- Sum of positive invoices
  total_deductions DECIMAL(10, 2),   -- Sum of negative invoices
  total_commission DECIMAL(10, 2),   -- Total commission charged
  pending_payout DECIMAL(10, 2),     -- Unpaid amount
  paid_out DECIMAL(10, 2),           -- Already paid
  available_balance DECIMAL(10, 2),  -- Current balance
  invoice_count INTEGER
);
```

## Invoice Types

### 1. Vendor Payout Invoice (Positive)
Created when order is delivered and paid.

```typescript
// Automatic creation on order delivery
Order Status: DELIVERED + Payment: PAID
→ Creates InvoiceType.VENDOR with positive amounts

Example:
Order Total: ₹1,000
Commission (10%): ₹100
Vendor Gets: ₹900
```

### 2. Vendor Deduction Invoice (Negative)
Created for returns or cancellations.

```typescript
// Manual or automatic creation
Order Status: RETURNED | CANCELLED
→ Creates InvoiceType.VENDOR with negative amounts

Example (Return):
Order Total: -₹1,000
Commission Reversal: +₹100 (credited back)
Vendor Loses: -₹900
```

## API Methods

### Invoice Creation

#### 1. Create Payout Invoice (Reuses Existing Code)
```typescript
// Uses existing createFromOrder method
await invoicesService.createFromOrder({
  orderId: 'order-uuid',
  type: InvoiceType.VENDOR,
  notes: 'Vendor payout for delivered order'
});

// Automatically:
// - Loads items from order.items
// - Calculates commission
// - Updates vendor balance
```

#### 2. Create Deduction Invoice
```typescript
await invoicesService.createVendorDeductionInvoice(
  orderId: string,
  reason: string  // e.g., "Customer returned item"
);

// How it works:
// 1. Calls createVendorInvoice() with order data
// 2. Makes amounts negative
// 3. Reverses commission (positive)
// 4. Updates vendor balance
// 5. Items still from order.items (no duplication!)
```

### Balance Management

#### 1. Get Vendor Balance
```typescript
const balance = await invoicesService.getVendorBalance(vendorId);

// Returns:
{
  vendorId: string,
  totalSales: number,        // All positive invoices
  totalDeductions: number,   // All negative invoices
  totalCommission: number,   // Total commission
  pendingPayout: number,     // Not yet paid
  paidOut: number,           // Already paid
  availableBalance: number,  // Current balance
  invoiceCount: number
}
```

#### 2. Update Balance
```typescript
// Recalculates from all invoices
await invoicesService.updateVendorBalance(vendorId);

// Automatically called after:
// - Creating payout invoice
// - Creating deduction invoice
```

#### 3. Reconcile Balance
```typescript
// Force recalculation (for corrections)
await invoicesService.reconcileVendorBalance(vendorId);
```

### Reporting

#### 1. Get Vendor Statement
```typescript
const statement = await invoicesService.getVendorStatement(
  vendorId: string,
  startDate?: Date,  // Optional period filter
  endDate?: Date
);

// Returns:
{
  vendorId: string,
  period: { startDate, endDate },
  balance: VendorBalance,
  summary: {
    totalPayouts: number,
    totalDeductions: number,
    totalCommission: number,
    netAmount: number,
    invoiceCount: number,
    payoutCount: number,
    deductionCount: number
  },
  invoices: [
    {
      id: string,
      invoiceNumber: string,
      orderId: string,
      orderNumber: string,
      type: 'payout' | 'deduction',
      amount: number,
      commission: number,
      status: string,
      date: Date,
      notes: string
    }
  ]
}
```

### Bulk Operations

#### Generate Missing Invoices
```typescript
// Admin tool to catch up on uninvoiced orders
const result = await invoicesService.generateMissingVendorInvoices();

// Returns:
{
  created: number,  // Invoices created
  skipped: number   // Already had invoices
}

// Finds all:
// - Delivered orders
// - Payment status = PAID
// - No existing vendor payout invoice
// - Creates invoice using createFromOrder()
```

## Workflow Examples

### Example 1: Normal Order Flow
```typescript
// 1. Customer places order
Order created: ORD-123, Status: PENDING

// 2. Order is delivered
Status → DELIVERED
Payment → PAID

// 3. System auto-generates customer invoice
Invoice INV-001 (CUSTOMER) created
Amount: ₹1,000

// 4. System auto-generates vendor invoice
Invoice INV-002 (VENDOR) created
Amount: ₹900 (after ₹100 commission)

// 5. Vendor balance updated
totalSales: +₹900
totalCommission: +₹100
availableBalance: ₹900
```

### Example 2: Return Flow
```typescript
// 1. Customer returns order
Order Status → RETURNED
Payment → REFUNDED

// 2. Admin creates deduction invoice
await createVendorDeductionInvoice(orderId, "Customer returned item");

// 3. Deduction invoice created
Invoice INV-003 (VENDOR) created
Amount: -₹900
Commission: +₹100 (reversed)

// 4. Vendor balance updated
totalDeductions: +₹900
totalCommission: -₹100 (reduced)
availableBalance: ₹0
```

### Example 3: Partial Return
```typescript
// Scenario: Order has 3 items, customer returns 1 item

// Option 1: Manual calculation
// Calculate return amount based on returned items
// Create deduction invoice with specific amount

// Option 2: Create new order-return record
// Track which specific items were returned
// Generate deduction based on returned items only
```

## Integration Points

### Order Service Integration
```typescript
// In orders.service.ts
async updateOrderStatus(orderId: string, status: OrderStatus) {
  const order = await this.findOne(orderId);
  order.status = status;
  await this.save(order);

  // Auto-generate vendor invoice on delivery
  if (status === OrderStatus.DELIVERED && order.paymentStatus === 'paid') {
    await this.invoicesService.createFromOrder({
      orderId: order.id,
      type: InvoiceType.VENDOR,
      notes: 'Vendor payout for delivered order'
    });
  }
}

// On return/cancellation
async processReturn(orderId: string, reason: string) {
  // Update order status
  await this.updateOrderStatus(orderId, OrderStatus.RETURNED);
  
  // Create deduction invoice
  await this.invoicesService.createVendorDeductionInvoice(
    orderId,
    `Return: ${reason}`
  );
}
```

### Admin Dashboard Endpoints
```typescript
// GET /api/v1/admin/vendors/:vendorId/balance
// Returns current vendor balance

// GET /api/v1/admin/vendors/:vendorId/statement?startDate=...&endDate=...
// Returns vendor statement for period

// POST /api/v1/admin/invoices/generate-missing
// Generates all missing vendor invoices

// POST /api/v1/admin/invoices/vendor-deduction
// Body: { orderId, reason }
// Creates deduction invoice

// POST /api/v1/admin/vendors/:vendorId/reconcile
// Recalculates vendor balance
```

### Vendor Dashboard Endpoints
```typescript
// GET /api/v1/vendor/balance
// Returns current user's vendor balance

// GET /api/v1/vendor/invoices?startDate=...&endDate=...
// Returns vendor's own invoices

// GET /api/v1/vendor/statement?month=...
// Returns monthly statement
```

## Data Flow Diagram

```
Order (DELIVERED + PAID)
    ↓
createFromOrder(InvoiceType.VENDOR)
    ↓
createVendorInvoice()
    ├── Create invoice record
    ├── Items loaded from order.items (NO DUPLICATION)
    └── Calculate commission
    ↓
updateVendorBalance()
    ├── Query all vendor invoices
    ├── Calculate totals
    └── Update vendor_balances table
    ↓
Vendor Balance Updated
```

```
Order (RETURNED)
    ↓
createVendorDeductionInvoice(reason)
    ↓
createVendorInvoice() [reused!]
    ├── Create invoice record
    ├── Items from order.items
    └── Make amounts negative
    ↓
updateVendorBalance()
    └── Recalculate totals
    ↓
Vendor Balance Reduced
```

## Key Design Decisions

### 1. No Invoice Items Table
**Decision**: Load items directly from `order.items` via relations

**Rationale**:
- Order items are immutable after order placement
- No need to duplicate data
- Single source of truth
- Reduces database complexity

**Implementation**:
```typescript
// In invoice-pdf.service.ts
const invoice = await invoiceRepository.findOne({
  where: { id: invoiceId },
  relations: ['order', 'order.items', 'order.items.product']
});

const items = invoice.order?.items || [];
// Use items directly for PDF generation
```

### 2. Reuse Existing Invoice Creation
**Decision**: Use existing `createFromOrder()` and `createVendorInvoice()` methods

**Rationale**:
- Avoid code duplication
- Consistent invoice generation logic
- Easier maintenance
- Same PDF generation for all invoices

**Implementation**:
```typescript
// Deduction invoice reuses vendor invoice creation
async createVendorDeductionInvoice(orderId, reason) {
  const order = await this.loadOrder(orderId);
  
  // Reuse existing method
  const invoice = await this.createVendorInvoice(order, ...);
  
  // Just make amounts negative
  invoice.total = -Math.abs(invoice.total);
  invoice.payoutAmount = -Math.abs(invoice.payoutAmount);
  
  return invoice;
}
```

### 3. Aggregate Balance Table
**Decision**: Store calculated totals in `vendor_balances` table

**Rationale**:
- Performance: Avoid calculating totals on every request
- Quick dashboard queries
- Historical tracking
- Can be recalculated/reconciled if needed

**Trade-off**: Slight data duplication (calculated data only)

## Performance Considerations

### Indexes
```sql
-- Fast vendor invoice lookups
CREATE INDEX idx_invoices_vendorId_type ON invoices(vendor_id, type);
CREATE INDEX idx_invoices_orderId ON invoices(order_id);

-- Fast balance queries
CREATE UNIQUE INDEX idx_vendor_balances_vendorId ON vendor_balances(vendor_id);
```

### Caching Strategy
```typescript
// Cache vendor balance for 5 minutes
@Cacheable('vendor-balance', ttl: 300)
async getVendorBalance(vendorId: string) {
  // Query runs only if cache expired
}

// Invalidate cache on balance update
@CacheEvict('vendor-balance')
async updateVendorBalance(vendorId: string) {
  // Recalculate and save
}
```

## Testing Scenarios

### Unit Tests
```typescript
describe('VendorInvoiceService', () => {
  it('should create positive payout invoice for delivered order');
  it('should create negative deduction invoice for return');
  it('should update vendor balance after invoice creation');
  it('should prevent duplicate deduction invoices');
  it('should reconcile balance correctly');
  it('should generate statement with correct totals');
});
```

### Integration Tests
```typescript
describe('Vendor Invoice Flow', () => {
  it('should create vendor invoice when order is delivered');
  it('should create deduction invoice when order is returned');
  it('should show correct balance in vendor dashboard');
  it('should generate PDF with items from order');
});
```

### Manual Testing Checklist
- [ ] Create order and mark as delivered → Check vendor invoice created
- [ ] Verify invoice PDF contains correct items from order
- [ ] Return order → Check deduction invoice created with negative amount
- [ ] Verify vendor balance updated correctly
- [ ] Generate vendor statement → Check all invoices listed
- [ ] Run reconciliation → Verify balance recalculated correctly
- [ ] Generate missing invoices → Check catch-up works

## Troubleshooting

### Issue: Invoice has no items
**Solution**: Invoice items are loaded from order.items via relations. Check that:
1. Order has items in order_items table
2. Invoice query includes relations: `['order', 'order.items', 'order.items.product']`

### Issue: Balance not updating
**Solution**: 
```typescript
// Force recalculation
await invoicesService.reconcileVendorBalance(vendorId);

// Check if updateVendorBalance() is being called after invoice creation
```

### Issue: Duplicate deduction invoices
**Solution**: Method checks for existing deduction invoices before creating
```typescript
const existingDeduction = await this.invoiceRepository.findOne({
  where: { orderId, type: InvoiceType.VENDOR, notes: reason }
});
```

### Issue: Wrong commission calculation
**Solution**: Commission is stored on the order at creation time. Deduction invoices reverse it correctly:
```typescript
invoice.commissionAmount = Math.abs(invoice.commissionAmount || 0); // Positive on deduction
```

## Migration Guide

### From Old System (with invoice_items table)

1. **Data Migration** (if needed):
```sql
-- Old invoice_items data is not needed
-- All items now come from order_items
DROP TABLE invoice_items;
```

2. **Code Changes**:
- Remove `InvoiceItem` entity imports
- Remove `invoiceItemRepository` injections
- Update invoice queries to include `order.items` relation

3. **Vendor Balance Initialization**:
```typescript
// Run once to initialize balances for existing vendors
const vendors = await vendorsRepository.find();
for (const vendor of vendors) {
  await invoicesService.updateVendorBalance(vendor.id);
}
```

## Future Enhancements

### 1. Automated Payouts
```typescript
// Schedule weekly/monthly payouts
async processVendorPayouts() {
  const vendors = await this.getVendorsWithPositiveBalance();
  
  for (const vendor of vendors) {
    const balance = await this.getVendorBalance(vendor.id);
    
    if (balance.availableBalance > MINIMUM_PAYOUT) {
      // Integrate with payment gateway
      await this.processPayment(vendor, balance.availableBalance);
      
      // Update paid_out amount
      balance.paidOut += balance.availableBalance;
      balance.availableBalance = 0;
      await this.save(balance);
    }
  }
}
```

### 2. Partial Returns
```typescript
// Track individual returned items
async createPartialReturnInvoice(orderId: string, returnedItemIds: string[]) {
  const order = await this.loadOrder(orderId);
  const returnedItems = order.items.filter(item => returnedItemIds.includes(item.id));
  
  // Calculate partial amount
  const returnAmount = returnedItems.reduce((sum, item) => 
    sum + (item.price * item.quantity), 0
  );
  
  // Create deduction invoice with specific amount
  // ...
}
```

### 3. Multi-Currency Support
```typescript
// Store amounts in vendor's preferred currency
interface VendorBalance {
  currency: string;  // 'INR' | 'USD' | 'EUR'
  totalSales: number;
  // ... conversion rates
}
```

### 4. Commission Tiers
```typescript
// Different commission rates based on sales volume
async calculateCommission(vendor: Vendor, orderTotal: number) {
  const balance = await this.getVendorBalance(vendor.id);
  
  if (balance.totalSales > 100000) {
    return orderTotal * 0.05;  // 5% for high volume
  } else {
    return orderTotal * 0.10;  // 10% standard
  }
}
```

## Summary

The Vendor Invoice System provides:
- ✅ Automated invoice generation for payouts and deductions
- ✅ Zero data redundancy (reuses order items)
- ✅ Real-time balance tracking
- ✅ Comprehensive vendor statements
- ✅ Easy reconciliation and admin tools
- ✅ Scalable architecture using existing infrastructure

**Key Files**:
- `src/modules/invoices/vendor-balance.entity.ts` - Balance entity
- `src/modules/invoices/invoices.service.ts` - Core logic
- `src/modules/invoices/invoice-pdf.service.ts` - PDF generation
- `initialsetup/init-database.sql` - Database schema
