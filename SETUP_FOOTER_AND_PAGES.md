# Complete Footer & Custom Pages Setup Guide

This guide provides a complete walkthrough for setting up custom pages and footer templates in your marketplace.

## 🎯 What This Does

Creates professional pages with ready-to-use content and automatically adds them to your footer navigation:

### Pages Created:
1. **Privacy Policy** - GDPR-compliant privacy information
2. **Terms of Service** - Complete legal terms and conditions
3. **Cookie Policy** - Detailed cookie usage disclosure
4. **Become a Vendor** - Vendor onboarding and application info

### Footer Sections Added:
1. **Legal** - Privacy Policy, Terms of Service, Cookie Policy
2. **Company** - About Us, Become a Vendor, Contact Us
3. **Support** - Help Center, FAQ, Shipping Info, Returns
4. **Shop** - All Products, New Arrivals, Best Sellers, Sale

## 🚀 Quick Start (2 Commands)

```powershell
cd marketplace-backend

# Step 1: Create the pages with content
node seed-custom-pages.js

# Step 2: Add pages to footer
node add-footer-templates.js --merge
```

That's it! Your footer now has all the essential pages linked.

## 📖 Detailed Setup

### Method 1: Automated Setup (Recommended)

```powershell
# Navigate to backend directory
cd marketplace-backend

# Create all pages with professional content
node seed-custom-pages.js

# Add footer link templates (merge with existing)
node add-footer-templates.js --merge

# Verify everything is set up
node check-footer-settings.js
```

### Method 2: Using PowerShell Scripts

```powershell
# Create pages
.\seed-custom-pages.ps1

# Add footer templates
.\add-footer-templates.ps1 -Merge

# Check configuration
.\check-footer-settings.ps1
```

## 🎨 What Gets Created

### Custom Pages (in database `marketplace_pages` table)

| Page | URL | Content Type | Status |
|------|-----|--------------|--------|
| Privacy Policy | `/privacy-policy` | Markdown | Published |
| Terms of Service | `/terms-of-service` | Markdown | Published |
| Cookie Policy | `/cookie-policy` | Markdown | Published |
| Become a Vendor | `/become-a-vendor` | Markdown | Published |

### Footer Sections (in `footer_settings` table)

```json
{
  "customSections": [
    {
      "title": "Legal",
      "enabled": true,
      "links": [
        { "label": "Privacy Policy", "url": "/privacy-policy" },
        { "label": "Terms of Service", "url": "/terms-of-service" },
        { "label": "Cookie Policy", "url": "/cookie-policy" }
      ]
    },
    {
      "title": "Company",
      "enabled": true,
      "links": [
        { "label": "About Us", "url": "/about-us" },
        { "label": "Become a Vendor", "url": "/become-a-vendor" },
        { "label": "Contact Us", "url": "/contact" }
      ]
    },
    // ... more sections
  ]
}
```

## 🔧 Customization Options

### Option 1: Replace All Footer Sections

```powershell
node add-footer-templates.js --replace
```

Removes all existing custom sections and replaces with templates.

### Option 2: Merge with Existing

```powershell
node add-footer-templates.js --merge
```

Adds new template sections while keeping your existing custom sections.

### Option 3: Manual Customization

1. Visit admin panel: `http://localhost:3000/admin/settings/footer`
2. Edit sections, links, and labels
3. Reorder sections by drag & drop
4. Enable/disable sections as needed

## 📝 Editing Page Content

### Method 1: Admin Panel
1. Go to `http://localhost:3000/admin/pages`
2. Find the page you want to edit
3. Click "Edit"
4. Update the markdown content
5. Save changes

### Method 2: Re-seed with Modified Content
1. Edit templates in `seed-custom-pages.js`
2. Update the `content` field for any page
3. Run: `node seed-custom-pages.js`
4. Pages are updated (using `ON CONFLICT` clause)

### Method 3: Direct Database Update
```javascript
// Use the marketplace-pages service
const page = await marketplacePagesService.update(pageId, {
  content: 'Your new content here'
});
```

## 🌐 Accessing Your Pages

After setup, pages are immediately accessible:

### Public URLs:
- `http://localhost:3000/privacy-policy`
- `http://localhost:3000/terms-of-service`
- `http://localhost:3000/cookie-policy`
- `http://localhost:3000/become-a-vendor`

### API Endpoints:
```bash
# Get all published pages
GET http://localhost:3001/api/v1/marketplace/pages

# Get specific page by slug
GET http://localhost:3001/api/v1/marketplace/pages/slug/privacy-policy
```

