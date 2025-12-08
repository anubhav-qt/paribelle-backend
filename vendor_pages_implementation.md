# Vendor Custom Pages Implementation

## Overview
This feature allows vendors to create and manage custom pages for their storefront, including About Us, Contact, FAQ, Terms & Conditions, Privacy Policy, and fully custom pages. Vendors can use a rich text editor to create content, add images, manage SEO metadata, and control navigation visibility.

## Backend Implementation

### Database Entities

#### 1. VendorPage Entity
**Location**: `src/modules/vendors/entities/vendor-page.entity.ts`

**Fields**:
- `id` (UUID, Primary Key)
- `vendorId` (UUID, Foreign Key to vendors table)
- `title` (string, max 200 chars) - Page title
- `slug` (string, max 200 chars) - URL-friendly identifier
- `pageType` (enum) - Type of page: `custom`, `about`, `contact`, `faq`, `terms`, `privacy`
- `content` (text) - HTML content from rich text editor
- `excerpt` (string, max 500 chars, optional) - Short description
- `featuredImage` (string, optional) - URL to featured image
- `images` (array, optional) - Additional image URLs
- `metaTitle` (string, max 200 chars, optional) - SEO title
- `metaDescription` (string, max 300 chars, optional) - SEO description
- `metaKeywords` (string, max 500 chars, optional) - SEO keywords
- `status` (enum) - `draft`, `published`, `archived`
- `order` (integer, default 0) - Sort order for navigation
- `showInNavigation` (boolean, default false) - Display in header menu
- `isHomePage` (boolean, default false) - Use as vendor homepage
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

**Indexes**:
- `IDX_vendor_pages_vendorId` - For filtering by vendor
- `IDX_vendor_pages_status` - For filtering by status
- `IDX_vendor_pages_vendorId_slug` (Unique) - Ensures unique slugs per vendor

**Relations**:
- `ManyToOne` with `Vendor` entity (CASCADE on delete)

#### 2. VendorBlogPost Entity
**Location**: `src/modules/vendors/entities/vendor-blog-post.entity.ts`

**Fields**:
- `id` (UUID, Primary Key)
- `vendorId` (UUID, Foreign Key)
- `title` (string, max 200 chars)
- `slug` (string, max 200 chars)
- `content` (text) - HTML content
- `excerpt` (string, max 500 chars, optional)
- `featuredImage` (string, optional)
- `images` (array, optional)
- `authorName` (string, max 100 chars, optional)
- `tags` (array, optional)
- `metaTitle`, `metaDescription`, `metaKeywords` (SEO fields)
- `status` (enum) - `draft`, `published`, `archived`
- `publishedAt` (timestamp, optional)
- `viewCount` (integer, default 0)
- `createdAt`, `updatedAt` (timestamps)

**Indexes**:
- Vendor ID, Status, Published date
- Unique slug per vendor

#### 3. VendorNavigation Entity
**Location**: `src/modules/vendors/entities/vendor-navigation.entity.ts`

**Fields**:
- `id` (UUID, Primary Key)
- `vendorId` (UUID, Foreign Key)
- `label` (string, max 100 chars) - Display text
- `url` (string, max 500 chars) - Link URL
- `order` (integer, default 0) - Sort order
- `parentId` (UUID, optional) - For nested menus
- `position` (enum) - `header`, `footer`, `both`
- `openInNewTab` (boolean, default false)
- `isActive` (boolean, default true)
- `createdAt`, `updatedAt` (timestamps)

**Indexes**:
- Vendor ID, Position, Order

### API Endpoints

**Base URL**: `/api/v1/vendors`

