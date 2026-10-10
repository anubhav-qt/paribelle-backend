# Custom Page Templates

This directory contains scripts to seed the marketplace database with essential custom page templates.

## Pages Included

Four professional page templates are provided:

1. **Privacy Policy** (`/privacy-policy`)
   - Comprehensive privacy policy covering data collection, usage, and user rights
   - Includes GDPR-compliant sections

2. **Terms of Service** (`/terms-of-service`)
   - Complete terms and conditions for marketplace usage
   - Covers vendor and customer terms, payments, and dispute resolution

3. **Cookie Policy** (`/cookie-policy`)
   - Detailed explanation of cookie usage
   - Includes cookie types, control options, and third-party services

4. **Become a Vendor** (`/become-a-vendor`)
   - Vendor onboarding information and application guide
   - Features benefits, requirements, pricing, and FAQs

## Usage

### Option 1: Node.js Script (Recommended)

```powershell
cd marketplace-backend
node seed-custom-pages.js
```

This script:
- Reads database configuration from `.env` file
- Creates or updates all four page templates
- Uses markdown format for easy editing
- Sets all pages to `published` status with navigation visibility

### Option 2: PowerShell Script

```powershell
cd marketplace-backend
.\seed-custom-pages.ps1
```

This is a wrapper that runs the Node.js script with enhanced output formatting.

## Requirements

- Node.js installed
- PostgreSQL database running
- `.env` file configured with database credentials:
  ```
  DB_HOST=localhost
  DB_PORT=5432
  DB_DATABASE=marketplace
  DB_USERNAME=postgres
  DB_PASSWORD=your_password
  ```

## Database Schema

The scripts use the `marketplace_pages` table with the following structure:

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `title` | varchar | Page title |
| `slug` | varchar | URL-friendly identifier (unique) |
| `content` | text | Page content (Markdown) |
| `status` | enum | `draft`, `published`, or `archived` |
| `showInNavigation` | boolean | Display in navigation menu |
| `createdAt` | timestamp | Creation timestamp |
| `updatedAt` | timestamp | Last update timestamp |
| `publishedAt` | timestamp | Publication timestamp |

## Customization

To customize the page content:

1. Edit the templates in `seed-custom-pages.js`
2. Update the `content` field for each page object
3. Run the script again to update the database

The script uses `ON CONFLICT (slug) DO UPDATE` to safely update existing pages without creating duplicates.

## Accessing Pages

After seeding, pages are accessible at:

- `http://localhost:3000/privacy-policy`
- `http://localhost:3000/terms-of-service`
- `http://localhost:3000/cookie-policy`
- `http://localhost:3000/become-a-vendor`

Or via API:

- `GET http://localhost:3001/api/v1/marketplace/pages`
- `GET http://localhost:3001/api/v1/marketplace/pages/slug/:slug`

## Notes

- All pages are set to `published` status by default
- Pages are configured to show in navigation (`showInNavigation: true`)
- Content is in Markdown format for easy editing in the admin panel
- Running the script multiple times is safe - it updates existing pages
- Customize contact information and placeholders (email, phone, address) before production use

## Production Deployment

Before deploying to production:

1. ✅ Review and customize all page content
2. ✅ Update placeholder contact information
3. ✅ Adjust legal terms to match your jurisdiction
4. ✅ Have legal counsel review Privacy Policy and Terms of Service
5. ✅ Update company-specific details (name, address, etc.)
6. ✅ Verify links and email addresses are correct
7. ✅ Test all pages on your live domain

## License

These templates are provided as starting points and should be customized to fit your specific business needs and legal requirements.
