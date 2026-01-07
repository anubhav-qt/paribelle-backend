# Individual Item Returns Feature

## Overview
This feature enables customers to return individual items from their orders, with support for partial quantity returns. The system tracks return requests, approvals, refunds, and automatically adjusts invoices.

## Database Schema

### Tables Created

#### 1. `returns` Table
Tracks individual order item return requests.

**Key Fields:**
- `return_number`: Unique identifier (Format: RET-YYYYMMDD-XXXX)
- `order_id`, `order_item_id`: Links to order and specific item
- `quantity`: Number of items being returned (can be partial)
- `original_quantity`: Original quantity purchased
- `status`: requested → approved → received → refunded
- `refund_amount`, `refund_tax`, `refund_total`: Calculated refund amounts
- `reason`: Customer's return reason
- `images`: JSONB array for product condition photos
- `tracking_number`, `carrier`: Return shipping details

**Return Statuses:**
- `requested`: Customer initiated return
- `approved`: Vendor/admin approved
- `rejected`: Return denied
- `received`: Vendor confirmed receipt
- `refunded`: Money returned to customer
- `cancelled`: Customer cancelled request

#### 2. `return_refunds` Table
Tracks refund transactions for approved returns.

**Key Fields:**
- `return_id`: Links to returns table
- `amount`: Refund amount
- `method`: Refund method (original payment method, store credit, etc.)
- `transaction_id`: Payment gateway transaction ID
- `gateway_response`: JSONB for gateway data
- `status`: pending → processing → completed/failed

#### 3. `order_items` Updates
Added columns to track return status:
- `returned_quantity`: Total items returned
- `return_status`: none / partial / full

## API Endpoints

### Customer Endpoints

#### Check Return Eligibility
```
POST /api/returns/check-eligibility
Body: { orderId, orderItemId }
```
Validates if item can be returned based on:
- Vendor return policy
- Return window (days since delivery)
- Available quantity
- Order status

#### Create Return Request
```
POST /api/returns
Body: {
  orderId,
  orderItemId,
  quantity,
  reason,
  customerNotes,
  images: ["url1", "url2"]
}
```

#### Get My Returns
```
GET /api/returns/my-returns?status=requested&orderId=xxx
```

#### Get Return Details
```
GET /api/returns/:returnId
```

### Vendor/Admin Endpoints

#### Get Vendor Returns
```
GET /api/returns/vendor/:vendorId?status=requested
```

#### Get Return Statistics
```
GET /api/returns/vendor/:vendorId/stats
```
Returns:
- Total returns
- Pending/approved/refunded counts
- Total refund amount

#### Approve Return
```
PUT /api/returns/:returnId/approve
Body: { vendorNotes }
```

#### Reject Return
```
PUT /api/returns/:returnId/reject
Body: { rejectionReason }
```

#### Mark as Received
```
PUT /api/returns/:returnId/received
Body: { trackingNumber, carrier }
```

### Admin Endpoints

#### Process Refund
```
POST /api/returns/:returnId/refund
Body: {
  method,
  transactionId,
  gateway,
  gatewayResponse,
  notes
}
```

## Business Logic (ReturnsService)

### Key Methods

#### `checkReturnEligibility(orderId, orderItemId, userId)`
- Validates vendor return policy
- Checks return window
- Verifies available quantity
- Returns eligibility status with details

#### `createReturnRequest(data)`
- Validates eligibility
- Calculates refund amounts proportionally
- Generates unique return number
- Updates order item status
- Transaction-safe

#### `approveReturn(returnId, approvedBy, vendorNotes)`
- Changes status to approved
- Records approval timestamp and user

#### `processRefund(returnId, refundData)`
- Creates refund transaction record
- Updates return status to refunded
- Increments returned_quantity in order_items
- Transaction-safe

## Invoice Handling (InvoiceService)

### Invoice Generation with Returns

The `generateInvoiceWithReturns(orderId)` method:
1. Retrieves order and items
2. Calculates returned quantities per item
3. Computes adjusted totals
4. Shows original and adjusted amounts

### Invoice Display Format

**Invoice Items:**
```
Product Name (2 returned)
Quantity: 3 (effective)
Price: $XX.XX each
Subtotal: $XXX.XX

Original Total: $XXX.XX
Less: Returns: -$XX.XX
Final Amount: $XXX.XX
```

### Credit Notes

`generateCreditNote(returnId)` creates a credit note for refunded returns showing:
- Return details
- Refund amount breakdown
- Original order reference
- Refund transaction info

## Return Flow

### Customer Journey
1. **Check Eligibility** → System validates return policy
2. **Submit Request** → Upload photos, select reason
3. **Wait for Approval** → Vendor reviews
4. **Ship Item Back** → If approved
5. **Receive Refund** → After vendor confirms receipt

