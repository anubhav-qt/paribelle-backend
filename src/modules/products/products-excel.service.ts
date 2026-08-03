import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { Product } from './product.entity';
import { ProductVariant } from './product-variant.entity';
import { Category } from '../categories/category.entity';
import { Vendor } from '../vendors/vendor.entity';
import { User, UserRole } from '../users/user.entity';
import { CloudinaryService } from '../../common/services/cloudinary.service';
import * as fs from 'fs';
import * as path from 'path';
import archiver from 'archiver';
import AdmZip from 'adm-zip';
import { gstRateFor } from './gst-rates';

export { CATEGORY_GST_RULES, gstRateFor } from './gst-rates';

// Define Multer File type to avoid Express namespace issues
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
  destination?: string;
  filename?: string;
  path?: string;
}

@Injectable()
export class ProductsExcelService {
  constructor(
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    @InjectRepository(ProductVariant)
    private productVariantsRepository: Repository<ProductVariant>,
    @InjectRepository(Category)
    private categoriesRepository: Repository<Category>,
    @InjectRepository(Vendor)
    private vendorsRepository: Repository<Vendor>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private cloudinaryService: CloudinaryService,
  ) {}

  /**
   * The single top-level directory every entry sits under, as a prefix ending
   * in `/` — or `''` when the archive has no such wrapper. Only a directory
   * shared by *every* entry counts, so a flat ZIP with an `images/` folder is
   * left alone.
   */
  private findCommonZipRoot(names: string[]): string {
    if (names.length === 0) return '';

    const firstSegment = (name: string) => {
      const slash = name.indexOf('/');
      return slash === -1 ? null : name.slice(0, slash);
    };

    const root = firstSegment(names[0]);
    if (!root) return '';
    if (!names.every((n) => firstSegment(n) === root)) return '';

    return `${root}/`;
  }

  /**
   * Codes are matched case- and whitespace-insensitively. Spreadsheets pick up
   * trailing spaces and inconsistent capitalisation constantly, and a variant
   * silently failing to find its product is a far worse outcome than tolerating
   * "BANDESH-02" vs "bandesh-02 ".
   */
  private normalizeCode(code: string | undefined | null): string {
    return (code ?? '').trim().toLowerCase();
  }

  /**
   * Look a listed image name up in the ZIP. Sellers routinely leave the
   * extension off ("brown-jacket-01"), so an exact miss retries against the
   * known image extensions before giving up.
   */
  private resolveImageEntry(
    name: string,
    imageMap: Map<string, MulterFile>,
  ): { filename: string; file: MulterFile } | null {
    const base = path.basename(name).trim().toLowerCase();
    if (!base) return null;

    const exact = imageMap.get(base);
    if (exact) return { filename: base, file: exact };

    for (const ext of ['jpeg', 'jpg', 'png', 'webp', 'gif']) {
      const candidate = `${base}.${ext}`;
      const file = imageMap.get(candidate);
      if (file) return { filename: candidate, file };
    }

    return null;
  }

  /**
   * Images for a product when the `Images` column is blank, by the naming
   * convention the export uses: `<product-code>-<nn>.<ext>`. Returned in `nn`
   * order so the featured image is the one the seller numbered first.
   */
  private imagesForCodeByConvention(
    code: string | undefined,
    imageMap: Map<string, MulterFile>,
  ): string[] {
    const prefix = this.normalizeCode(code);
    if (!prefix) return [];

    const pattern = new RegExp(
      `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d+)\\.(?:jpe?g|png|gif|webp)$`,
    );

    return Array.from(imageMap.keys())
      .map((filename) => ({ filename, match: pattern.exec(filename) }))
      .filter((entry): entry is { filename: string; match: RegExpExecArray } => entry.match !== null)
      .sort((a, b) => Number(a.match[1]) - Number(b.match[1]))
      .map((entry) => entry.filename);
  }

  /** Find a product by SKU, ignoring case and surrounding whitespace. */
  private async findProductBySku(sku: string): Promise<Product | null> {
    return (
      (await this.productsRepository
        .createQueryBuilder('product')
        .leftJoinAndSelect('product.categories', 'categories')
        .where('LOWER(TRIM(product.sku)) = :sku', { sku: this.normalizeCode(sku) })
        .getOne()) ?? null
    );
  }