#### Vendor Pages Controller
**Location**: `src/modules/vendors/vendor-pages.controller.ts`

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/pages` | List all pages for authenticated vendor | Yes (Vendor) |
| POST | `/pages` | Create a new page | Yes (Vendor) |
| GET | `/pages/:id` | Get page by ID | Yes (Vendor) |
| PUT | `/pages/:id` | Update page | Yes (Vendor) |
| DELETE | `/pages/:id` | Delete page | Yes (Vendor) |
| PATCH | `/pages/:id/publish` | Publish page (set status to published) | Yes (Vendor) |
| PATCH | `/pages/:id/unpublish` | Unpublish page (set status to draft) | Yes (Vendor) |
| PATCH | `/pages/:id/reorder` | Update page order | Yes (Vendor) |
| GET | `/:vendorId/pages/slug/:slug` | Get published page by slug (public) | No |

### Services

#### VendorPagesService
**Location**: `src/modules/vendors/vendor-pages.service.ts`

**Methods**:
- `findAll(vendorId, status?)` - Get all pages for a vendor, optionally filtered by status
- `findOne(id, vendorId)` - Get a specific page
- `findBySlug(vendorId, slug)` - Get page by slug for public access
- `create(vendorId, createDto)` - Create new page
- `update(id, vendorId, updateDto)` - Update existing page
- `publish(id, vendorId)` - Set page status to published
- `unpublish(id, vendorId)` - Set page status to draft
- `remove(id, vendorId)` - Delete page
- `reorder(id, vendorId, newOrder)` - Update page order

### DTOs

#### CreateVendorPageDto
**Location**: `src/modules/vendors/dto/create-vendor-page.dto.ts`

```typescript
{
  title: string;           // Required
  slug?: string;           // Auto-generated if not provided
  pageType: PageType;      // Required
  content: string;         // Required
  excerpt?: string;
  featuredImage?: string;
  images?: string[];
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
  showInNavigation?: boolean;
  isHomePage?: boolean;
  order?: number;
}
```

#### UpdateVendorPageDto
**Location**: `src/modules/vendors/dto/update-vendor-page.dto.ts`

All fields are optional (extends PartialType of CreateVendorPageDto)

### Database Migrations

#### Migration Files Created:
1. `src/migrations/1733673600000-CreateVendorPagesTable.ts`
2. `src/migrations/1733673700000-CreateVendorBlogPostsTable.ts`
3. `src/migrations/1733673800000-CreateVendorNavigationTable.ts`

**Note**: Tables were created automatically via TypeORM's `synchronize: true` feature in development.

### Module Updates

**VendorsModule** (`src/modules/vendors/vendors.module.ts`):
- Added `VendorPage`, `VendorBlogPost`, `VendorNavigation` to TypeORM entities
- Registered `VendorPagesService` as provider
- Exported `VendorPagesController`

## Frontend Implementation

### Components

#### 1. RichTextEditor Component
**Location**: `marketplace-web/src/components/RichTextEditor.tsx`

**Features**:
- Tiptap-based WYSIWYG editor
- Toolbar with formatting options:
  - Text formatting: Bold, Italic, Strike-through
  - Headings: H1, H2, H3
  - Lists: Bullet and Numbered
  - Text alignment: Left, Center, Right
  - Links: Add/edit hyperlinks
  - Images: Insert images via URL
  - Undo/Redo functionality
- Real-time preview
- Dark mode support

**Dependencies**:
```json
{
  "@tiptap/react": "^2.x",
  "@tiptap/starter-kit": "^2.x",
  "@tiptap/extension-image": "^2.x",
  "@tiptap/extension-link": "^2.x",
  "@tiptap/extension-text-align": "^2.x"
}
```

**Usage**:
```tsx
<RichTextEditor
  content={content}
  onChange={(html) => setContent(html)}