### Vendor Journey
1. **Receive Notification** → New return request
2. **Review Request** → Check reason and photos
3. **Approve/Reject** → Make decision with notes
4. **Confirm Receipt** → Mark received when item arrives
5. **Admin processes refund** → Money returned to customer

## Integration Points

### Frontend Components (Use Shared Components)
Create reusable components:
- `ReturnRequestCard`: Display return summary
- `ReturnStatusBadge`: Status indicator
- `ReturnForm`: Request submission form
- `ReturnTimeline`: Status progression
- `ProductReturnOption`: Per-item return button

**Styling Guidelines:**
- Use theme colors from shared theme file
- Apply consistent spacing/padding
- Use CSS classes, NOT inline styles
- Responsive design for all components

### Email Notifications
Send emails for:
- Return requested (to vendor)
- Return approved/rejected (to customer)
- Return received (to customer)
- Refund processed (to customer)

### Payment Gateway Integration
Implement refund processing:
- Use original payment method
- Handle partial refunds
- Store transaction IDs
- Error handling and retry logic

## Usage Examples

### Example 1: Customer Returns 2 of 5 Items

```javascript
// Check eligibility
POST /api/returns/check-eligibility
{
  "orderId": "uuid",
  "orderItemId": "uuid"
}

Response: {
  "eligible": true,
  "item": {
    "quantity": 5,
    "available_quantity": 5,
    "return_policy_days": 7
  }
}

// Create return
POST /api/returns
{
  "orderId": "uuid",
  "orderItemId": "uuid",
  "quantity": 2,
  "reason": "Wrong size",
  "customerNotes": "Ordered XL but need L"
}

Response: {
  "return_number": "RET-20260107-0001",
  "status": "requested",
  "refund_total": 39.98
}
```

### Example 2: Vendor Approves Return

```javascript
PUT /api/returns/RET-20260107-0001/approve
{
  "vendorNotes": "Approved. Please return within 7 days."
}

Response: {
  "status": "approved",
  "approved_at": "2026-01-07T10:30:00Z"
}
```

## Migration Instructions

### Step 1: Run Database Migration

**Option A: Fresh Installation (using init-database.js)**
```bash
# For new installations, the returns tables are included in the main schema
node initialsetup/init-database.js --create-database
```

**Option B: Add to Existing Database**
```bash
# For existing databases, run the migration script
node add-item-returns-support.js
```

This creates:
- returns table
- return_refunds table
- Indexes for optimal query performance
- Triggers for automatic timestamp updates
- Helper functions (return number generation)
- Return tracking columns in order_items table

### Step 2: Verify Schema and Indexes

**Verify Returns Schema:**
```bash
node verify-returns-schema.js
```

This checks:
- ✅ Tables exist with correct columns
- ✅ All indexes are properly created
- ✅ Functions and triggers are working
- ✅ Foreign key relationships are established
- ✅ Test return number generation

**Verify All Indexes (Comprehensive):**
```bash
node verify-all-indexes.js
```

This provides:
- Complete list of all indexes by table
- Missing index detection
- Index usage statistics
- Foreign key index verification
- Performance recommendations

### Step 3: Update Application
1. Add returns routes to your Express app:
```javascript
const returnsRoutes = require('./routes/returns');
app.use('/api/returns', returnsRoutes);
```

2. Integrate InvoiceService for adjusted invoices

3. Add return buttons to order history UI

### Step 3: Configure Return Policies
Vendors can set in their dashboard:
- `return_policy_days`: Number of days for returns
- `allow_returns`: Enable/disable returns

## Security Considerations

1. **Authorization**: 
   - Customers can only return their own orders
   - Vendors can only manage their own returns
   - Admins have full access

2. **Validation**:
   - Verify return eligibility before creation
   - Prevent duplicate returns for same items
   - Validate quantities

3. **Transaction Safety**:
   - All financial operations use database transactions
   - Rollback on any failure

## Performance Optimization

- Indexed fields: order_id, order_item_id, user_id, vendor_id, status
- Use of COALESCE for efficient aggregations
- Pagination recommended for list views

## Future Enhancements

1. **Return Labels**: Auto-generate shipping labels
2. **Store Credit**: Option for store credit vs refund
3. **Restocking Fee**: Configurable per vendor
4. **Quality Check**: Multi-step inspection process
5. **Analytics Dashboard**: Return rate metrics
6. **Automated Approval**: Rules-based auto-approval

## Testing

### Test Scenarios
1. Return within policy window
2. Return after policy expires (should fail)
3. Partial quantity return
4. Full quantity return
5. Multiple returns from same order
6. Return with images
7. Vendor approval workflow
8. Refund processing
9. Invoice adjustment

### Sample Test Data Script
```bash
node create-test-returns.js
```

## Support

For issues or questions:
1. Check return eligibility validation messages
2. Verify vendor return policy settings
3. Check order status (must be delivered)
4. Review database constraints and triggers