### Footer Display:
Pages automatically appear in footer navigation at:
- `http://localhost:3000` (scroll to footer)

## 🔍 Verification Commands

### Check Pages Exist
```powershell
node seed-custom-pages.js
# Shows: "✅ Privacy Policy (/privacy-policy)" etc.
```

### Check Footer Configuration
```powershell
node check-footer-settings.js
# Shows all sections and links
```

### Direct Database Query
```powershell
# View pages
SELECT title, slug, status FROM marketplace_pages;

# View footer settings
SELECT "customSections" FROM footer_settings;
```

## 🎯 Use Cases

### Scenario 1: New Marketplace Setup
```powershell
# Complete setup
node seed-custom-pages.js
node add-footer-templates.js --merge
```

### Scenario 2: Update Existing Footer
```powershell
# Check current setup
node check-footer-settings.js

# Merge new templates with existing
node add-footer-templates.js --merge
```

### Scenario 3: Reset Footer to Defaults
```powershell
# Replace everything with templates
node add-footer-templates.js --replace
```

### Scenario 4: Update Page Content
```powershell
# Edit seed-custom-pages.js, then:
node seed-custom-pages.js
# Existing pages are updated
```

## 📋 File Reference

| File | Purpose |
|------|---------|
| `seed-custom-pages.js` | Creates pages with full content |
| `seed-custom-pages.ps1` | PowerShell wrapper for page seeding |
| `add-footer-templates.js` | Adds footer link sections |
| `add-footer-templates.ps1` | PowerShell wrapper for footer setup |
| `check-footer-settings.js` | Verifies footer configuration |
| `CUSTOM_PAGES_README.md` | Detailed page setup documentation |
| `FOOTER_TEMPLATES_README.md` | Footer template documentation |

## 🚨 Troubleshooting

### Pages Not Showing in Footer
```powershell
# Verify pages exist
node seed-custom-pages.js

# Check footer has links
node check-footer-settings.js

# Re-add footer templates
node add-footer-templates.js --merge
```

### 404 on Page URLs
- Ensure pages are `published` status
- Check slug matches URL exactly
- Verify Next.js dynamic route `[pageSlug]/page.tsx` exists

### Footer Not Displaying
- Check browser console for errors
- Verify Footer component is imported in layout
- Check API endpoint: `http://localhost:3001/api/v1/footer-settings`

### Database Connection Errors
- Verify `.env` file exists and has correct credentials
- Check PostgreSQL is running
- Test connection: `node check-footer-settings.js`

## ✅ Production Checklist

Before going live:

### Content Review
- [ ] Read through all four pages
- [ ] Update placeholder contact information
- [ ] Customize company name and branding
- [ ] Have legal review Privacy Policy and Terms
- [ ] Adjust cookie policy for your specific tracking

### Footer Links
- [ ] Verify all links work
- [ ] Remove unnecessary sections
- [ ] Update "About Us" URL if page exists
- [ ] Update "Contact" URL to your contact page
- [ ] Test all links on mobile

### Technical
- [ ] Pages are in `published` status
- [ ] Footer sections are `enabled`
- [ ] Test on staging environment
- [ ] Check page load times
- [ ] Verify SEO meta tags

### Legal Compliance
- [ ] Privacy Policy reflects actual data practices
- [ ] Terms of Service reviewed by legal counsel
- [ ] Cookie Policy matches actual cookie usage
- [ ] GDPR/CCPA compliance verified (if applicable)

## 🔗 Related Documentation

- [Custom Pages README](./CUSTOM_PAGES_README.md) - Detailed page creation docs
- [Footer Templates README](./FOOTER_TEMPLATES_README.md) - Footer customization guide
- Backend API: `src/modules/marketplace-pages/`
- Frontend Component: `marketplace-web/src/components/Footer.tsx`

## 💡 Tips

1. **Run both scripts together** for complete setup
2. **Use --merge flag** to preserve existing custom sections
3. **Edit in admin panel** for quick changes
4. **Re-run scripts** to update multiple pages at once
5. **Check after updates** with `check-footer-settings.js`

## 📞 Support

If you encounter issues:
1. Check terminal output for error messages
2. Verify database connection in `.env`
3. Ensure all services are running
4. Review the detailed READMEs for specific features

---

**Quick Reference:**
```powershell
# Complete setup
node seed-custom-pages.js && node add-footer-templates.js --merge

# Verify
node check-footer-settings.js

# Access admin
http://localhost:3000/admin/settings/footer
```
