# Footer Page Templates Setup

This guide explains how to add professional page templates to your footer using predefined templates.

## Overview

The footer templates system provides ready-to-use page link sections that can be added to your marketplace footer. This makes it easy to include common pages like Privacy Policy, Terms of Service, and more in your footer navigation.

## Available Templates

### 1. Legal Section
Essential legal pages for compliance:
- Privacy Policy (`/privacy-policy`)
- Terms of Service (`/terms-of-service`)
- Cookie Policy (`/cookie-policy`)

### 2. Company Section
Company information and vendor onboarding:
- About Us (`/about-us`)
- Become a Vendor (`/become-a-vendor`)
- Contact Us (`/contact`)

### 3. Support Section
Customer support resources:
- Help Center (`/help`)
- FAQ (`/faq`)
- Shipping Info (`/shipping`)
- Returns (`/returns`)

### 4. Shop Section
Product browsing shortcuts:
- All Products (`/products`)
- New Arrivals (`/products?sort=newest`)
- Best Sellers (`/products?sort=popular`)
- Sale (`/products?on_sale=true`)

## Usage

### Check Current Footer Settings

```powershell
node add-footer-templates.js
```

This shows what's currently in your footer settings without making changes.

### Merge Templates (Recommended)

Adds new template sections while keeping existing custom sections:

```powershell
node add-footer-templates.js --merge
```

Or use PowerShell:

```powershell
.\add-footer-templates.ps1 -Merge
```

### Replace All Sections

Replaces all existing custom sections with the templates:

```powershell
node add-footer-templates.js --replace
```

Or use PowerShell:

```powershell
.\add-footer-templates.ps1 -Replace
```

## Complete Setup Workflow

### Step 1: Seed the Pages

First, create the actual pages with content:

```powershell
node seed-custom-pages.js
```

This creates:
- Privacy Policy (full legal content)
- Terms of Service (complete terms)
- Cookie Policy (detailed cookie information)
- Become a Vendor (vendor onboarding page)

### Step 2: Add Footer Links

Then, add these pages to your footer:

```powershell
node add-footer-templates.js --merge
```

This adds footer sections linking to the pages above, plus additional common links.

### Step 3: Customize

Visit the admin panel to customize:

```
http://localhost:3000/admin/settings/footer
```

You can:
- Reorder sections
- Edit link labels and URLs
- Enable/disable sections
- Add new custom sections
- Modify existing links

## Database Structure

Footer settings are stored in the `footer_settings` table with this structure:

```typescript
{
  customSections: [
    {
      title: "Legal",
      enabled: true,
      links: [
        { label: "Privacy Policy", url: "/privacy-policy" },
        { label: "Terms of Service", url: "/terms-of-service" },
        { label: "Cookie Policy", url: "/cookie-policy" }
      ]
    },
    // ... more sections
  ]
}
```

## Customization

### Adding Your Own Templates

Edit `add-footer-templates.js` and add to `footerPageTemplates`:

```javascript
const footerPageTemplates = {
  mySection: {
    title: 'My Section',
    links: [
      { label: 'My Page', url: '/my-page' },
      { label: 'Another Page', url: '/another-page' }
    ],
    enabled: true
  },
  // ... existing templates
};
```

### Modifying Existing Templates

Edit the templates in `add-footer-templates.js`:

```javascript
legal: {
  title: 'Legal & Policies',  // Changed title
  links: [
    { label: 'Privacy', url: '/privacy-policy' },  // Shorter label
    { label: 'Terms', url: '/terms-of-service' },
    { label: 'Cookies', url: '/cookie-policy' },
    { label: 'Refund Policy', url: '/refunds' }  // Added new link
  ],
  enabled: true
}
```

## Frontend Integration

The footer component automatically renders these sections. To customize the footer display, edit:

```
marketplace-web/src/components/Footer.tsx
```

The component fetches footer settings from:

```
GET /api/v1/footer-settings
```

## Quick Start Commands

```powershell
# Complete setup from scratch
cd marketplace-backend

# 1. Create the pages
node seed-custom-pages.js

# 2. Add footer links
node add-footer-templates.js --merge

# 3. Verify in database
node check-footer-settings.js
```

## Troubleshooting

### No Footer Settings Found

If you get "No footer settings found", the script will automatically create default settings with all templates.

### Templates Not Showing

1. Check footer settings in database:
   ```powershell
   node check-footer-settings.js
   ```

2. Verify pages exist:
   ```sql
   SELECT title, slug FROM marketplace_pages;
   ```

3. Check if sections are enabled:
   ```javascript
   customSections.forEach(section => {
     console.log(section.title, section.enabled);
   });
   ```

### Links Not Working

Ensure the target pages exist:
- Run `node seed-custom-pages.js` to create missing pages
- Check page status is `published`
- Verify slugs match the URLs in footer links

## Production Checklist

Before deploying to production:

- ✅ Review all link labels for branding consistency
- ✅ Verify all URLs point to existing pages
- ✅ Test links on live site
- ✅ Remove or disable sections not needed
- ✅ Update "About Us" and "Contact" page URLs
- ✅ Add any business-specific links
- ✅ Test footer responsiveness on mobile
- ✅ Verify accessibility (keyboard navigation, screen readers)

## API Endpoints

### Get Footer Settings
```
GET /api/v1/footer-settings
```

### Update Footer Settings (Admin)
```
PUT /api/v1/admin/footer-settings
```

Request body:
```json
{
  "customSections": [
    {
      "title": "Legal",
      "enabled": true,
      "links": [
        { "label": "Privacy Policy", "url": "/privacy-policy" }
      ]
    }
  ]
}
```

## Related Files

- `seed-custom-pages.js` - Creates page content
- `add-footer-templates.js` - Adds footer links
- `check-footer-settings.js` - Verifies footer configuration
- `Footer.tsx` - Frontend footer component
- `footer-settings.service.ts` - Backend service

## Support

For issues or questions:
1. Check the database for footer settings
2. Verify pages exist and are published
3. Review browser console for frontend errors
4. Check backend logs for API errors

---

**Note**: These are templates to get started quickly. Customize them to match your marketplace's specific needs and branding.