  private async getOrCreatePlatformVendorForImport(): Promise<Vendor> {
    let platformVendor = await this.vendorsRepository.findOne({ where: { slug: 'marketplace-platform' } });

    if (platformVendor?.userId) {
      return platformVendor;
    }

    let platformUser = await this.usersRepository.findOne({
      where: {
        role: UserRole.SUPER_ADMIN,
        vendorId: IsNull(),
      },
    });

    if (!platformUser) {
      platformUser = await this.usersRepository.findOne({
        where: {
          vendorId: IsNull(),
        },
      });
    }

    if (!platformUser) {
      throw new Error('No available user found for platform vendor. Please create a super admin user and retry import.');
    }

    if (!platformVendor) {
      platformVendor = this.vendorsRepository.create({
        userId: platformUser.id,
        user: platformUser,
        storeName: 'Platform Store',
        slug: 'marketplace-platform',
        businessName: 'Platform Business',
        contactEmail: 'platform@marketplace.com',
        contactPhone: '0000000000',
        status: 'active' as any,
        kycStatus: 'approved' as any,
      });
      try {
        platformVendor = await this.vendorsRepository.save(platformVendor);
        console.log('[Import] Created platform vendor for admin imports');
        return platformVendor;
      } catch (error) {
        // Handle concurrent imports attempting to create the same platform vendor.
        const isDuplicateKey =
          error?.code === '23505' ||
          error?.message?.toLowerCase?.().includes('duplicate key');

        if (!isDuplicateKey) {
          throw error;
        }

        const existingBySlug = await this.vendorsRepository.findOne({ where: { slug: 'marketplace-platform' } });
        if (existingBySlug?.userId) {
          return existingBySlug;
        }

        const existingByUser = await this.vendorsRepository.findOne({ where: { userId: platformUser.id } });
        if (existingByUser) {
          return existingByUser;
        }

        throw error;
      }
    }

    platformVendor.userId = platformUser.id;
    platformVendor.user = platformUser;
    platformVendor = await this.vendorsRepository.save(platformVendor);
    console.log('[Import] Updated existing platform vendor with a valid user_id for admin imports');
    return platformVendor;
  }