/>
```

#### 2. ThemeToggle Component
**Location**: `marketplace-web/src/components/ThemeToggle.tsx`

**Features**:
- Light/dark mode toggle
- Sun/moon icons
- Hydration-safe (prevents SSR mismatch)
- Integrated into Header and VendorHeader

### Pages

#### 1. Vendor Dashboard - Custom Pages Link
**Location**: `marketplace-web/src/app/vendor/dashboard/page.tsx`

**Updates**:
- Added "📄 Custom Pages" card linking to `/vendor/pages`
- Disabled when vendor status is not `active`

#### 2. Page Manager (List View)
**Location**: `marketplace-web/src/app/vendor/pages/page.tsx`

**Features**:
- Table view of all pages with columns:
  - Title
  - Type (with badge)
  - Status (Draft/Published/Archived)
  - Navigation visibility
  - Actions (Edit, Delete, Publish/Unpublish)
- Create New Page button
- Color-coded status badges
- Confirmation dialog for delete
- Real-time status updates

**API Calls**:
- `GET /api/v1/vendors/pages` - Fetch all pages
- `PATCH /api/v1/vendors/pages/:id/publish` - Publish page
- `PATCH /api/v1/vendors/pages/:id/unpublish` - Unpublish page
- `DELETE /api/v1/vendors/pages/:id` - Delete page

#### 3. Create New Page
**Location**: `marketplace-web/src/app/vendor/pages/new/page.tsx`

**Form Fields**:
- Title (required)
- Slug (auto-generated, editable)
- Page Type (dropdown)
- Content (rich text editor)
- Excerpt (textarea)
- Featured Image URL
- SEO Fields:
  - Meta Title
  - Meta Description
  - Meta Keywords
- Options:
  - Show in Navigation (checkbox)
  - Set as Homepage (checkbox)

**Validation**:
- Title required
- Slug format validation
- Content required

**API Call**:
- `POST /api/v1/vendors/pages` - Create page

#### 4. Edit Page
**Location**: `marketplace-web/src/app/vendor/pages/[id]/edit/page.tsx`

**Features**:
- Pre-populated form with existing page data
- Same fields as create page
- Save Changes button
- Cancel navigation

**API Calls**:
- `GET /api/v1/vendors/pages/:id` - Fetch page data
- `PUT /api/v1/vendors/pages/:id` - Update page

#### 5. Public Page Renderer
**Location**: `marketplace-web/src/app/vendor/[vendorSlug]/[pageSlug]/page.tsx`

**Features**:
- Server-side rendered for SEO
- Dynamic metadata (title, description, keywords)
- Renders HTML content safely
- Shows featured image
- Responsive design with Tailwind
- Dark mode support
- 404 handling for unpublished/missing pages

**API Call**:
- `GET /api/v1/vendors/:vendorId/pages/slug/:slug` - Fetch public page

**SEO Implementation**:
```typescript
export async function generateMetadata({ params }): Promise<Metadata> {
  // Fetches page and returns meta tags
}
```

#### 6. Updated VendorHeader
**Location**: `marketplace-web/src/components/VendorHeader.tsx`

**New Features**:
- Dynamic navigation menu
- Fetches custom pages where `showInNavigation = true`
- Renders pages in order
- Links to `/vendor/[vendorSlug]/[pageSlug]`
- Responsive navigation (hidden on mobile, shown on lg+)

**Added Code**:
```typescript
const [customPages, setCustomPages] = useState<any[]>([]);

useEffect(() => {
  fetchCustomPages();
}, [vendorId]);

const fetchCustomPages = async () => {
  const pages = await fetch(`/api/v1/vendors/pages?status=published`);
  const filtered = pages.filter(p => p.showInNavigation);
  setCustomPages(filtered.sort((a, b) => a.order - b.order));
};
```

## Data Flow

### Creating a Page
1. Vendor navigates to `/vendor/pages/new`
2. Fills out form with rich text content
3. Clicks "Create Page"
4. Frontend sends POST to `/api/v1/vendors/pages`
5. Backend validates data and creates record
6. Returns page object with ID
7. Redirects to page manager

### Publishing a Page
1. Vendor clicks "Publish" on page list
2. Frontend sends PATCH to `/api/v1/vendors/pages/:id/publish`
3. Backend updates status to `published`
4. Page becomes visible on public site
5. If `showInNavigation = true`, appears in header menu

### Viewing a Public Page
1. Customer visits `/vendor/{vendorSlug}/{pageSlug}`
2. Next.js calls `generateMetadata` (server-side)
3. Fetches page data from API
4. Renders SEO meta tags
5. Page component fetches same data
6. Renders content with styling

## Security

### Authentication
- All vendor endpoints protected by `JwtAuthGuard`
- Vendor can only access their own pages (filtered by `vendorId`)
- Public endpoints allow unauthenticated access for published pages only

### Authorization
- Vendor ID extracted from JWT token
- All queries filtered by `vendorId`
- No cross-vendor data access possible

### Data Validation
- DTOs validate all input fields
- Slug sanitization to prevent injection
- HTML content sanitized on render (Next.js automatic escaping)
- Status enum prevents invalid states

## Testing Checklist

### Backend API
- [ ] Create page with all fields
- [ ] Create page with minimal fields (title, type, content)
- [ ] Update page
- [ ] Publish/unpublish page
- [ ] Delete page
- [ ] Fetch pages by vendor
- [ ] Fetch page by slug (public)
- [ ] Test unique slug constraint
- [ ] Test vendor isolation (cannot access other vendor's pages)
- [ ] Test authentication (requires valid JWT)

### Frontend
- [ ] Navigate to page manager
- [ ] Create new custom page
- [ ] Create each page type (about, contact, faq, etc.)
- [ ] Use rich text editor features (bold, italic, headings, lists, images, links)
- [ ] Upload featured image
- [ ] Toggle "Show in Navigation"
- [ ] Publish page
- [ ] Verify page appears in header navigation
- [ ] Edit existing page
- [ ] Delete page with confirmation
- [ ] View public page
- [ ] Verify SEO meta tags in HTML source
- [ ] Test responsive design (mobile, tablet, desktop)
- [ ] Test dark mode rendering

### Integration
- [ ] Create page → Publish → Verify in navigation → Click link → View public page
- [ ] Create multiple pages → Verify order in navigation
- [ ] Unpublish page → Verify removed from navigation
- [ ] Delete page → Verify removed from navigation
- [ ] Set custom page as homepage → Verify loads on vendor root URL
- [ ] Test with vendor storefront theme colors

## Future Enhancements

### Planned Features
1. **Blog Implementation**
   - Blog post list page
   - Blog post editor
   - Categories and tags
   - Comments system
   - RSS feed

2. **Navigation Builder**
   - Drag-and-drop menu builder
   - Nested navigation (dropdowns)
   - External links
   - Footer navigation

3. **Page Templates**
   - Pre-designed layouts
   - Drag-and-drop page builder
   - Section components (hero, features, testimonials, etc.)
   - Template library

4. **Media Manager**
   - Upload images directly
   - Image gallery
   - Image optimization
   - CDN integration

5. **Advanced SEO**
   - Open Graph tags
   - Twitter Cards
   - Schema.org structured data
   - Sitemap generation

6. **Analytics**
   - Page view tracking
   - Popular pages report
   - Traffic sources
   - User engagement metrics

7. **Versioning**
   - Page revision history
   - Compare versions
   - Restore previous version
   - Draft auto-save

## File Structure

```
marketplace-backend/
├── src/
│   ├── modules/
│   │   └── vendors/
│   │       ├── entities/
│   │       │   ├── vendor-page.entity.ts
│   │       │   ├── vendor-blog-post.entity.ts
│   │       │   └── vendor-navigation.entity.ts
│   │       ├── dto/
│   │       │   ├── create-vendor-page.dto.ts
│   │       │   └── update-vendor-page.dto.ts
│   │       ├── vendor-pages.service.ts
│   │       ├── vendor-pages.controller.ts
│   │       └── vendors.module.ts (updated)
│   ├── migrations/
│   │   ├── 1733673600000-CreateVendorPagesTable.ts
│   │   ├── 1733673700000-CreateVendorBlogPostsTable.ts
│   │   └── 1733673800000-CreateVendorNavigationTable.ts
│   └── database/
│       └── data-source.ts (created)
└── package.json (updated)