  /**
   * Apply standard header styling to a sheet
   */
  private styleHeaderRow(sheet: ExcelJS.Worksheet, color: string = 'FF4472C4'): void {
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: color },
    };
  }

  private getMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }


  private async saveUploadedImage(file: MulterFile, vendorId: string): Promise<string> {
    try {
      // Try Cloudinary first if configured
      if (this.cloudinaryService.isEnabled()) {
        const folder = `marketplace/products/${vendorId}`;
        const result = await this.cloudinaryService.uploadImage(file.buffer, folder, {
          maxWidth: 1920,
          quality: 85,
          format: 'jpeg',
        });
        console.log(`✅ Image uploaded to Cloudinary: ${result.secure_url}`);
        return result.secure_url;
      }

      // Fallback to local filesystem (development only)
      console.warn('⚠️ Cloudinary not configured, saving to local filesystem');
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'products', vendorId);
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const ext = path.extname(file.originalname);
      const filename = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${ext}`;
      const filePath = path.join(uploadsDir, filename);

      fs.writeFileSync(filePath, file.buffer);

      return `/uploads/products/${vendorId}/${filename}`;
    } catch (error) {
      console.error(`❌ Error saving image ${file.originalname}:`, error);
      throw new Error(`Failed to save image: ${error.message}`);
    }
  }


  // ────────────────────────────────────────────────────────────────────────────
  // SIMPLE PRODUCT IMPORT / EXPORT — the only import format.
  // "Product Code" is optional; when given it acts as a stable upsert key so
  // re-importing the same file updates existing products instead of
  // duplicating them. "Category" must match an existing category name exactly
  // — unknown categories are rejected as a row error, never auto-created.
  // HSN Code / GST Rate are not columns here: GST is derived per category
  // (see CATEGORY_GST_RATES below) since this storefront only sells two kinds
  // of goods and a per-row rate is one more way to get it wrong.
  // ────────────────────────────────────────────────────────────────────────────

  /** 8 columns — Product Code and Compare At Price are optional. */
  private getSimpleProductColumns(): any[] {
    return [
      { header: 'Product Code',     key: 'productCode',    width: 16 },
      { header: 'Product Name',     key: 'name',           width: 30 },
      { header: 'Category',         key: 'category',       width: 20 },
      { header: 'Price',            key: 'price',          width: 12 },
      { header: 'Stock',            key: 'stockQuantity',  width: 12 },
      { header: 'Images',           key: 'images',         width: 40 },
      { header: 'Description',      key: 'description',    width: 50 },
      { header: 'Compare At Price', key: 'compareAtPrice', width: 18 },
      { header: 'Attributes',       key: 'attributes',     width: 40 },
    ];
  }

  /** 7 columns — one row per size/colour combo */
  private getSimpleVariantColumns(): any[] {
    return [
      { header: 'Product Code',     key: 'productCode',    width: 16 },
      { header: 'Variant Code',     key: 'variantCode',    width: 16 },
      { header: 'Attributes',       key: 'attributes',     width: 40 },
      { header: 'Price',            key: 'price',          width: 12 },
      { header: 'Compare At Price', key: 'compareAtPrice', width: 18 },
      { header: 'Stock',            key: 'stock',          width: 12 },
      { header: 'Active',           key: 'isActive',       width: 10 },
    ];
  }

  /** Export physical products as a simple ZIP.
   *  Pass productIds to export only selected products; omit for all. */
  async exportSimplePhysicalZip(vendorId: string | null, productIds?: string[]): Promise<Buffer> {
    const whereCondition: any = { productType: 'physical' };
    if (vendorId) whereCondition.vendorId = vendorId;

    let products = await this.productsRepository.find({
      where: whereCondition,
      relations: ['categories', 'vendor', 'productVariants'],
    });

    if (productIds && productIds.length > 0) {
      products = products.filter(p => productIds.includes(p.id));
    }

    const workbook = new ExcelJS.Workbook();

    // ── Products sheet ────────────────────────────────────────────────────────
    const productSheet = workbook.addWorksheet('Products');
    productSheet.columns = this.getSimpleProductColumns();
    this.styleHeaderRow(productSheet, 'FF2E86C1');

    const localImagePaths: string[] = [];

    for (const product of products) {
      const allImages: string[] = [];
      if (product.images?.length) allImages.push(...product.images.filter(Boolean));
      if (product.featuredImage && !allImages.includes(product.featuredImage)) {
        allImages.unshift(product.featuredImage);
      }
      const imagesList = allImages
        .map(img => (img.startsWith('http://') || img.startsWith('https://')) ? img : path.basename(img))
        .join(', ');
      localImagePaths.push(...allImages.filter(img => !img.startsWith('http')));

      const hasVariants = product.hasVariants && product.productVariants?.length > 0;
      const totalStock = hasVariants
        ? product.productVariants.reduce((s, v) => s + (v.stockQuantity || 0), 0)
        : product.stockQuantity;

      // Build attributes string (key: value, ...) excluding nested objects like booking/tour metadata
      let attributesStr = '';
      if (product.attributes) {
        const attrEntries = Object.entries(product.attributes)
          .filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object')
          .map(([k, v]) => `${k}: ${v}`);
        attributesStr = attrEntries.join(', ');
      }

      productSheet.addRow({
        productCode:    product.sku || '',
        name:           product.name,
        description:    product.description || '',
        category:       product.categories?.[0]?.name || '',
        price:          product.price,
        compareAtPrice: product.compareAtPrice || '',
        stockQuantity:  totalStock,
        images:         imagesList,
        attributes:     attributesStr,
      });
    }

    // ── Variants sheet ────────────────────────────────────────────────────────
    const allVariants = products.flatMap(p =>
      (p.hasVariants && p.productVariants?.length)
        ? p.productVariants.map(v => ({ product: p, variant: v }))
        : []
    );

    if (allVariants.length > 0) {
      const variantSheet = workbook.addWorksheet('Variants');
      variantSheet.columns = this.getSimpleVariantColumns();
      this.styleHeaderRow(variantSheet, 'FF8E44AD');

      for (const { product, variant } of allVariants) {
        const actualAttrs: Record<string, string> = {};
        if (variant.variantAttributes) {
          for (const [k, v] of Object.entries(variant.variantAttributes)) {
            const norm = k.toLowerCase().replace(/\s+/g, '');
            if (!['stock', 'active', 'isactive', 'stockquantity', 'price', 'compareatprice', 'sku'].includes(norm)) {
              actualAttrs[k] = String(v);
            }
          }
        }
        const attributesStr = Object.entries(actualAttrs).map(([k, v]) => `${k}: ${v}`).join(', ');

        variantSheet.addRow({
          productCode:    product.sku || '',
          variantCode:    variant.sku || '',
          attributes:     attributesStr,
          price:          variant.price,
          compareAtPrice: variant.compareAtPrice || '',
          stock:          variant.stockQuantity,
          isActive:       variant.isActive ? 'YES' : 'NO',
        });
      }

      // Active dropdown applied AFTER data rows
      for (let row = 2; row <= allVariants.length + 1; row++) {
        variantSheet.getCell(row, 7).dataValidation = {
          type: 'list', allowBlank: false, formulae: ['"YES,NO"'],
        };
      }
    }

    // ── Build ZIP ─────────────────────────────────────────────────────────────
    const excelBuffer = await workbook.xlsx.writeBuffer();

    return new Promise<Buffer>((resolve, reject) => {
      const archive = archiver('zip', { zlib: { level: 9 } });
      const chunks: Buffer[] = [];
      archive.on('data', c => chunks.push(c));
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', reject);

      archive.append(Buffer.from(excelBuffer as ArrayBuffer), { name: 'products.xlsx' });

      const addedImages = new Set<string>();
      for (const imgPath of localImagePaths) {
        if (addedImages.has(imgPath)) continue;
        addedImages.add(imgPath);
        const fullPath = path.join(process.cwd(), 'public', imgPath);
        if (fs.existsSync(fullPath)) {
          archive.file(fullPath, { name: `images/${path.basename(imgPath)}` });
        }
      }

      archive.finalize();
    });
  }

  /** Import physical products from a simple ZIP (products.xlsx + images/ folder).
   *  Products are upserted by Product Code (= product sku field).
   *  Variants are upserted by Variant Code (= variant sku field).
   *
   *  Pass `dryRun` to validate the whole workbook and report every row error
   *  without writing anything — the counts come back as what *would* happen. */
  async importSimplePhysicalZip(
    vendorId: string | null,
    zipBuffer: Buffer,
    options: { dryRun?: boolean } = {},
  ): Promise<{ created: number; updated: number; errors: string[]; dryRun: boolean }> {
    const dryRun = options.dryRun === true;
    const zip = new AdmZip(zipBuffer);
    const imageMap = new Map<string, MulterFile>();
    let excelBuffer: Buffer | null = null;

    // Zipping a *folder* (the natural thing to do on Windows) puts everything
    // under one wrapper directory — `Paribelle/products.xlsx`. Strip a single
    // common root so those ZIPs import the same as a flat one.
    const entries = zip.getEntries().filter((e) => !e.isDirectory);
    const normalizedNames = entries.map((e) => e.entryName.replace(/\\/g, '/'));
    const commonRoot = this.findCommonZipRoot(normalizedNames);

    entries.forEach((entry, i) => {
      const relPath = normalizedNames[i].slice(commonRoot.length);
      if (relPath.toLowerCase() === 'products.xlsx') {
        excelBuffer = entry.getData();
      } else if (/\.(jpe?g|png|gif|webp)$/i.test(relPath)) {
        // Index every image in the ZIP by bare filename, wherever it sits.
        // Requiring an `images/` prefix meant a wrapper folder silently
        // produced a catalogue with no pictures at all.
        const filename = path.basename(relPath).toLowerCase();
        const buf = entry.getData();
        imageMap.set(filename, {
          fieldname: 'images', originalname: filename,
          encoding: '7bit', mimetype: this.getMimeType(filename),
          buffer: buf, size: buf.length,
        } as MulterFile);
      }
    });

    if (!excelBuffer) {
      throw new Error(
        'No products.xlsx found in ZIP. The ZIP must contain a file named products.xlsx ' +
        '(either at the top level or inside a single wrapper folder).',
      );
    }

    const resolvedVendorId = vendorId ?? (await this.getOrCreatePlatformVendorForImport()).id;

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(excelBuffer as any);

    let created = 0, updated = 0;
    const errors: string[] = [];

    // normalized productCode (or `name:<name>` when a row has no code) → DB id,
    // used when processing variants
    const productCodeToId = new Map<string, string>();

    // Same keys, mapped to the row that claimed them, so a duplicate is a row
    // error rather than a silent overwrite.
    const seenRowKeys = new Map<string, number>();

    // ── Helper: build header→colIndex map ─────────────────────────────────────
    const buildHeaderMap = (sheet: ExcelJS.Worksheet): Map<string, number> => {
      const map = new Map<string, number>();
      sheet.getRow(1).eachCell((cell, colIdx) => {
        map.set(cell.value?.toString().trim() ?? '', colIdx);
      });
      return map;
    };

    const getVal = (row: ExcelJS.Row, headers: Map<string, number>, header: string): string | undefined => {
      const idx = headers.get(header);
      if (!idx) return undefined;
      const raw = row.getCell(idx).value;
      if (raw === null || raw === undefined) return undefined;
      if (typeof raw === 'object' && 'richText' in (raw as any)) {
        return (raw as any).richText.map((r: any) => r.text).join('');
      }
      return String(raw);
    };

    // ── Products sheet ────────────────────────────────────────────────────────
    const productSheet = workbook.getWorksheet('Products');
    if (!productSheet) {
      errors.push('No "Products" sheet found. Make sure the sheet is named exactly "Products".');
      return { created, updated, errors, dryRun };
    }

    const productHeaders = buildHeaderMap(productSheet);

    // Track attribute key→values per category for auto-adding to filter config
    const simpleCategoryAttrs = new Map<string, Map<string, Set<string>>>();

    // Collect rows first (eachRow is synchronous; async processing must be sequential)
    const productRows: Array<{ row: ExcelJS.Row; rn: number }> = [];
    productSheet.eachRow((row, rn) => { if (rn > 1) productRows.push({ row, rn }); });

    for (const { row, rn } of productRows) {
      try {
        const g = (h: string) => getVal(row, productHeaders, h);

        const productCode = g('Product Code')?.trim();
        const name        = g('Product Name')?.trim();
        if (!name) continue; // blank row

        const description   = g('Description')?.trim() || '';
        const categoryName  = g('Category')?.trim() || '';
        const price         = parseFloat(g('Price') || '0') || 0;
        const compareAtPrice = parseFloat(g('Compare At Price') || '0') || null;
        const stockQuantity  = parseInt(g('Stock') || '0') || 0;
        const imagesCell     = g('Images')?.trim() || '';

        // Category must match an existing category exactly — unknown names
        // are a row error, never auto-created (see class doc comment above
        // getSimpleProductColumns for why).
        if (!categoryName) {
          errors.push(`Row ${rn}: Category is required`);
          continue;
        }
        const category = await this.categoriesRepository.findOne({
          where: { name: categoryName, isActive: true },
        });
        if (!category) {
          errors.push(`Row ${rn}: Unknown category "${categoryName}" — it must match an existing category name exactly`);
          continue;
        }
        // Derived from category *and* price — apparel crosses a rate band at
        // ₹1,000 per piece, so the rate cannot come from the category alone.
        const gstRate = gstRateFor(category.slug, price);

        // Process images. Every image is resolved by *name* — either the names
        // listed in the Images column, or failing that the `<product-code>-<nn>`
        // convention. Nothing is ever matched positionally, which is what used
        // to land one product's photos on another.
        const listedNames = imagesCell
          ? imagesCell.split(',').map(f => f.trim()).filter(Boolean)
          : this.imagesForCodeByConvention(productCode, imageMap);

        if (imagesCell && listedNames.length === 0) {
          errors.push(`Row ${rn}: Images column could not be parsed`);
        }

        const productImages: string[] = [];
        for (const filename of listedNames) {
          if (filename.startsWith('http://') || filename.startsWith('https://')) {
            productImages.push(filename);
            continue;
          }
          const resolved = this.resolveImageEntry(filename, imageMap);
          if (!resolved) {
            errors.push(`Row ${rn}: Image "${filename}" is not in the ZIP`);
            continue;
          }
          if (dryRun) {
            productImages.push(resolved.filename);
            continue;
          }
          try {
            productImages.push(await this.saveUploadedImage(resolved.file, resolvedVendorId));
          } catch (e) {
            errors.push(`Row ${rn}: Failed to upload image "${filename}": ${e.message}`);
          }
        }

        // Parse attributes column: "Color: Red, Size: M" → { color: "red", size: "m" }
        const attributesCell = g('Attributes')?.trim() || '';
        const parsedAttributes: Record<string, string> = {};
        if (attributesCell) {
          attributesCell.split(',').forEach(a => {
            const colonIdx = a.indexOf(':');
            if (colonIdx > 0) {
              const k = a.substring(0, colonIdx).trim();
              const v = a.substring(colonIdx + 1).trim();
              if (k && v) {
                const slugKey = k.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                const slugVal = v.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                parsedAttributes[slugKey] = slugVal;
              }
            }
          });
        }

        // Track per-category attribute values for auto-adding to filter config
        if (category && Object.keys(parsedAttributes).length > 0) {
          if (!simpleCategoryAttrs.has(category.id)) {
            simpleCategoryAttrs.set(category.id, new Map());
          }
          const catAttrs = simpleCategoryAttrs.get(category.id)!;
          Object.entries(parsedAttributes).forEach(([k, v]) => {
            if (!catAttrs.has(k)) catAttrs.set(k, new Set());
            catAttrs.get(k)!.add(v);
          });
        }

        const productData: any = {
          name,
          description,
          price,
          compareAtPrice: compareAtPrice || null,
          stockQuantity,
          sku: productCode || `${resolvedVendorId.substring(0, 8)}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          status: 'active',
          productType: 'physical',
          vendorId: resolvedVendorId,
          gstRate,
          images: productImages.length > 0 ? productImages : null,
          featuredImage: productImages.length > 0 ? productImages[0] : null,
          ...(Object.keys(parsedAttributes).length > 0 ? { attributes: parsedAttributes } : {}),
        };

        // Two rows resolving to the same product silently overwrite each other,
        // images included — that is issue 2's "images on the wrong product".
        // Reject the second row instead.
        const rowKey = this.normalizeCode(productCode) || `name:${name.trim().toLowerCase()}`;
        if (seenRowKeys.has(rowKey)) {
          errors.push(
            `Row ${rn}: duplicate ${productCode ? `Product Code "${productCode}"` : `Product Name "${name}"`} ` +
            `— already used by row ${seenRowKeys.get(rowKey)}`,
          );
          continue;
        }
        seenRowKeys.set(rowKey, rn);

        // Upsert by Product Code when the row has one — the code is the stable
        // key, so an unrecognised code means "new product", full stop.
        //
        // Falling through to a name match here is what put images on the wrong
        // product: a catalogue where several rows share a name ("Co-ord set")
        // but carry distinct codes had every row after the first resolve to the
        // *first* row's product and overwrite it. Only codeless rows, which the
        // template documents as name-matched, may match by name.
        const existing: Product | null = productCode
          ? await this.findProductBySku(productCode)
          : (await this.productsRepository.findOne({
              where: { name, vendorId: resolvedVendorId },
              relations: ['categories'],
            })) ?? null;

        if (dryRun) {
          if (existing && vendorId && existing.vendorId !== resolvedVendorId) {
            errors.push(`Row ${rn}: Product "${name}" belongs to a different vendor`);
          } else if (existing) {
            updated++;
          } else {
            created++;
          }
          // Give variants something to resolve against without touching the DB.
          productCodeToId.set(rowKey, existing?.id ?? `dry-run:${rowKey}`);
          continue;
        }

        if (existing) {
          if (!vendorId || existing.vendorId === resolvedVendorId) {
            // Apply all updates directly to the loaded entity, then single .save()
            existing.name = name;
            existing.description = description;
            existing.price = price;
            existing.compareAtPrice = compareAtPrice || (0 as any);
            existing.stockQuantity = stockQuantity;
            existing.gstRate = gstRate;
            if (productImages.length > 0) {
              existing.images = productImages;
              existing.featuredImage = productImages[0];
            }
            // Merge attributes: preserve existing (e.g. booking/tour) and layer in new ones
            if (Object.keys(parsedAttributes).length > 0) {
              existing.attributes = { ...(existing.attributes || {}), ...parsedAttributes };
            }
            if (category) {
              existing.categories = [category];
            }
            await this.productsRepository.save(existing);
            updated++;
            productCodeToId.set(rowKey, existing.id);
            console.log(`[SimpleImport] Updated "${name}" (id: ${existing.id}), attributes: ${JSON.stringify(existing.attributes)}`);
          } else {
            errors.push(`Row ${rn}: Product "${name}" belongs to a different vendor`);
          }
        } else {
          // New product — generate unique slug
          let baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
          let slug = baseSlug, slugCounter = 1;
          while (await this.productsRepository.findOne({ where: { slug } })) {
            slug = `${baseSlug}-${slugCounter++}`;
          }
          productData.slug = slug;
          if (category) productData.categories = [category];

          const savedRaw = await this.productsRepository.save(this.productsRepository.create(productData));
          const saved = Array.isArray(savedRaw) ? savedRaw[0] : savedRaw;
          created++;
          productCodeToId.set(rowKey, saved.id);
          console.log(`[SimpleImport] Created "${name}" (id: ${saved.id})`);
        }
      } catch (err) {
        errors.push(`Products Row ${rn}: ${err.message}`);
      }
    }

    // Auto-register imported attributes to category filter configs
    for (const [categoryId, attrMap] of (dryRun ? [] : simpleCategoryAttrs)) {
      try {
        const cat = await this.categoriesRepository.findOne({ where: { id: categoryId } });
        if (!cat) continue;

        if (!cat.filterConfig) cat.filterConfig = { filters: [] };
        if (!cat.filterConfig.filters) cat.filterConfig.filters = [];

        let catUpdated = false;
        for (const [attrKey, values] of attrMap) {
          const attrId = attrKey.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          let existingFilter = cat.filterConfig.filters.find((f: any) => f.id === attrId);

          if (!existingFilter) {
            existingFilter = { id: attrId, label: attrKey, type: 'select', options: [] };
            cat.filterConfig.filters.push(existingFilter);
            catUpdated = true;
            console.log(`[SimpleImport] Created filter "${attrKey}" for category ${cat.name}`);
          }

          for (const val of values) {
            const valueSlug = val.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            const exists = existingFilter.options?.some((o: any) => o.value === valueSlug);
            if (!exists) {
              if (!existingFilter.options) existingFilter.options = [];
              existingFilter.options.push({ value: valueSlug, label: val });
              catUpdated = true;
              console.log(`[SimpleImport] Added option "${val}" to filter "${attrKey}" in category ${cat.name}`);
            }
          }
        }

        if (catUpdated) {
          await this.categoriesRepository.save(cat);
        }
      } catch (err) {
        console.error(`[SimpleImport] Error auto-registering attributes for category ${categoryId}:`, err.message);
      }
    }

    // ── Variants sheet ────────────────────────────────────────────────────────
    const variantSheet = workbook.getWorksheet('Variants');
    if (variantSheet) {
      const variantHeaders = buildHeaderMap(variantSheet);

      const variantRows: Array<{ row: ExcelJS.Row; rn: number }> = [];
      variantSheet.eachRow((row, rn) => { if (rn > 1) variantRows.push({ row, rn }); });

      for (const { row, rn } of variantRows) {
        try {
          const g = (h: string) => getVal(row, variantHeaders, h);

          const productCode  = g('Product Code')?.trim();
          const variantCode  = g('Variant Code')?.trim();
          const attributesStr = g('Attributes')?.trim() || '';
          const price         = parseFloat(g('Price') || '0') || 0;
          const compareAtPrice = parseFloat(g('Compare At Price') || '0') || null;
          const stock          = parseInt(g('Stock') || '0') || 0;
          const isActive       = (g('Active')?.trim().toUpperCase() ?? 'YES') !== 'NO';

          if (!productCode || !variantCode) {
            errors.push(`Variants Row ${rn}: Missing Product Code or Variant Code`);
            continue;
          }

          // Resolve against this run's products first, then fall back to the
          // database. A variant whose product row was skipped, errored, or
          // simply left out of this upload still has a product to attach to —
          // requiring the product to be in *this* sheet was the cause of the
          // "No product found with code" errors.
          let productId = productCodeToId.get(this.normalizeCode(productCode));
          if (!productId) {
            const existingProduct = await this.findProductBySku(productCode);
            if (existingProduct) {
              productId = existingProduct.id;
              productCodeToId.set(this.normalizeCode(productCode), productId);
            }
          }
          if (!productId) {
            errors.push(
              `Variants Row ${rn}: No product found with code "${productCode}". ` +
              `Add a row with that Product Code to the Products sheet, or check for a typo.`,
            );
            continue;
          }

          if (dryRun) continue;

          // Parse "Size: M, Color: Red" → { Size: 'M', Color: 'Red' }
          const variantAttributes: Record<string, string> = {};
          attributesStr.split(',').forEach(a => {
            const colonIdx = a.indexOf(':');
            if (colonIdx > 0) {
              const k = a.substring(0, colonIdx).trim();
              const v = a.substring(colonIdx + 1).trim();
              if (k && v) variantAttributes[k] = v;
            }
          });

          const variantData: any = {
            productId,
            sku: variantCode,
            variantAttributes,
            price,
            stockQuantity: stock,
            isActive,
          };
          if (compareAtPrice) variantData.compareAtPrice = compareAtPrice;

          // Upsert by variant sku
          const existingVariant = await this.productVariantsRepository.findOne({
            where: { sku: variantCode },
          }) ?? null;

          if (existingVariant) {
            await this.productVariantsRepository.update(existingVariant.id, variantData);
            console.log(`[SimpleImport] Updated variant "${variantCode}"`);
          } else {
            await this.productVariantsRepository.save(
              this.productVariantsRepository.create(variantData),
            );
            await this.productsRepository.update(productId, { hasVariants: true });
            console.log(`[SimpleImport] Created variant "${variantCode}"`);
          }
        } catch (err) {
          errors.push(`Variants Row ${rn}: ${err.message}`);
        }
      }

    }

    // Roll up variant stocks to the parent product so it is never shown as sold out
    for (const [, productId] of (dryRun ? [] : productCodeToId)) {
      const product = await this.productsRepository.findOne({ where: { id: productId } });
      if (product?.hasVariants) {
        const variants = await this.productVariantsRepository.find({ where: { productId } });
        const totalStock = variants.reduce((sum, v) => sum + (v.stockQuantity || 0), 0);
        await this.productsRepository.update(productId, { stockQuantity: totalStock });
        console.log(`[SimpleImport] Updated product "${product.name}" stock to ${totalStock}`);
      }
    }

    return { created, updated, errors, dryRun };
  }

  /** Generate a simple template ZIP — one Kurtis product (with size variants) and one Jewellery product */
  async generateSimpleTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();

    const addDropdown = (sheet: ExcelJS.Worksheet, colIdx: number, maxRow: number, formula: string) => {
      for (let row = 2; row <= maxRow; row++) {
        sheet.getCell(row, colIdx).dataValidation = {
          type: 'list', allowBlank: false, formulae: [formula],
        };
      }
    };

    // ── Products sheet ────────────────────────────────────────────────────────
    const productSheet = workbook.addWorksheet('Products');
    productSheet.columns = this.getSimpleProductColumns();
    this.styleHeaderRow(productSheet, 'FF2E86C1');

    // Add data rows FIRST, then apply dropdowns (addRow positions after last touched row)
    productSheet.addRow({
      productCode: 'KUR-001', name: 'Chanderi Silk Anarkali Kurti',
      category: 'Kurtis', price: 3499, compareAtPrice: 4299,
      stockQuantity: 0,
      images: 'anarkali-front.jpg, anarkali-back.jpg',
      description: 'A floor-length anarkali in handwoven chanderi silk, with fine gota detailing at the neckline.',
      attributes: 'Fabric: Chanderi, Colour: Rose, Sleeve: Three-Quarter, Occasion: Festive',
    });
    productSheet.addRow({
      productCode: 'JWL-001', name: 'Kundan Jhumka Earrings',
      category: 'Jewellery', price: 899, compareAtPrice: 1199,
      stockQuantity: 50,
      images: 'jhumka.jpg',
      description: 'Classic dome jhumkas set with kundan stones and finished with pearl drops.',
      attributes: 'Type: Earrings, Finish: Gold-tone, Stone: Kundan, Occasion: Wedding',
    });

    // ── Variants sheet ────────────────────────────────────────
    const variantSheet = workbook.addWorksheet('Variants');
    variantSheet.columns = this.getSimpleVariantColumns();
    this.styleHeaderRow(variantSheet, 'FF8E44AD');

    const sizes = ['S', 'M', 'L', 'XL'];
    sizes.forEach(size => {
      variantSheet.addRow({
        productCode: 'KUR-001',
        variantCode: `KUR-001-${size}`,
        attributes:  `Size: ${size}`,
        price:          size === 'XL' ? 3699 : 3499,
        compareAtPrice: 4299,
        stock:          Math.floor(Math.random() * 15) + 3,
        isActive:       'YES',
      });
    });
    addDropdown(variantSheet, 7, sizes.length + 1, '"YES,NO"');

    // ── Instructions sheet ────────────────────────────────────────
    const instr = workbook.addWorksheet('Instructions');
    instr.getColumn(1).width = 100;
    const b = (r: number, t: string) => { instr.getCell(`A${r}`).value = t; instr.getCell(`A${r}`).font = { bold: true, size: 12 }; };
    const n = (r: number, t: string) => { instr.getCell(`A${r}`).value = t; };

    b(1,  '📋  PRODUCT IMPORT — QUICK START GUIDE');
    n(3,  'There are 2 sheets:');
    n(4,  '  • Products   — one row per product');
    n(5,  '  • Variants   — one row per size combination (only needed for products with sizes)');
    b(7,  'CATEGORY — must match exactly');
    n(8,  '  Enter exactly "Kurtis" or "Jewellery". Any other value is rejected as an error —');
    n(9,  '  it will NOT create a new category.');
    b(11, 'PRODUCT CODE — your own short ID (optional)');
    n(12, '  Enter any value you like:  1   2   3   or   KUR-001   JWL-002');
    n(13, '  This code is the stable key.  Re-import the same file → existing products are UPDATED, not duplicated.');
    n(14, '  Leave it blank and the product is matched by name instead.');
    n(15, '  The Product Code in the Variants sheet must match exactly to link variants to their product.');
    b(17, 'EVERYDAY WORKFLOW');
    n(18, '  1. First time: fill in the two sheets, zip with images folder, import.');
    n(19, '  2. Stock changed → edit the Stock cell(s), re-import.  Done.');
    n(20, '  3. New product → add a new row with a new Product Code, re-import.');
    n(21, '  4. Price update → edit Price cell, re-import.');
    b(23, 'IMAGES');
    n(24, '  • Images column: comma-separated filenames, e.g.   front.jpg, back.jpg, side.jpg');
    n(25, '  • Put the actual files in the  images/  folder inside the ZIP before importing.');
    n(26, '  • You can also paste a full https:// URL — it will be used without uploading.');
    b(28, 'VARIANTS');
    n(29, '  • Attributes format:   Size: M   (key: value, comma-separated for more than one)');
    n(30, '  • Variant Code must be unique across ALL variants.  Recommended pattern: PRODCODE-SIZE');
    n(31, '  • For products WITHOUT variants: leave their rows out of the Variants sheet; enter stock on Products sheet.');
    b(33, 'ATTRIBUTES — powers the storefront filters');
    n(34, '  • Kurtis:     Fabric, Colour, Size, Sleeve, Occasion');
    n(35, '  • Jewellery:  Type, Finish, Stone, Occasion');
    n(36, '  • Format:   Fabric: Chanderi, Colour: Rose, Occasion: Festive   (key: value, comma-separated)');

    // ── Build ZIP with dummy images ───────────────────────────────────────────
    const excelBuffer = await workbook.xlsx.writeBuffer();

    const createPng = (r: number, g: number, b: number): Buffer => {
      const crc32 = (d: Buffer): number => {
        let crc = 0xFFFFFFFF;
        for (let i = 0; i < d.length; i++) {
          crc ^= d[i];
          for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
        }
        return crc ^ 0xFFFFFFFF;
      };
      const ihdr = Buffer.from([0x49,0x48,0x44,0x52,0,0,0,1,0,0,0,1,8,2,0,0,0]);
      const idat = Buffer.concat([Buffer.from([0x49,0x44,0x41,0x54]),
        require('zlib').deflateSync(Buffer.from([0, r, g, b]))]);
      const iend = Buffer.from([0x49,0x45,0x4E,0x44]);
      const u4   = (n: number) => Buffer.from([(n>>>24)&0xFF,(n>>>16)&0xFF,(n>>>8)&0xFF,n&0xFF]);
      return Buffer.concat([
        Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]),
        u4(13), ihdr, u4(crc32(ihdr)),
        u4(idat.length - 4), idat, u4(crc32(idat)),
        u4(0), iend, u4(crc32(iend)),
      ]);
    };

    return new Promise<Buffer>((resolve, reject) => {
      const archive = archiver('zip', { zlib: { level: 9 } });
      const chunks: Buffer[] = [];
      archive.on('data', c => chunks.push(c));
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', reject);

      archive.append(Buffer.from(excelBuffer as ArrayBuffer), { name: 'products.xlsx' });
      archive.append(createPng(214, 176, 176), { name: 'images/anarkali-front.jpg' });
      archive.append(createPng(200, 160, 160), { name: 'images/anarkali-back.jpg' });
      archive.append(createPng(212, 175, 55),  { name: 'images/jhumka.jpg' });
      archive.append(
        Buffer.from('Replace these placeholder images with your real product photos.\nFormat: JPG, PNG or WebP | Recommended: 1200×800 px or larger\n'),
        { name: 'images/README.txt' },
      );
      archive.finalize();
    });
  }
}