marketplace-web/
├── src/
│   ├── app/
│   │   └── vendor/
│   │       ├── dashboard/
│   │       │   └── page.tsx (updated)
│   │       ├── pages/
│   │       │   ├── page.tsx (page manager)
│   │       │   ├── new/
│   │       │   │   └── page.tsx (create page)
│   │       │   └── [id]/
│   │       │       └── edit/
│   │       │           └── page.tsx (edit page)
│   │       └── [vendorSlug]/
│   │           └── [pageSlug]/
│   │               └── page.tsx (public page)
│   └── components/
│       ├── RichTextEditor.tsx (new)
│       ├── ThemeToggle.tsx (new)
│       ├── Header.tsx (updated)
│       └── VendorHeader.tsx (updated)
└── package.json (updated with Tiptap)
```

## Environment Variables

No new environment variables required. Uses existing:
- `DATABASE_URL` or `DB_*` variables for database connection
- `NEXT_PUBLIC_API_URL` for frontend API calls

## Dependencies

### Backend
All dependencies already installed in base project:
- `@nestjs/typeorm`
- `typeorm`
- `pg` (PostgreSQL driver)
- `class-validator`
- `class-transformer`

### Frontend
**New dependencies installed**:
```json
{
  "@tiptap/react": "^2.x",
  "@tiptap/starter-kit": "^2.x",
  "@tiptap/extension-image": "^2.x",
  "@tiptap/extension-link": "^2.x",
  "@tiptap/extension-text-align": "^2.x",
  "lucide-react": "latest"
}
```

## Deployment Notes

1. **Database**: Tables created automatically via TypeORM synchronize in development
2. **Production**: Set `synchronize: false` and run migrations manually
3. **Migration Command**: `npm run migration:run`
4. **Build**: Both backend and frontend build successfully
5. **No breaking changes**: Existing functionality unaffected

## Support

For issues or questions:
- Check API response errors in browser console
- Verify JWT token in localStorage
- Check backend logs for database errors
- Ensure vendor status is `active` for page creation
- Verify `NEXT_PUBLIC_API_URL` is correct

---

**Implementation Date**: December 8, 2025  
**Version**: 1.0.0  
**Status**: ✅ Complete and Ready for Testing
