import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { Product } from './product.entity';
import { ProductVariant } from './product-variant.entity';
import { Category } from '../categories/category.entity';
import { Vendor } from '../vendors/vendor.entity';
import { User, UserRole } from '../users/user.entity';
import { HsnCode } from './hsn-code.entity';
import { CloudinaryService } from '../../common/services/cloudinary.service';
import * as fs from 'fs';
import * as path from 'path';
import archiver from 'archiver';
import AdmZip from 'adm-zip';

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
    @InjectRepository(HsnCode)
    private hsnCodeRepository: Repository<HsnCode>,
    private cloudinaryService: CloudinaryService,
  ) {}

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
   * Helper method to get recommended GST rate from HSN/SAC code
   */
  private async getGstRateFromHsnCode(hsnOrSacCode: string): Promise<number | null> {
    if (!hsnOrSacCode) return null;
    
    try {
      const hsnCode = await this.hsnCodeRepository.findOne({
        where: { code: hsnOrSacCode, isActive: true },
      });
      return hsnCode?.recommendedGstRate || null;
    } catch (error) {
      console.error(`Error looking up HSN/SAC code ${hsnOrSacCode}:`, error);
      return null;
    }
  }

  /**
   * Helper method to format HSN code with description for display
   */
  private async formatHsnCodeWithDescription(code: string): Promise<string> {
    if (!code) return '';
    
    try {
      const hsnCode = await this.hsnCodeRepository.findOne({
        where: { code, isActive: true },
      });
      
      if (hsnCode) {
        const shortDesc = hsnCode.description.substring(0, 30);
        return `${code} - ${shortDesc}${hsnCode.description.length > 30 ? '...' : ''}`;
      }
      return code; // Return just code if no description found
    } catch (error) {
      return code; // Return just code on error
    }
  }

  /**
   * Get standard product column definitions (with optional category filters)
   */
  private getProductColumns(categoryFilters: any[] = []): any[] {
    const columns: any[] = [
      { header: 'ID', key: '_id', width: 36 },
      { header: 'Product Name', key: 'name', width: 30 },
      { header: 'Description', key: 'description', width: 50 },
      { header: 'Images (comma-separated filenames)', key: 'images', width: 40 },
      { header: 'Has Variants', key: 'hasVariants', width: 12 },
      { header: 'Price', key: 'price', width: 12 },
      { header: 'Compare At Price (Optional)', key: 'compareAtPrice', width: 18 },
      { header: 'Stock Quantity', key: 'stockQuantity', width: 15 },
      { header: 'Status (active/draft/archived)', key: 'status', width: 25 },
      { header: 'Variant Count', key: 'variantCount', width: 12 },
      { header: 'HSN Code', key: 'hsnCode', width: 15 },
      { header: 'SAC Code', key: 'sacCode', width: 15 },
      { header: 'GST Rate (%)', key: 'gstRate', width: 12 },
      { header: 'Price Type', key: 'priceType', width: 25 },
      { header: 'Product Type', key: 'productType', width: 15 },
      { header: 'Booking Duration', key: 'bookingDuration', width: 15 },
      { header: 'Booking Duration Unit', key: 'bookingDurationUnit', width: 20 },
      { header: 'Booking Buffer Time', key: 'bookingBufferTime', width: 18 },
      { header: 'Booking Available Days', key: 'bookingAvailableDays', width: 35 },
      { header: 'Booking Time Slots', key: 'bookingTimeSlots', width: 30 },
      { header: 'MRP', key: 'mrp', width: 12 },
      { header: 'Base Price', key: 'basePrice', width: 12 },
      { header: 'GST Amount', key: 'gstAmount', width: 12 },
      { header: 'Cost Per Item', key: 'costPerItem', width: 12 },
    ];

    // Add category-specific attribute columns
    categoryFilters.forEach(filter => {
      columns.push({
        header: filter.label,
        key: `attr_${filter.id}`,
        width: 20,
      });
    });

    return columns;
  }

  /**
   * Get variant column definitions
   */
  private getVariantColumns(): any[] {
    return [
      { header: 'Variant ID', key: '_variantId', width: 36 },
      { header: 'Product ID', key: '_productId', width: 36 },
      { header: 'Product Name', key: 'productName', width: 30 },
      { header: 'SKU', key: 'sku', width: 30 },
      { header: 'Variant Attributes', key: 'attributes', width: 40 },
      { header: 'Price', key: 'price', width: 12 },
      { header: 'Compare At Price', key: 'compareAtPrice', width: 18 },
      { header: 'Stock', key: 'stock', width: 12 },
      { header: 'Active', key: 'isActive', width: 10 },
    ];
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

  /**
   * Apply data validation rules to product sheet
   */
  private applyProductDataValidation(
    sheet: ExcelJS.Worksheet,
    columns: any[],
    dataRowStart: number,
    dataRowEnd: number,
    allHsnCodes: HsnCode[]
  ): void {
    // GST Rate dropdown (0, 5, 12, 18, 28)
    const gstRateColumn = columns.findIndex(c => c.key === 'gstRate') + 1;
    if (gstRateColumn > 0) {
      for (let row = dataRowStart; row <= dataRowEnd + 100; row++) {
        sheet.getCell(row, gstRateColumn).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['"0,5,12,18,28"'],
          showErrorMessage: true,
          errorTitle: 'Invalid GST Rate',
          error: 'Please select a valid GST rate: 0, 5, 12, 18, or 28',
        };
      }
    }

    // Price Type dropdown
    const priceTypeColumn = columns.findIndex(c => c.key === 'priceType') + 1;
    if (priceTypeColumn > 0) {
      for (let row = dataRowStart; row <= dataRowEnd + 100; row++) {
        sheet.getCell(row, priceTypeColumn).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['"mrp_with_gst,selling_price_without_gst"'],
          showErrorMessage: true,
          errorTitle: 'Invalid Price Type',
          error: 'Please select: mrp_with_gst or selling_price_without_gst',
        };
      }
    }

    // Product Type dropdown
    const productTypeColumn = columns.findIndex(c => c.key === 'productType') + 1;
    if (productTypeColumn > 0) {
      for (let row = dataRowStart; row <= dataRowEnd + 100; row++) {
        sheet.getCell(row, productTypeColumn).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['"physical,digital,booking"'],
          showErrorMessage: true,
          errorTitle: 'Invalid Product Type',
          error: 'Please select: physical, digital, or booking',
        };
      }
    }

    // Status dropdown
    const statusColumn = columns.findIndex(c => c.key === 'status') + 1;
    if (statusColumn > 0) {
      for (let row = dataRowStart; row <= dataRowEnd + 100; row++) {
        sheet.getCell(row, statusColumn).dataValidation = {
          type: 'list',
          allowBlank: false,
          formulae: ['"active,draft,archived"'],
          showErrorMessage: true,
          errorTitle: 'Invalid Status',
          error: 'Please select: active, draft, or archived',
        };
      }
    }

    // Has Variants dropdown
    const hasVariantsColumn = columns.findIndex(c => c.key === 'hasVariants') + 1;
    if (hasVariantsColumn > 0) {
      for (let row = dataRowStart; row <= dataRowEnd + 100; row++) {
        sheet.getCell(row, hasVariantsColumn).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['"YES,NO"'],
          showErrorMessage: true,
          errorTitle: 'Invalid Value',
          error: 'Please select: YES or NO',
        };
      }
    }

    // Common HSN Codes dropdown - reference the HSN-SAC Reference sheet
    const hsnCodeColumn = columns.findIndex(c => c.key === 'hsnCode') + 1;
    if (hsnCodeColumn > 0 && allHsnCodes.length > 0) {
      for (let row = dataRowStart; row <= dataRowEnd + 100; row++) {
        sheet.getCell(row, hsnCodeColumn).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`='HSN-SAC Reference'!$A$2:$A$${allHsnCodes.length + 1}`],
          showInputMessage: true,
          promptTitle: 'HSN Code',
          prompt: 'Select from HSN-SAC Reference sheet or enter custom code',
        };
      }
    }

    // Common SAC Codes dropdown - reference the HSN-SAC Reference sheet
    const sacCodeColumn = columns.findIndex(c => c.key === 'sacCode') + 1;
    if (sacCodeColumn > 0 && allHsnCodes.length > 0) {
      for (let row = dataRowStart; row <= dataRowEnd + 100; row++) {
        sheet.getCell(row, sacCodeColumn).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`='HSN-SAC Reference'!$A$2:$A$${allHsnCodes.length + 1}`],
          showInputMessage: true,
          promptTitle: 'SAC Code',
          prompt: 'Select from HSN-SAC Reference sheet or enter custom code',
        };
      }
    }
  }

  /**
   * Apply data validation rules to variants sheet
   */
  private applyVariantDataValidation(
    sheet: ExcelJS.Worksheet,
    variantCount: number
  ): void {
    const variantDataRowStart = 2;
    const variantDataRowEnd = variantCount + 1;

    // Active status dropdown for variants
    const activeColumn = sheet.columns.findIndex(c => c.key === 'isActive') + 1;
    if (activeColumn > 0) {
      for (let row = variantDataRowStart; row <= variantDataRowEnd + 50; row++) {
        sheet.getCell(row, activeColumn).dataValidation = {
          type: 'list',
          allowBlank: false,
          formulae: ['"YES,NO"'],
          showErrorMessage: true,
          errorTitle: 'Invalid Value',
          error: 'Please select: YES or NO',
        };
      }
    }
  }

  /**
   * Create HSN-SAC Reference sheet
   */
  private async createHsnSacReferenceSheet(
    workbook: ExcelJS.Workbook,
    allHsnCodes: HsnCode[]
  ): Promise<void> {
    const hsnRefSheet = workbook.addWorksheet('HSN-SAC Reference');
    
    hsnRefSheet.columns = [
      { header: 'Code with Description', key: 'codeWithDesc', width: 50 },
      { header: 'Full Description', key: 'description', width: 60 },
      { header: 'GST Rate (%)', key: 'gstRate', width: 12 },
      { header: 'Type', key: 'type', width: 10 },
    ];
    
    this.styleHeaderRow(hsnRefSheet, 'FF2E7D32');
    
    allHsnCodes.forEach(hsn => {
      const type = hsn.code.length === 6 ? 'SAC' : 'HSN';
      const shortDesc = hsn.description.substring(0, 50);
      const codeWithDesc = `${hsn.code} - ${shortDesc}${hsn.description.length > 50 ? '...' : ''}`;
      
      hsnRefSheet.addRow({
        codeWithDesc: codeWithDesc,
        description: hsn.description,
        gstRate: hsn.recommendedGstRate,
        type: type,
      });
    });
  }

  async exportToExcel(vendorId: string | null): Promise<Buffer> {
    try {
      console.log('🚀🚀🚀 ===========================================');
      console.log('🚀 NEW CODE VERSION - EXCEL EXPORT STARTING');
      console.log('🚀 Vendor ID:', vendorId || 'ALL');
      console.log('🚀 Timestamp:', new Date().toISOString());
      console.log('🚀🚀🚀 ===========================================');
      console.log('Starting Excel export for vendor:', vendorId || 'ALL');
      const workbook = new ExcelJS.Workbook();
      
      // Get products with categories, vendor, and variants
      console.log('Fetching products...');
      const whereCondition = vendorId ? { vendorId } : {};
      const products = await this.productsRepository.find({
        where: whereCondition,
        relations: ['categories', 'vendor', 'productVariants'],
      });

      console.log(`Found ${products.length} products${vendorId ? ` for vendor ${vendorId}` : ' (all vendors)'}`);
      
      const productsWithVariants = products.filter(p => p.hasVariants && p.productVariants?.length > 0);
      console.log(`${productsWithVariants.length} products have variants`);

      // Get all categories with their filter configurations
      console.log('Fetching categories...');
      const categories = await this.categoriesRepository.find({
        where: { isActive: true },
      });
      console.log(`Found ${categories.length} categories`);

      // Get all HSN codes for reference sheet (no limit)
      console.log('Fetching all HSN/SAC codes...');
      const allHsnCodes = await this.hsnCodeRepository.find({
        where: { isActive: true },
        order: { code: 'ASC' },
      });
      console.log(`Found ${allHsnCodes.length} HSN/SAC codes for reference sheet`);

      // Group products by their primary category
      const productsByCategory = new Map<string, Product[]>();
      const uncategorizedProducts: Product[] = [];

      products.forEach(product => {
        if (product.categories && product.categories.length > 0) {
          // Use the first category as primary
          const primaryCategory = product.categories[0];
          if (!productsByCategory.has(primaryCategory.id)) {
            productsByCategory.set(primaryCategory.id, []);
          }
          productsByCategory.get(primaryCategory.id)!.push(product);
        } else {
          // All products without categories go to uncategorized
          uncategorizedProducts.push(product);
        }
      });

      console.log(`Products grouped into ${productsByCategory.size} categories`);
      console.log(`${uncategorizedProducts.length} uncategorized products`);

      // Create a sheet for each category with products
      for (const [categoryId, categoryProducts] of productsByCategory.entries()) {
        const category = categories.find(c => c.id === categoryId);
        if (!category) {
          console.log(`Warning: Category ${categoryId} not found (may be inactive). Adding ${categoryProducts.length} products to uncategorized.`);
          uncategorizedProducts.push(...categoryProducts);
          continue;
        }

        const sheetName = category.name.substring(0, 30); // Excel sheet name limit
        const sheet = workbook.addWorksheet(sheetName);

        // Get category-specific filters
        const categoryFilters = category.filterConfig?.filters?.filter(f => f.id !== 'priceRange') || [];

        // Build columns using helper
        console.log(`🔧 Building columns for category: ${category.name}`);
        const columns = this.getProductColumns(categoryFilters);

        console.log(`✅ Setting ${columns.length} columns for sheet "${category.name}"`);
        console.log(`✅ First 3 columns:`, JSON.stringify(columns.slice(0, 3), null, 2));
        sheet.columns = columns;
        console.log(`✅ Sheet columns set successfully for "${category.name}"`);
        console.log(`📋 Verification - Sheet "${category.name}" column count: ${sheet.columns.length}`);
        console.log(`📋 First column header: ${sheet.getColumn(1).header}, key: ${sheet.getColumn(1).key}, width: ${sheet.getColumn(1).width}`);
        console.log(`📋 Second column header: ${sheet.getColumn(2).header}, key: ${sheet.getColumn(2).key}`);
        console.log(`📋 Third column header: ${sheet.getColumn(3).header}, key: ${sheet.getColumn(3).key}`);

        // Style header row using helper
        this.styleHeaderRow(sheet, 'FF4472C4');

        // Add products data
        for (const product of categoryProducts) {
          // Handle images: collect from both images array AND featuredImage
          let imagesList = '';
          const allImages: string[] = [];
          
          // Add images from the images array
          if (product.images && Array.isArray(product.images) && product.images.length > 0) {
            allImages.push(...product.images.filter(img => img));
          }
          
          // Add featuredImage if it exists and isn't already in the array
          if (product.featuredImage && !allImages.includes(product.featuredImage)) {
            allImages.unshift(product.featuredImage); // Add to beginning as it's the featured one
          }
          
          // Process all collected images
          if (allImages.length > 0) {
            imagesList = allImages.map(img => {
              if (!img) return null;
              // If it's an external URL (http/https), keep the full URL
              if (img.startsWith('http://') || img.startsWith('https://')) {
                return img;
              }
              // For local paths, just use the filename
              return path.basename(img);
            }).filter(img => img !== null).join(', ');
            
            console.log(`Product "${product.name}" (Vendor: ${product.vendor?.storeName || 'N/A'}) - ${allImages.length} images: ${imagesList}`);
          } else {
            console.log(`Product "${product.name}" (Vendor: ${product.vendor?.storeName || 'N/A'}) - NO IMAGES`);
          }

          // Handle variant products
          const hasVariants = product.hasVariants && product.productVariants?.length > 0;
          let displayPrice: number | string = product.price;
          let displayStock = product.stockQuantity;
          let variantCount = 0;

          if (hasVariants) {
            variantCount = product.productVariants.length;
            // For variant products, show price range
            const prices = product.productVariants.map(v => parseFloat(v.price.toString()));
            const minPrice = Math.min(...prices);
            const maxPrice = Math.max(...prices);
            displayPrice = minPrice === maxPrice ? minPrice : `${minPrice} - ${maxPrice}`;
            
            // Sum up all variant stock
            displayStock = product.productVariants.reduce((sum, v) => sum + v.stockQuantity, 0);
            
            console.log(`  → Variant product with ${variantCount} variants, price range: ${displayPrice}, total stock: ${displayStock}`);
          }

          // Format HSN/SAC code with description if available
          let hsnCodeDisplay = product.hsnCode || '';
          if (hsnCodeDisplay) {
            hsnCodeDisplay = await this.formatHsnCodeWithDescription(hsnCodeDisplay);
          }
          
          let sacCodeDisplay = product.sacCode || '';
          if (sacCodeDisplay) {
            sacCodeDisplay = await this.formatHsnCodeWithDescription(sacCodeDisplay);
          }

          const rowData: any = {
            name: product.name,
            description: product.description || '',
            images: imagesList,
            hasVariants: hasVariants ? 'YES' : 'NO',
            price: displayPrice,
            compareAtPrice: product.compareAtPrice || '',
            stockQuantity: displayStock,
            status: product.status,
            variantCount: hasVariants ? variantCount : '',
            hsnCode: hsnCodeDisplay,
            sacCode: sacCodeDisplay,
            gstRate: product.gstRate || '', // Will be auto-filled below if empty
            priceType: product.priceType || '',
            productType: product.productType || 'physical',
            bookingDuration: '',
            bookingDurationUnit: '',
            bookingBufferTime: '',
            bookingAvailableDays: '',
            bookingTimeSlots: '',
            mrp: product.mrp || '',
            basePrice: product.basePrice || '',
            gstAmount: product.gstAmount || '',
            costPerItem: product.costPerItem || '',
            _id: product.id, // Hidden ID for updates
          };

          // Add booking attributes if this is a booking product
          if (product.productType === 'booking' && product.attributes?.booking) {
            const booking = product.attributes.booking;
            rowData.bookingDuration = booking.duration || '';
            rowData.bookingDurationUnit = booking.durationUnit || '';
            rowData.bookingBufferTime = booking.bufferTime || '';
            rowData.bookingAvailableDays = Array.isArray(booking.availableDays) 
              ? booking.availableDays.join(',') 
              : '';
            rowData.bookingTimeSlots = Array.isArray(booking.timeSlots)
              ? booking.timeSlots.map(slot => `${slot.start}-${slot.end}`).join(',')
              : '';
            console.log(`  → Exported booking attributes: ${JSON.stringify(booking)}`);
          }

          // Auto-populate GST rate from HSN/SAC code if not already set
          if (!rowData.gstRate && (product.hsnCode || product.sacCode)) {
            const codeToLookup = product.hsnCode || product.sacCode;
            const recommendedRate = await this.getGstRateFromHsnCode(codeToLookup);
            if (recommendedRate !== null) {
              rowData.gstRate = recommendedRate;
              console.log(`  → Auto-filled GST rate ${recommendedRate}% from ${product.hsnCode ? 'HSN' : 'SAC'} code ${codeToLookup}`);
            }
          }

          // Add attribute values
          if (product.attributes) {
            Object.entries(product.attributes).forEach(([key, value]) => {
              if (key !== 'booking') {
                rowData[`attr_${key}`] = value;
              }
            });
          }

          sheet.addRow(rowData);
        }

        // Add data validation using helper
        const dataRowStart = 2; // After header
        const dataRowEnd = categoryProducts.length + 1;
        this.applyProductDataValidation(sheet, columns, dataRowStart, dataRowEnd, allHsnCodes);

        // Add reference data for filter options
        categoryFilters.forEach(filter => {
          if (filter.options && filter.options.length > 0) {
            const filterNote = sheet.addRow({});
            filterNote.getCell(1).value = '';
            
            const noteRow = sheet.addRow({});
            noteRow.getCell(1).value = `${filter.label} options:`;
            noteRow.getCell(1).font = { bold: true, italic: true, color: { argb: 'FF666666' } };
            
            const valuesRow = sheet.addRow({});
            const optionsText = filter.options.map(o => o.label).join(', ');
            valuesRow.getCell(1).value = optionsText;
            valuesRow.getCell(1).font = { italic: true, color: { argb: 'FF666666' } };
          }
        });
      }

      // Create uncategorized products sheet if any
      if (uncategorizedProducts.length > 0) {
        console.log(`🔧 Building columns for Uncategorized sheet`);
        const sheet = workbook.addWorksheet('Uncategorized');

        const columns: any[] = [
          { header: 'ID', key: '_id', width: 36 },
          { header: 'Product Name', key: 'name', width: 30 },
          { header: 'Description', key: 'description', width: 50 },
          { header: 'Images (comma-separated filenames)', key: 'images', width: 40 },
          { header: 'Has Variants', key: 'hasVariants', width: 12 },
          { header: 'Price', key: 'price', width: 12 },
          { header: 'Compare At Price (Optional)', key: 'compareAtPrice', width: 18 },
          { header: 'Stock Quantity', key: 'stockQuantity', width: 15 },
          { header: 'Status (active/draft/archived)', key: 'status', width: 25 },
          { header: 'Variant Count', key: 'variantCount', width: 12 },
          { header: 'HSN Code', key: 'hsnCode', width: 15 },
          { header: 'SAC Code', key: 'sacCode', width: 15 },
          { header: 'GST Rate (%)', key: 'gstRate', width: 12 },
          { header: 'Price Type', key: 'priceType', width: 25 },
          { header: 'MRP', key: 'mrp', width: 12 },
          { header: 'Base Price', key: 'basePrice', width: 12 },
          { header: 'GST Amount', key: 'gstAmount', width: 12 },
          { header: 'Cost Per Item', key: 'costPerItem', width: 12 },
        ];

        console.log(`✅ Setting ${columns.length} columns for Uncategorized sheet`);
        console.log(`✅ First 3 columns:`, JSON.stringify(columns.slice(0, 3), null, 2));
        sheet.columns = columns;
        console.log(`✅ Sheet columns set successfully for Uncategorized`);
        console.log(`📋 Verification - Uncategorized column count: ${sheet.columns.length}`);
        console.log(`📋 First column header: ${sheet.getColumn(1).header}, key: ${sheet.getColumn(1).key}, width: ${sheet.getColumn(1).width}`);
        console.log(`📋 Second column header: ${sheet.getColumn(2).header}, key: ${sheet.getColumn(2).key}`);
        console.log(`📋 Third column header: ${sheet.getColumn(3).header}, key: ${sheet.getColumn(3).key}`);

        sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        sheet.getRow(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFF6B6B' },
        };

        for (const product of uncategorizedProducts) {
          // Handle images: collect from both images array AND featuredImage
          let imagesList = '';
          const allImages: string[] = [];
          
          // Add images from the images array
          if (product.images && Array.isArray(product.images) && product.images.length > 0) {
            allImages.push(...product.images.filter(img => img));
          }
          
          // Add featuredImage if it exists and isn't already in the array
          if (product.featuredImage && !allImages.includes(product.featuredImage)) {
            allImages.unshift(product.featuredImage); // Add to beginning as it's the featured one
          }
          
          // Process all collected images
          if (allImages.length > 0) {
            imagesList = allImages.map(img => {
              if (!img) return null;
              if (img.startsWith('http://') || img.startsWith('https://')) {
                return img;
              }
              return path.basename(img);
            }).filter(img => img !== null).join(', ');
          }
          
          console.log(`Uncategorized: "${product.name}" (Vendor: ${product.vendor?.storeName || 'N/A'}) - Images: ${imagesList || 'NONE'}`);
          
          // Handle variant products
          const hasVariants = product.hasVariants && product.productVariants?.length > 0;
          let displayPrice: number | string = product.price;
          let displayStock = product.stockQuantity;
          let variantCount = 0;

          if (hasVariants) {
            variantCount = product.productVariants.length;
            const prices = product.productVariants.map(v => parseFloat(v.price.toString()));
            const minPrice = Math.min(...prices);
            const maxPrice = Math.max(...prices);
            displayPrice = minPrice === maxPrice ? minPrice : `${minPrice} - ${maxPrice}`;
            displayStock = product.productVariants.reduce((sum, v) => sum + v.stockQuantity, 0);
          }
          
          // Format HSN/SAC code with description if available
          let hsnCodeDisplay = product.hsnCode || '';
          if (hsnCodeDisplay) {
            hsnCodeDisplay = await this.formatHsnCodeWithDescription(hsnCodeDisplay);
          }
          
          let sacCodeDisplay = product.sacCode || '';
          if (sacCodeDisplay) {
            sacCodeDisplay = await this.formatHsnCodeWithDescription(sacCodeDisplay);
          }
          
          const rowData: any = {
            name: product.name,
            description: product.description || '',
            images: imagesList,
            hasVariants: hasVariants ? 'YES' : 'NO',
            price: displayPrice,
            compareAtPrice: product.compareAtPrice || '',
            stockQuantity: displayStock,
            status: product.status,
            variantCount: hasVariants ? variantCount : '',
            hsnCode: hsnCodeDisplay,
            sacCode: sacCodeDisplay,
            gstRate: product.gstRate || '',
            priceType: product.priceType || '',
            mrp: product.mrp || '',
            basePrice: product.basePrice || '',
            gstAmount: product.gstAmount || '',
            costPerItem: product.costPerItem || '',
            _id: product.id,
          };

          // Auto-populate GST rate from HSN/SAC code if not already set
          if (!rowData.gstRate && (product.hsnCode || product.sacCode)) {
            const codeToLookup = product.hsnCode || product.sacCode;
            const recommendedRate = await this.getGstRateFromHsnCode(codeToLookup);
            if (recommendedRate !== null) {
              rowData.gstRate = recommendedRate;
              console.log(`  → Auto-filled GST rate ${recommendedRate}% from ${product.hsnCode ? 'HSN' : 'SAC'} code ${codeToLookup}`);
            }
          }

          sheet.addRow(rowData);
        }

        // Add data validation (dropdowns) to Uncategorized sheet
        const dataRowStart = 2; // After header
        const dataRowEnd = uncategorizedProducts.length + 1;
        
        // GST Rate dropdown
        const gstRateColumn = columns.findIndex(c => c.key === 'gstRate') + 1;
        if (gstRateColumn > 0) {
          for (let row = dataRowStart; row <= dataRowEnd + 100; row++) {
            sheet.getCell(row, gstRateColumn).dataValidation = {
              type: 'list',
              allowBlank: true,
              formulae: ['"0,5,12,18,28"'],
              showErrorMessage: true,
              errorTitle: 'Invalid GST Rate',
              error: 'Please select a valid GST rate: 0, 5, 12, 18, or 28',
            };
          }
        }

        // Price Type dropdown
        const priceTypeColumn = columns.findIndex(c => c.key === 'priceType') + 1;
        if (priceTypeColumn > 0) {
          for (let row = dataRowStart; row <= dataRowEnd + 100; row++) {
            sheet.getCell(row, priceTypeColumn).dataValidation = {
              type: 'list',
              allowBlank: true,
              formulae: ['"mrp_with_gst,selling_price_without_gst"'],
              showErrorMessage: true,
              errorTitle: 'Invalid Price Type',
              error: 'Please select: mrp_with_gst or selling_price_without_gst',
            };
          }
        }

        // Status dropdown
        const statusColumn = columns.findIndex(c => c.key === 'status') + 1;
        if (statusColumn > 0) {
          for (let row = dataRowStart; row <= dataRowEnd + 100; row++) {
            sheet.getCell(row, statusColumn).dataValidation = {
              type: 'list',
              allowBlank: false,
              formulae: ['"active,draft,archived"'],
              showErrorMessage: true,
              errorTitle: 'Invalid Status',
              error: 'Please select: active, draft, or archived',
            };
          }
        }

        // Has Variants dropdown
        const hasVariantsColumn = columns.findIndex(c => c.key === 'hasVariants') + 1;
        if (hasVariantsColumn > 0) {
          for (let row = dataRowStart; row <= dataRowEnd + 100; row++) {
            sheet.getCell(row, hasVariantsColumn).dataValidation = {
              type: 'list',
              allowBlank: true,
              formulae: ['"YES,NO"'],
              showErrorMessage: true,
              errorTitle: 'Invalid Value',
              error: 'Please select: YES or NO',
            };
          }
        }

        // Common HSN Codes dropdown - reference the HSN-SAC Reference sheet
        const hsnCodeColumn = columns.findIndex(c => c.key === 'hsnCode') + 1;
        if (hsnCodeColumn > 0 && allHsnCodes.length > 0) {
          for (let row = dataRowStart; row <= dataRowEnd + 100; row++) {
            sheet.getCell(row, hsnCodeColumn).dataValidation = {
              type: 'list',
              allowBlank: true,
              formulae: [`='HSN-SAC Reference'!$A$2:$A$${allHsnCodes.length + 1}`],
              showInputMessage: true,
              promptTitle: 'HSN Code',
              prompt: 'Select from HSN-SAC Reference sheet or enter custom code',
            };
          }
        }

        // Common SAC Codes dropdown - reference the HSN-SAC Reference sheet
        const sacCodeColumn = columns.findIndex(c => c.key === 'sacCode') + 1;
        if (sacCodeColumn > 0 && allHsnCodes.length > 0) {
          for (let row = dataRowStart; row <= dataRowEnd + 100; row++) {
            sheet.getCell(row, sacCodeColumn).dataValidation = {
              type: 'list',
              allowBlank: true,
              formulae: [`='HSN-SAC Reference'!$A$2:$A$${allHsnCodes.length + 1}`],
              showInputMessage: true,
              promptTitle: 'SAC Code',
              prompt: 'Select from HSN-SAC Reference sheet or enter custom code',
            };
          }
        }
      }

      // Create Product Variants sheet if there are any variant products
      const allVariants: Array<{product: Product; variant: any}> = [];
      products.forEach(product => {
        if (product.hasVariants && product.productVariants?.length > 0) {
          product.productVariants.forEach(variant => {
            allVariants.push({ product, variant });
          });
        }
      });

      if (allVariants.length > 0) {
        console.log(`🔧 Creating Variants sheet with ${allVariants.length} variants...`);
        const variantsSheet = workbook.addWorksheet('Product Variants');
        
        // Use helper for columns
        const variantColumns = this.getVariantColumns();
        console.log(`✅ Setting ${variantColumns.length} columns for Variants sheet`);
        variantsSheet.columns = variantColumns;

        // Use helper for header styling
        this.styleHeaderRow(variantsSheet, 'FF9B59B6'); // Purple for variants

        // Add variant data
        allVariants.forEach(({ product, variant }) => {
          // Filter out standard fields from variant attributes (only keep actual attributes like Size, Color)
          const actualAttributes: Record<string, string> = {};
          if (variant.variantAttributes) {
            Object.entries(variant.variantAttributes).forEach(([key, value]) => {
              const normalizedKey = key.toLowerCase().replace(/\s+/g, '');
              // Exclude standard fields
              if (!['stock', 'active', 'isactive', 'stockquantity', 'price', 'compareatprice', 'sku', 'variantattributes'].includes(normalizedKey)) {
                actualAttributes[key] = String(value);
              }
            });
          }
          
          const attributesStr = Object.entries(actualAttributes)
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ');

          variantsSheet.addRow({
            _variantId: variant.id,
            _productId: product.id,
            productName: product.name,
            sku: variant.sku,
            attributes: attributesStr,
            price: variant.price,
            compareAtPrice: variant.compareAtPrice || '',
            stock: variant.stockQuantity,
            isActive: variant.isActive ? 'YES' : 'NO',
          });
        });

        // Use helper for variant validation
        this.applyVariantDataValidation(variantsSheet, allVariants.length);

        console.log(`Variants sheet created with ${allVariants.length} variants`);
      }

      // Create HSN/SAC Codes Reference sheet using helper
      console.log('Creating HSN/SAC Codes Reference sheet...');
      await this.createHsnSacReferenceSheet(workbook, allHsnCodes);
      
      console.log(`HSN/SAC Reference sheet created with ${allHsnCodes.length} codes`);

      // Create Instructions sheet
      console.log('Creating Instructions sheet...');
      const instructionsSheet = workbook.addWorksheet('Instructions');
      instructionsSheet.getCell('A1').value = 'How to use this Excel file for bulk product management';
      instructionsSheet.getCell('A1').font = { bold: true, size: 14 };
      
      instructionsSheet.getCell('A3').value = 'OVERVIEW:';
      instructionsSheet.getCell('A3').font = { bold: true };
      instructionsSheet.getCell('A4').value = '• Products are organized by category (one sheet per category)';
      instructionsSheet.getCell('A5').value = '• Each sheet shows only the fields relevant to that category';
      instructionsSheet.getCell('A6').value = '• Available filter values are shown at the bottom of each sheet';
      instructionsSheet.getCell('A7').value = '• Many columns have dropdown lists to help you select valid values';
      
      instructionsSheet.getCell('A9').value = 'DROPDOWN HELPERS:';
      instructionsSheet.getCell('A9').font = { bold: true };
      instructionsSheet.getCell('A10').value = '• Status: Select from active, draft, or archived';
      instructionsSheet.getCell('A11').value = '• GST Rate (%): Choose from 0, 5, 12, 18, or 28';
      instructionsSheet.getCell('A12').value = '• Price Type: Select mrp_with_gst or selling_price_without_gst';
      instructionsSheet.getCell('A13').value = '• Has Variants: Choose YES or NO';
      instructionsSheet.getCell('A14').value = '• HSN/SAC Codes: Select from "HSN-SAC Reference" sheet or enter custom';
      instructionsSheet.getCell('A15').value = '• Active (Variants): Choose YES or NO for variant status';
      
      instructionsSheet.getCell('A17').value = 'HSN-SAC REFERENCE SHEET:';
      instructionsSheet.getCell('A17').font = { bold: true };
      instructionsSheet.getCell('A18').value = '• A separate sheet with ALL HSN and SAC codes is included';
      instructionsSheet.getCell('A19').value = '• View the "HSN-SAC Reference" sheet to see codes with descriptions and GST rates';
      instructionsSheet.getCell('A20').value = '• Dropdown shows "code - description" format for easy selection';
      instructionsSheet.getCell('A21').value = '• Use Ctrl+F in Reference sheet to search for specific products/services';
      
      instructionsSheet.getCell('A23').value = 'EDITING PRODUCTS:';
      instructionsSheet.getCell('A23').font = { bold: true };
      instructionsSheet.getCell('A24').value = '• Modify any visible field (name, price, description, etc.)';
      instructionsSheet.getCell('A25').value = '• For filter fields (Size, Brand, Color, etc.), use values shown at bottom';
      instructionsSheet.getCell('A26').value = '• You can also enter new values - they will be added to the system';
      instructionsSheet.getCell('A27').value = '• Use dropdown lists where available to avoid typos';
      
      instructionsSheet.getCell('A29').value = 'ADDING NEW PRODUCTS:';
      instructionsSheet.getCell('A29').font = { bold: true };
      instructionsSheet.getCell('A30').value = '• Add a new row in the appropriate category sheet';
      instructionsSheet.getCell('A31').value = '• Fill in all required fields (name, price, stock)';
      instructionsSheet.getCell('A32').value = '• Leave the ID column empty for new products (system auto-generates)';
      instructionsSheet.getCell('A33').value = '• Keep the ID when updating existing products - this ensures updates work correctly';
      instructionsSheet.getCell('A34').value = '• New products will be assigned to that sheet\'s category';
      
      instructionsSheet.getCell('A36').value = 'PRODUCT IMAGES:';
      instructionsSheet.getCell('A36').font = { bold: true };
      instructionsSheet.getCell('A37').value = '• If you exported as ZIP, images are in the "images" folder';
      instructionsSheet.getCell('A38').value = '• In the Images column, enter comma-separated filenames (e.g., "image1.jpg, image2.png")';
      instructionsSheet.getCell('A39').value = '• You can reuse existing images or add new ones';
      instructionsSheet.getCell('A40').value = '• Supported formats: JPG, PNG, WEBP (max 5MB per image)';
      
      instructionsSheet.getCell('A42').value = 'PRICING & GST CONFIGURATION:';
      instructionsSheet.getCell('A42').font = { bold: true };
      instructionsSheet.getCell('A43').value = '• HSN Code/SAC Code: For goods/services GST classification (select from HSN-SAC Reference sheet)';
      instructionsSheet.getCell('A44').value = '• GST Rate (%): Auto-filled from HSN/SAC code when available, or select from dropdown (0, 5, 12, 18, 28)';
      instructionsSheet.getCell('A45').value = '• GST Rate is editable - system suggestion can be overridden if needed';
      instructionsSheet.getCell('A46').value = '• Price Type: "mrp_with_gst" or "selling_price_without_gst"';
      instructionsSheet.getCell('A47').value = '• MRP: Maximum Retail Price (if using mrp_with_gst)';
      instructionsSheet.getCell('A48').value = '• Base Price: Price before GST (auto-calculated)';
      instructionsSheet.getCell('A49').value = '• GST Amount: Tax amount (auto-calculated)';
      instructionsSheet.getCell('A50').value = '• Cost Per Item: Your cost/purchase price';
      
      instructionsSheet.getCell('A52').value = 'PRODUCT VARIANTS:';
      instructionsSheet.getCell('A52').font = { bold: true };
      instructionsSheet.getCell('A53').value = '• Products with variants are marked "YES" in the "Has Variants" column';
      instructionsSheet.getCell('A54').value = '• Variant products show price ranges (e.g., "3.00 - 333.00") and total stock across all variants';
      instructionsSheet.getCell('A55').value = '• Check the "Product Variants" sheet for detailed variant information';
      instructionsSheet.getCell('A56').value = '• Each variant has its own SKU, price, stock, and attributes (Size, Color, etc.)';
      instructionsSheet.getCell('A57').value = '• You can edit variant prices, stock, and active status in the "Product Variants" sheet';
      instructionsSheet.getCell('A58').value = '• Variants will be automatically created/updated during import';
      
      instructionsSheet.getCell('A60').value = 'ID COLUMNS (IMPORTANT):';
      instructionsSheet.getCell('A60').font = { bold: true };
      instructionsSheet.getCell('A61').value = '• Product ID and Variant ID columns are now visible (first columns in each sheet)';
      instructionsSheet.getCell('A62').value = '• When UPDATING products: Keep the existing ID - this ensures the correct product is updated';
      instructionsSheet.getCell('A63').value = '• When CREATING new products: Leave the ID column empty - system will auto-generate';
      instructionsSheet.getCell('A64').value = '• You can have multiple products with the same name if they have different IDs';
      instructionsSheet.getCell('A65').value = '• Same applies to variants: Keep Variant ID when updating, leave empty for new variants';
      
      instructionsSheet.getCell('A67').value = 'IMPORTING:';
      instructionsSheet.getCell('A67').font = { bold: true };
      instructionsSheet.getCell('A68').value = 'Option 1: Import as ZIP (Recommended)';
      instructionsSheet.getCell('A69').value = '• Keep this Excel file in the ZIP with the images folder';
      instructionsSheet.getCell('A70').value = '• Upload the entire ZIP file - everything is imported together';
      instructionsSheet.getCell('A71').value = '• Both products and variants will be imported automatically';
      instructionsSheet.getCell('A72').value = '';
      instructionsSheet.getCell('A73').value = 'Option 2: Import Excel + Images separately';
      instructionsSheet.getCell('A74').value = '• Upload the Excel file and select image files individually';
      instructionsSheet.getCell('A75').value = '• The system will match filenames from Excel with uploaded files';

      instructionsSheet.getColumn('A').width = 80;
      console.log('Instructions sheet created');

      console.log('📦 Generating Excel buffer...');
      const buffer = await workbook.xlsx.writeBuffer();
      console.log('📦 Excel buffer generated, converting to Node Buffer...');
      const nodeBuffer = Buffer.from(buffer);
      console.log(`✅✅✅ Excel export complete. Buffer size: ${nodeBuffer.length} bytes`);
      console.log('✅✅✅ ============================================');
      return nodeBuffer;
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      console.error('Error stack:', error.stack);
      throw new Error(`Failed to export products: ${error.message}`);
    }
  }

  async exportToZip(vendorId: string | null): Promise<Buffer> {
    try {
      console.log('Starting ZIP export for vendor:', vendorId || 'ALL');
      
      // Export actual products from database
      const whereCondition = vendorId ? { vendorId } : {};
      const products = await this.productsRepository.find({
        where: whereCondition,
      });

      console.log(`Found ${products.length} products for ZIP export`);
      
      // Get the Excel buffer first
      const excelBuffer = await this.exportToExcel(vendorId);
      
      const productsWithImages = products.filter(p => p.images && p.images.length > 0);
      console.log(`${productsWithImages.length} products have images`);

      // Create a ZIP archive
      return new Promise<Buffer>((resolve, reject) => {
        const archive = archiver('zip', {
          zlib: { level: 9 } // Maximum compression
        });

        const chunks: Buffer[] = [];
        
        archive.on('data', (chunk) => chunks.push(chunk));
        archive.on('end', () => {
          const buffer = Buffer.concat(chunks);
          console.log(`ZIP export complete. Buffer size: ${buffer.length} bytes`);
          resolve(buffer);
        });
        archive.on('error', (err) => {
          console.error('Archive error:', err);
          reject(err);
        });

        // Add the Excel file to the archive
        archive.append(excelBuffer, { name: 'products.xlsx' });

        // Add product images to the archive
        const addedImages = new Set<string>();
        let localImageCount = 0;
        let externalUrlCount = 0;
        
        products.forEach(product => {
          // Collect all images from both images array and featuredImage
          const allImagePaths: string[] = [];
          
          if (product.images && Array.isArray(product.images) && product.images.length > 0) {
            allImagePaths.push(...product.images.filter(img => img));
          }
          
          if (product.featuredImage && !allImagePaths.includes(product.featuredImage)) {
            allImagePaths.push(product.featuredImage);
          }
          
          if (allImagePaths.length > 0) {
            console.log(`Product "${product.name}" has ${allImagePaths.length} images:`, allImagePaths);
            
            allImagePaths.forEach(imagePath => {
              // Skip external URLs - they can't be included in ZIP
              if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
                externalUrlCount++;
                console.log(`Skipping external URL: ${imagePath}`);
                return;
              }
              
              // Avoid duplicates
              if (addedImages.has(imagePath)) {
                console.log(`Skipping duplicate: ${imagePath}`);
                return;
              }
              addedImages.add(imagePath);

              // Get the full file path
              const fullPath = path.join(process.cwd(), 'public', imagePath);
              console.log(`Checking file: ${fullPath}`);
              
              // Check if file exists
              if (fs.existsSync(fullPath)) {
                // Get just the filename for the ZIP
                const filename = path.basename(imagePath);
                // Add to images folder in ZIP
                archive.file(fullPath, { name: `images/${filename}` });
                localImageCount++;
                console.log(`✓ Added image: ${filename}`);
              } else {
                console.warn(`✗ Image not found: ${fullPath}`);
              }
            });
          }
        });

        console.log(`ZIP summary: ${localImageCount} local images added, ${externalUrlCount} external URLs skipped`);

        // Finalize the archive
        archive.finalize();
      });
    } catch (error) {
      console.error('Error exporting to ZIP:', error);
      console.error('Error stack:', error.stack);
      throw new Error(`Failed to export products as ZIP: ${error.message}`);
    }
  }

  async importFromExcel(vendorId: string, buffer: Buffer): Promise<{ created: number; updated: number; errors: string[] }> {
    return this.importFromExcelWithImages(vendorId, buffer, []);
  }

  async importFromZip(vendorId: string | null, zipBuffer: Buffer): Promise<{ created: number; updated: number; errors: string[] }> {
    try {
      // Extract ZIP file
      const zip = new AdmZip(zipBuffer);
      const zipEntries = zip.getEntries();

      let excelBuffer: Buffer | null = null;
      const imageFiles: MulterFile[] = [];

      // Process ZIP entries
      zipEntries.forEach(entry => {
        if (entry.entryName === 'products.xlsx') {
          // Found the Excel file
          excelBuffer = entry.getData();
        } else if (entry.entryName.startsWith('images/') && !entry.isDirectory) {
          // Found an image file
          const filename = path.basename(entry.entryName);
          const fileBuffer = entry.getData();
          
          // Convert to Multer file format
          imageFiles.push({
            fieldname: 'images',
            originalname: filename,
            encoding: '7bit',
            mimetype: this.getMimeType(filename),
            buffer: fileBuffer,
            size: fileBuffer.length,
          } as MulterFile);
        }
      });

      if (!excelBuffer) {
        throw new Error('No products.xlsx file found in ZIP');
      }

      // Use the existing import method
      return await this.importFromExcelWithImages(vendorId, excelBuffer, imageFiles);
    } catch (error) {
      console.error('Error importing from ZIP:', error);
      throw new Error(`Failed to import from ZIP: ${error.message}`);
    }
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

  async importFromExcelWithImages(
    vendorId: string | null,
    buffer: Buffer,
    imageFiles: MulterFile[],
  ): Promise<{ created: number; updated: number; errors: string[]; createdCategories?: string[] }> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    // If vendorId is provided, validate it exists
    let vendor: Vendor | null = null;
    if (vendorId) {
      vendor = await this.vendorsRepository.findOne({ where: { id: vendorId } });
      if (!vendor) {
        throw new Error('Vendor not found');
      }
    }
    // If vendorId is null, admin is importing - vendor will be from Excel or use platform vendor

    // Resolve platform vendor once per import to avoid parallel row races creating duplicates.
    let resolvedImportVendorId: string | null = vendorId;
    if (!resolvedImportVendorId) {
      const platformVendor = await this.getOrCreatePlatformVendorForImport();
      resolvedImportVendorId = platformVendor.id;
    }

    // Create a map of uploaded images by filename
    const imageMap = new Map<string, MulterFile>();
    imageFiles.forEach(file => {
      imageMap.set(file.originalname.toLowerCase(), file);
    });

    // Get categories for mapping sheet names to category IDs.
    // Super admin imports should map to global categories only, while vendor imports can use
    // both vendor-specific and global categories.
    const categoryWhere: any = vendorId
      ? [
          { isActive: true, vendorId },
          { isActive: true, vendorId: IsNull() },
        ]
      : [{ isActive: true, vendorId: IsNull() }];

    const categories = await this.categoriesRepository.find({ where: categoryWhere });
    const categoryMap = new Map<string, Category>();
    const categorySlugMap = new Map<string, Category>();

    const setCategoryWithPriority = (key: string, category: Category) => {
      const existing = categoryMap.get(key);
      if (!existing) {
        categoryMap.set(key, category);
        return;
      }

      // For vendor imports, prefer vendor-specific category over global when names collide.
      if (vendorId && existing.vendorId == null && category.vendorId === vendorId) {
        categoryMap.set(key, category);
      }
    };

    categories.forEach(cat => {
      setCategoryWithPriority(cat.name, cat);
      setCategoryWithPriority(cat.name.substring(0, 30), cat); // Handle truncated names
      categorySlugMap.set(cat.slug, cat);
    });

    let created = 0;
    let updated = 0;
    const errors: string[] = [];
    const createdCategories: string[] = [];
    
    // First pass: Process product sheets to create/update products
    const processedProductIds = new Set<string>();
    const productNameToIdMap = new Map<string, string>(); // Track product names -> IDs for variant lookup

    // Process each worksheet (skip non-product system sheets on first pass)
    for (const worksheet of workbook.worksheets) {
      const sheetName = worksheet.name;
      const normalizedSheetName = sheetName.trim().toLowerCase();
      const normalizedSheetSlug = sheetName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      const normalizedSheetNoDash = normalizedSheetSlug.replace(/-/g, '');
      const isBookingServicesSheet =
        normalizedSheetSlug === 'booking-services' ||
        normalizedSheetSlug === 'bookings-services' ||
        normalizedSheetNoDash === 'bookingservices' ||
        normalizedSheetNoDash === 'bookingsservices';
      
      // Skip template/system sheets so they are never treated as product categories.
      if (
        normalizedSheetName === 'instructions' ||
        normalizedSheetName === 'product variants' ||
        normalizedSheetName === 'hsn-sac reference' ||
        normalizedSheetNoDash === 'productvariants' ||
        normalizedSheetNoDash === 'hsnsacreference'
      ) {
        continue;
      }

      // Find the category for this sheet
      let category = categoryMap.get(sheetName);
      const isUncategorized = sheetName === 'Uncategorized';

      // Handle common sheet aliases to avoid duplicate category creation.
      if (!category && !isUncategorized && !isBookingServicesSheet) {
        const normalizedNoDash = normalizedSheetNoDash;
        if (
          normalizedSheetSlug === 'services' ||
          normalizedNoDash === 'bookingservices' ||
          normalizedNoDash === 'bookingsservices'
        ) {
          category = categorySlugMap.get('bookings-services');
          if (category) {
            categoryMap.set(sheetName, category);
          }
        }
      }
      
      // Auto-create category if not found (except for Uncategorized)
      if (!category && !isUncategorized && !isBookingServicesSheet) {
        try {
          console.log(`[Import] Creating new category: ${sheetName}`);
          const slug = sheetName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

          // If a category with this slug already exists in scope, reuse it instead of creating duplicate.
          const existingCategoryBySlug = categorySlugMap.get(slug);
          if (existingCategoryBySlug) {
            category = existingCategoryBySlug;
            categoryMap.set(sheetName, category);
            continue;
          }

          const maxSortOrder = await this.categoriesRepository
            .createQueryBuilder('category')
            .select('MAX(category.sortOrder)', 'max')
            .getRawOne();
          
          const newCategory = this.categoriesRepository.create({
            name: sheetName,
            slug: slug,
            description: `Auto-created from Excel import`,
            vendorId: vendorId || null,
            isActive: true,
            sortOrder: (maxSortOrder?.max || 0) + 1,
          });
          
          const savedCategories = await this.categoriesRepository.save(newCategory);
          category = Array.isArray(savedCategories) ? savedCategories[0] : savedCategories;
          if (category) {
            categoryMap.set(sheetName, category);
            categorySlugMap.set(category.slug, category);
            createdCategories.push(sheetName);
            console.log(`[Import] Created category: ${sheetName} (ID: ${category.id})`);
          }
        } catch (error) {
          errors.push(`Sheet "${sheetName}": Failed to create category - ${error.message}`);
          continue;
        }
      }
      
      if (!category && !isUncategorized && !isBookingServicesSheet) {
        continue;
      }

      // Get category-specific filters if available
      const categoryFilters = category?.filterConfig?.filters?.filter(f => f.id !== 'priceRange') || [];

      // Build column map from header row
      const headerRow = worksheet.getRow(1);
      const columnMap = new Map<string, number>();
      console.log(`[Import] Processing sheet "${sheetName}", building column map...`);
      headerRow.eachCell((cell, colNumber) => {
        const headerName = cell.value?.toString().trim();
        if (headerName) {
          // Map various header formats to canonical keys
          const normalizedKey = headerName
            .replace(/\s+\([^)]*\)/g, '') // Remove parentheses content like (comma-separated)
            .replace(/\s+/g, '')  // Remove spaces
            .toLowerCase();
          columnMap.set(normalizedKey, colNumber);
          
          // Also map exact header name
          columnMap.set(headerName, colNumber);
          console.log(`[Import]   Column ${colNumber}: "${headerName}" (normalized: "${normalizedKey}")`);
        }
      });
      console.log(`[Import] Found ${columnMap.size / 2} columns in sheet "${sheetName}"`);

      // Helper function to get cell value by header name
      const getCellValue = (row: ExcelJS.Row, headerKey: string): any => {
        const colIndex = columnMap.get(headerKey) || columnMap.get(headerKey.toLowerCase().replace(/\s+/g, ''));
        return colIndex ? row.getCell(colIndex).value : null;
      };

      // Collect all rows to process (skip header and reference rows)
      const rowsToProcess: { row: ExcelJS.Row; rowNumber: number }[] = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header
        
        // Check if this is a reference row (contains "options:")
        const firstCell = row.getCell(1).value?.toString().trim();
        if (firstCell && firstCell.includes('options:')) return;
        
        // Check if row has a product name (don't skip just because ID is blank)
        const productNameCol = columnMap.get('Product Name') || columnMap.get('productname');
        const productName = productNameCol ? row.getCell(productNameCol).value?.toString().trim() : null;
        if (!productName) return; // Skip only if product name is also empty
        
        rowsToProcess.push({ row, rowNumber });
      });

      // Process each row asynchronously
      const rowPromises = rowsToProcess.map(async ({ row, rowNumber }) => {

        try {
          // Wrap all cell access in try-catch to provide better error messages
          let _id: string | undefined;
          let name: string | undefined;
          let description: string | undefined;
          let imagesCell: string | undefined;
          let price: number;
          let compareAtPrice: number;
          let stockQuantity: number;
          let status: string;
          
          try {
            // Try to get ID column if it exists (for updates), otherwise it's a new product
            // Check for both 'ID' (new visible name) and '_ID' (legacy hidden name)
            try {
              _id = getCellValue(row, 'ID')?.toString().trim() || 
                    getCellValue(row, '_ID')?.toString().trim();
            } catch (e) {
              // Column doesn't exist - this is fine for new imports
              _id = undefined;
            }
            
            console.log(`[Import] Row ${rowNumber}: Reading cells...`);
            name = getCellValue(row, 'Product Name')?.toString().trim();
            console.log(`[Import] Row ${rowNumber}: Product Name = "${name}"`);
            description = getCellValue(row, 'Description')?.toString().trim();
            imagesCell = getCellValue(row, 'Images (comma-separated filenames)')?.toString().trim() || 
                              getCellValue(row, 'Images')?.toString().trim();
            price = parseFloat(getCellValue(row, 'Price')?.toString() || '0');
            compareAtPrice = parseFloat(getCellValue(row, 'Compare At Price (Optional)')?.toString() || 
                                             getCellValue(row, 'Compare At Price')?.toString() || '0');
            stockQuantity = parseInt(getCellValue(row, 'Stock Quantity')?.toString() || '0');
            status = getCellValue(row, 'Status (active/draft/archived)')?.toString().trim() || 
                          getCellValue(row, 'Status')?.toString().trim() || 'active';
            console.log(`[Import] Row ${rowNumber}: Successfully read basic fields`);
          } catch (cellError) {
            // Catch Excel "Out of bounds" and other cell access errors
            const errorMsg = cellError.message || String(cellError);
            if (errorMsg.includes('Out of bounds') || errorMsg.includes('column')) {
              errors.push(`Sheet "${sheetName}", Row ${rowNumber}: Error reading data - please check that all required columns exist and data is properly formatted. (Technical: ${errorMsg})`);
            } else {
              errors.push(`Sheet "${sheetName}", Row ${rowNumber}: Error reading data - ${errorMsg}`);
            }
            return;
          }
          
          // Read GST/Pricing fields
          // Extract just the code part if format is "code - description"
          let hsnCode = getCellValue(row, 'HSN Code')?.toString().trim() || null;
          if (hsnCode && hsnCode.includes(' - ')) {
            hsnCode = hsnCode.split(' - ')[0].trim();
          }
          
          let sacCode = getCellValue(row, 'SAC Code')?.toString().trim() || null;
          if (sacCode && sacCode.includes(' - ')) {
            sacCode = sacCode.split(' - ')[0].trim();
          }
          
          let gstRate = parseFloat(getCellValue(row, 'GST Rate (%)')?.toString() || 
                                  getCellValue(row, 'GST Rate')?.toString() || '0');
          const priceType = getCellValue(row, 'Price Type')?.toString().trim() || 'selling_price_without_gst';
          const mrp = parseFloat(getCellValue(row, 'MRP')?.toString() || '0') || null;
          const basePrice = parseFloat(getCellValue(row, 'Base Price')?.toString() || '0') || null;
          const gstAmount = parseFloat(getCellValue(row, 'GST Amount')?.toString() || '0') || null;
          const costPerItem = parseFloat(getCellValue(row, 'Cost Per Item')?.toString() || '0') || null;

          // Read Product Type and Booking fields
          const rawProductType = getCellValue(row, 'Product Type')?.toString().trim().toLowerCase();
          const productType = isBookingServicesSheet ? 'booking' : (rawProductType || 'physical');
          const bookingDuration = getCellValue(row, 'Booking Duration')?.toString().trim();
          const bookingDurationUnit = getCellValue(row, 'Booking Duration Unit')?.toString().trim();
          const bookingBufferTime = getCellValue(row, 'Booking Buffer Time')?.toString().trim();
          const bookingAvailableDays = getCellValue(row, 'Booking Available Days')?.toString().trim();
          const bookingTimeSlots = getCellValue(row, 'Booking Time Slots')?.toString().trim();

          // Auto-populate GST rate from HSN/SAC code if not provided
          if (!gstRate && (hsnCode || sacCode)) {
            const codeToLookup = hsnCode || sacCode;
            if (codeToLookup) {
              const recommendedRate = await this.getGstRateFromHsnCode(codeToLookup);
              if (recommendedRate !== null) {
                gstRate = recommendedRate;
                console.log(`Row ${rowNumber}: Auto-filled GST rate ${recommendedRate}% from ${hsnCode ? 'HSN' : 'SAC'} code ${codeToLookup}`);
              } else {
                gstRate = 18; // Default to 18% if no recommendation found
              }
            }
          } else if (!gstRate) {
            gstRate = 18; // Default to 18% if no code provided
          }

          // Skip empty rows
          if (!name) return;

          // Determine vendor ID for this product
          const finalVendorId: string | null = resolvedImportVendorId;
          if (!finalVendorId) {
            errors.push(`Sheet "${sheetName}", Row ${rowNumber}: No vendor ID provided and platform vendor not available`);
            return;
          }

          // Process images
          const productImages: string[] = [];
          const uploadedCloudinaryUrls: string[] = []; // Track for cleanup on failure
          
          if (imagesCell) {
            const imageFilenames = imagesCell.split(',').map(f => f.trim()).filter(f => f.length > 0);
            for (const filename of imageFilenames) {
              // Check if it's an external URL - if so, keep it as-is
              if (filename.startsWith('http://') || filename.startsWith('https://')) {
                productImages.push(filename);
                console.log(`[Import] Row ${rowNumber}: Keeping external URL: ${filename}`);
                continue;
              }
              
              // Otherwise, look for the file in the ZIP
              let imageFile = imageMap.get(filename.toLowerCase());
              
              // If not found and no extension, try common extensions
              if (!imageFile && !filename.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
                const extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.JPG', '.JPEG', '.PNG', '.GIF', '.WEBP'];
                for (const ext of extensions) {
                  imageFile = imageMap.get((filename + ext).toLowerCase());
                  if (imageFile) break;
                }
              }
              
              if (imageFile) {
                try {
                  // Save the image (Cloudinary or local filesystem)
                  const uploadPath = await this.saveUploadedImage(imageFile, finalVendorId);
                  productImages.push(uploadPath);
                  
                  // Track Cloudinary URLs for potential cleanup
                  if (uploadPath.startsWith('https://res.cloudinary.com')) {
                    uploadedCloudinaryUrls.push(uploadPath);
                  }
                } catch (uploadError) {
                  errors.push(`Sheet "${sheetName}", Row ${rowNumber}: Failed to upload image "${filename}" - ${uploadError.message}`);
                  // Clean up any images uploaded so far for this product
                  if (uploadedCloudinaryUrls.length > 0) {
                    console.log(`[Import] Cleaning up ${uploadedCloudinaryUrls.length} uploaded images due to upload failure`);
                    await this.cloudinaryService.deleteMultipleImages(uploadedCloudinaryUrls);
                  }
                  throw uploadError; // Re-throw to skip product creation
                }
              } else {
                errors.push(`Sheet "${sheetName}", Row ${rowNumber}: Image "${filename}" not found in the "images" folder of your ZIP file. Make sure the filename matches exactly (including file extension like .jpg, .png).`);
              }
            }
          }

          // Collect attributes from category-specific columns
          const attributes: Record<string, any> = {};
          categoryFilters.forEach(filter => {
            const cellValue = getCellValue(row, `attr_${filter.id}`)?.toString().trim();
            if (cellValue) {
              attributes[filter.id] = cellValue;
            }
          });

          // Add booking attributes if product is a booking type
          if (productType === 'booking' && bookingDuration && bookingDurationUnit) {
            attributes.booking = {
              duration: parseInt(bookingDuration) || 60,
              durationUnit: bookingDurationUnit || 'minutes',
              bufferTime: parseInt(bookingBufferTime || '0') || 0,
              availableDays: bookingAvailableDays ? bookingAvailableDays.split(',').map(d => d.trim().toLowerCase()) : ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
              timeSlots: [],
            };

            // Parse time slots
            if (bookingTimeSlots) {
              const slots = bookingTimeSlots.split(',').map(s => s.trim());
              slots.forEach(slot => {
                const [start, end] = slot.split('-').map(t => t.trim());
                if (start && end) {
                  attributes.booking.timeSlots.push({ start, end });
                }
              });
            }

            // Default time slot if none provided
            if (attributes.booking.timeSlots.length === 0) {
              attributes.booking.timeSlots.push({ start: '09:00', end: '17:00' });
            }

            console.log(`Row ${rowNumber}: Parsed booking attributes:`, JSON.stringify(attributes.booking));
          }

          // Prepare product data
          // Generate unique slug
          let baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
          let slug = baseSlug;
          let slugCounter = 1;
          
          // Check if slug already exists (only for new products without ID)
          if (!_id) {
            while (await this.productsRepository.findOne({ where: { slug } })) {
              slug = `${baseSlug}-${slugCounter}`;
              slugCounter++;
            }
          }
          
          const productData: any = {
            name,
            slug,
            description: description || '',
            price,
            compareAtPrice: compareAtPrice || null,
            stockQuantity,
            sku: `${finalVendorId.substring(0, 8)}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            status,
            productType: productType === 'booking' ? 'booking' : 'physical',
            vendorId: finalVendorId,
            categories: isBookingServicesSheet ? [] : (category ? [category] : []),
            attributes: Object.keys(attributes).length > 0 ? attributes : null,
            images: productImages.length > 0 ? productImages : null,
            featuredImage: productImages.length > 0 ? productImages[0] : null,
            hsnCode,
            sacCode,
            gstRate,
            priceType,
            mrp,
            basePrice,
            gstAmount,
            costPerItem,
          };

          if (_id && _id.length > 0) {
            // Update existing product
            try {
              const existingProduct = await this.productsRepository.findOne({ 
                where: { id: _id },
                relations: ['categories']
              });
              if (existingProduct && (!vendorId || existingProduct.vendorId === finalVendorId)) {
                // Remove categories from productData to avoid TypeORM many-to-many issues
                const { categories: _, ...dataWithoutCategories } = productData;
                await this.productsRepository.update(_id, dataWithoutCategories);
                
                // Update categories relationship separately
                if (isBookingServicesSheet) {
                  existingProduct.categories = [];
                  await this.productsRepository.save(existingProduct);
                } else if (category) {
                  existingProduct.categories = [category];
                  await this.productsRepository.save(existingProduct);
                }
                updated++;
                processedProductIds.add(_id);
                // Add to map for variant lookup
                productNameToIdMap.set(name, _id);
                console.log(`[Import] Row ${rowNumber}: Updated product "${name}" (ID: ${_id})`);
              } else {
                errors.push(`Sheet "${sheetName}", Row ${rowNumber}: Product not found or doesn't belong to vendor`);
                // Clean up uploaded images on failure
                if (uploadedCloudinaryUrls.length > 0) {
                  console.log(`[Import] Cleaning up ${uploadedCloudinaryUrls.length} uploaded images - product not found`);
                  await this.cloudinaryService.deleteMultipleImages(uploadedCloudinaryUrls);
                }
              }
            } catch (err) {
              errors.push(`Sheet "${sheetName}", Row ${rowNumber}: Update failed - ${err.message}`);
              console.error(`[Import] Update error for row ${rowNumber}:`, err);
              // Clean up uploaded images on failure
              if (uploadedCloudinaryUrls.length > 0) {
                console.log(`[Import] Cleaning up ${uploadedCloudinaryUrls.length} uploaded images - update failed`);
                await this.cloudinaryService.deleteMultipleImages(uploadedCloudinaryUrls);
              }
            }
          } else {
            // Create new product
            try {
              const product = this.productsRepository.create(productData);
              const savedResult = await this.productsRepository.save(product);
              const savedProduct = Array.isArray(savedResult) ? savedResult[0] : savedResult;
              created++;
              processedProductIds.add(savedProduct.id);
              // Add to map for variant lookup
              productNameToIdMap.set(name, savedProduct.id);
              console.log(`[Import] Created product "${name}" with ID: ${savedProduct.id}`);
            } catch (err) {
              errors.push(`Sheet "${sheetName}", Row ${rowNumber}: Create failed - ${err.message}`);
              // Clean up uploaded images on failure
              if (uploadedCloudinaryUrls.length > 0) {
                console.log(`[Import] Cleaning up ${uploadedCloudinaryUrls.length} uploaded images - create failed`);
                await this.cloudinaryService.deleteMultipleImages(uploadedCloudinaryUrls);
              }
            }
          }

        } catch (error) {
          errors.push(`Sheet "${sheetName}", Row ${rowNumber}: ${error.message}`);
        }
      });

      // Wait for all row processing to complete for this sheet
      await Promise.all(rowPromises);
    }

    // IMPORTANT: Flush all database writes before processing variants
    // This ensures products are actually in the database when variants try to look them up
    console.log(`[Import] All product sheets processed. Flushing database writes...`);
    console.log(`[Import] Created: ${created}, Updated: ${updated}`);
    
    // Wait a bit to ensure database transactions are committed
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log(`[Import] Database flush complete. Starting variant processing...`);

    // Second pass: Process Product Variants sheet
    const variantsSheet = workbook.getWorksheet('Product Variants');
    if (variantsSheet) {
      console.log('Processing Product Variants sheet...');
      let variantsCreated = 0;
      let variantsUpdated = 0;

      // Collect all unique variant attributes to potentially add to categories
      const discoveredAttributes = new Map<string, Set<string>>(); // attribute name -> set of values

      // Build column map from header row for variants
      const variantHeaderRow = variantsSheet.getRow(1);
      const variantColumnMap = new Map<string, number>();
      const headerNameMap = new Map<number, string>(); // Map col index to original header name
      
      variantHeaderRow.eachCell((cell, colNumber) => {
        const headerName = cell.value?.toString().trim();
        if (headerName) {
          const normalizedKey = headerName.replace(/\s+/g, '').toLowerCase();
          variantColumnMap.set(normalizedKey, colNumber);
          headerNameMap.set(colNumber, headerName); // Store original name for attribute keys
        }
      });

      console.log('[Variants] Column mapping:', Array.from(variantColumnMap.entries()).map(([key, col]) => `"${key}" -> col ${col}`).join(', '));
      console.log('[Variants] Available columns:', Array.from(variantColumnMap.keys()).join(', '));
      console.log('[Variants] Looking for "sku" column - found:', variantColumnMap.has('sku') ? 'YES' : 'NO');
      console.log('[Variants] Looking for "variantsku" column - found:', variantColumnMap.has('variantsku') ? 'YES' : 'NO');

      const getVariantCellValue = (row: ExcelJS.Row, headerKey: string): any => {
        const normalizedKey = headerKey.toLowerCase().replace(/\s+/g, '');
        const colIndex = variantColumnMap.get(normalizedKey);
        const value = colIndex ? row.getCell(colIndex).value : null;
        if (row.number === 2 && ['sku', 'productname', 'variantid', 'productid'].includes(normalizedKey)) {
          console.log(`[Variants] getVariantCellValue(row ${row.number}, "${headerKey}") -> normalizedKey="${normalizedKey}", colIndex=${colIndex}, value=${value}`);
        }
        return value;
      };

      // First pass through variants: collect all attributes
      variantsSheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header
        
        // Method 1: Check for combined "Variant Attributes" column (format: "Size: S, Color: Red")
        const attributesStr = getVariantCellValue(row, 'Variant Attributes')?.toString().trim();
        if (attributesStr) {
          attributesStr.split(',').forEach(attr => {
            const [key, value] = attr.split(':').map(s => s.trim());
            if (key && value) {
              if (!discoveredAttributes.has(key)) {
                discoveredAttributes.set(key, new Set());
              }
              discoveredAttributes.get(key)?.add(value);
            }
          });
        }
        
        // Method 2: Check for individual attribute columns (Size, Color, Weight, etc.)
        // These are any columns that are not standard variant columns
        const standardColumns = [
          'productname', 'variantname', 'sku', 'price', 'compareatprice', 
          'stockquantity', 'isactive', 'attributes',
          '_product_id', '_variant_id',
          'variantid', 'productid'
        ];
        
        headerNameMap.forEach((originalHeaderName, colIndex) => {
          const normalizedHeader = originalHeaderName.toLowerCase().replace(/\s+/g, '');
          
          // If this is not a standard column, treat it as a variant attribute
          if (!standardColumns.includes(normalizedHeader)) {
            const value = row.getCell(colIndex).value?.toString().trim();
            if (value) {
              // Use the original header name (with proper casing) as the attribute key
              if (!discoveredAttributes.has(originalHeaderName)) {
                discoveredAttributes.set(originalHeaderName, new Set());
              }
              discoveredAttributes.get(originalHeaderName)?.add(value);
            }
          }
        });
      });

      console.log(`[Variants] Discovered attributes:`, Array.from(discoveredAttributes.entries()).map(([key, values]) => `${key}: [${Array.from(values).join(', ')}]`).join(', '));

      // Update categories with discovered attributes if needed
      if (discoveredAttributes.size > 0) {
        const categoriesToUpdate = await this.categoriesRepository.find({ 
          where: { isActive: true } 
        });
        
        for (const category of categoriesToUpdate) {
          let needsUpdate = false;
          const filterConfig = category.filterConfig || { filters: [] };
          
          // Check each discovered attribute
          for (const [attrKey, attrValues] of discoveredAttributes.entries()) {
            const attrId = attrKey.toLowerCase();
            
            // Check if this attribute already exists in the category
            const existingFilter = filterConfig.filters.find(f => f.id === attrId);
            
            if (!existingFilter) {
              // Add new filter for this attribute
              console.log(`[Variants] Adding "${attrKey}" attribute to category "${category.name}"`);
              filterConfig.filters.push({
                id: attrId,
                label: attrKey,
                type: 'select',
                options: Array.from(attrValues).map(value => ({
                  value: value.toLowerCase(),
                  label: value
                }))
              });
              needsUpdate = true;
            } else {
              // Merge new values into existing filter
              const existingValues = new Set(existingFilter.options?.map(o => o.value) || []);
              let addedValues = false;
              
              for (const value of attrValues) {
                const normalizedValue = value.toLowerCase();
                if (!existingValues.has(normalizedValue)) {
                  console.log(`[Variants] Adding value "${value}" to "${attrKey}" in category "${category.name}"`);
                  if (!existingFilter.options) existingFilter.options = [];
                  existingFilter.options.push({
                    value: normalizedValue,
                    label: value
                  });
                  addedValues = true;
                }
              }
              
              if (addedValues) needsUpdate = true;
            }
          }
          
          if (needsUpdate) {
            category.filterConfig = filterConfig;
            await this.categoriesRepository.save(category);
            console.log(`[Variants] Updated category "${category.name}" with variant attributes`);
          }
        }
      }

      // Process each variant row
      const variantPromises: Promise<void>[] = [];
      
      variantsSheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header

        try {
          // Try to get ID columns if they exist (for updates)
          // Check for new visible column names first, then fall back to legacy hidden names
          let productId: string | undefined;
          let variantId: string | undefined;
          try {
            const variantIdRaw = getVariantCellValue(row, 'Variant ID') || getVariantCellValue(row, '_VARIANT_ID');
            const productIdRaw = getVariantCellValue(row, 'Product ID') || getVariantCellValue(row, '_PRODUCT_ID');
            
            variantId = variantIdRaw?.toString().trim();
            productId = productIdRaw?.toString().trim();
            
            console.log(`[Variants] Row ${rowNumber}: variantIdRaw=${JSON.stringify(variantIdRaw)}, productIdRaw=${JSON.stringify(productIdRaw)}`);
            console.log(`[Variants] Row ${rowNumber}: variantId=${variantId}, productId=${productId}`);
          } catch (e) {
            // Columns don't exist - this is fine for new imports
            console.log(`[Variants] Row ${rowNumber}: Error reading ID columns:`, e.message);
            variantId = undefined;
            productId = undefined;
          }
          
          const sku = getVariantCellValue(row, 'SKU')?.toString().trim();
          const productName = getVariantCellValue(row, 'Product Name')?.toString().trim();
          const attributesStr = getVariantCellValue(row, 'Variant Attributes')?.toString().trim();
          
          console.log(`[Variants] Row ${rowNumber}: sku=${sku}, productName=${productName}`);
          const price = parseFloat(getVariantCellValue(row, 'Price')?.toString() || '0');
          const compareAtPrice = parseFloat(getVariantCellValue(row, 'Compare At Price')?.toString() || '0');
          const stock = parseInt(getVariantCellValue(row, 'Stock')?.toString() || '0');
          const isActiveStr = getVariantCellValue(row, 'Active')?.toString().trim()?.toUpperCase();
          const isActive = isActiveStr === 'YES' || isActiveStr === 'TRUE';

          if ((!productId && !productName) || !sku) {
            errors.push(`Variants Sheet, Row ${rowNumber}: Missing product identifier or SKU`);
            return;
          }

          // Parse attributes - support both formats
          const variantAttributes: Record<string, string> = {};
          
          // Method 1: Parse from "Variant Attributes" column (e.g., "Size: xs, Color: black, Weight: 250g")
          if (attributesStr) {
            attributesStr.split(',').forEach(attr => {
              const [key, value] = attr.split(':').map(s => s.trim());
              if (key && value) {
                // Skip standard fields that shouldn't be in attributes
                const normalizedKey = key.toLowerCase().replace(/\s+/g, '');
                if (!['stock', 'active', 'isactive', 'stockquantity', 'price', 'compareatprice', 'sku', 'variantattributes'].includes(normalizedKey)) {
                  variantAttributes[key] = value;
                }
              }
            });
          }
          
          // Method 2: Parse from individual attribute columns (Size, Color, etc.)
          const standardColumns = [
            'productname', 'variantname', 'sku', 'price', 'compareatprice', 
            'stockquantity', 'stock', 'isactive', 'active', 'attributes', 'variantattributes',
            '_product_id', '_variant_id',
            'variantid', 'productid'
          ];
          
          headerNameMap.forEach((originalHeaderName, colIndex) => {
            const normalizedHeader = originalHeaderName.toLowerCase().replace(/\s+/g, '');
            
            // If this is not a standard column, treat it as a variant attribute
            if (!standardColumns.includes(normalizedHeader)) {
              const value = row.getCell(colIndex).value?.toString().trim();
              if (value) {
                // Use the original header name as the attribute key
                variantAttributes[originalHeaderName] = value;
              }
            }
          });

          const promise = (async () => {
            // If no productId, look up by product name
            let finalProductId = productId;
            if (!finalProductId && productName) {
              // First try to find in our newly created products map
              if (productNameToIdMap.has(productName)) {
                finalProductId = productNameToIdMap.get(productName);
                console.log(`[Variants] Found product "${productName}" in creation map: ${finalProductId}`);
              } else {
                // If not found in map, look up in database
                const whereCondition: any = { name: productName };
                // Only add vendorId filter if vendorId is provided (not super admin import)
                if (vendorId) {
                  whereCondition.vendorId = vendorId;
                }
                
                console.log(`[Variants] Looking up product in database: "${productName}" with conditions:`, whereCondition);
                const product = await this.productsRepository.findOne({
                  where: whereCondition
                });
                if (product) {
                  finalProductId = product.id;
                  console.log(`[Variants] Found product in database: ${product.id} (vendor: ${product.vendorId})`);
                } else {
                  console.error(`[Variants] Product "${productName}" not found in map or database`);
                  console.error(`[Variants] Available products in map:`, Array.from(productNameToIdMap.keys()));
                  errors.push(`Variants Sheet, Row ${rowNumber}: Product "${productName}" not found. Make sure the product name exactly matches a product in one of the category sheets (case-sensitive), and the product was successfully imported. Available products: ${Array.from(productNameToIdMap.keys()).join(', ')}`);
                  return;
                }
              }
            }

            console.log(`[Variants] Creating variant with productId: ${finalProductId}, vendorId: ${vendorId}`);

            const variantData: any = {
              productId: finalProductId,
              sku,
              variantAttributes,
              price,
              stockQuantity: stock,
              isActive,
            };
            
            // Only add compareAtPrice if it has a value
            if (compareAtPrice) {
              variantData.compareAtPrice = compareAtPrice;
            }
            if (variantId && variantId.length > 0) {
              // Update existing variant
              const existingVariant = await this.productVariantsRepository.findOne({
                where: { id: variantId },
                relations: ['product'],
              });

              if (existingVariant && (!vendorId || existingVariant.product.vendorId === vendorId)) {
                await this.productVariantsRepository.update(variantId, variantData);
                variantsUpdated++;
                console.log(`Updated variant: ${sku}`);
              } else {
                errors.push(`Variants Sheet, Row ${rowNumber}: Variant not found or doesn't belong to vendor`);
              }
            } else {
              // Create or update variant — check by SKU first to avoid duplicate-key errors
              const product = await this.productsRepository.findOne({
                where: { id: finalProductId },
              });

              console.log(`[Variants] Verifying product for variant creation:`, {
                productFound: !!product,
                productId: product?.id,
                productVendorId: product?.vendorId,
                importVendorId: vendorId,
                isAdminImport: vendorId === null,
              });

              if (product && (!vendorId || product.vendorId === vendorId)) {
                // Check whether a variant with this SKU already exists
                const existingBySku = await this.productVariantsRepository.findOne({
                  where: { sku },
                  relations: ['product'],
                });

                if (existingBySku) {
                  // SKU already in database → update instead of insert
                  await this.productVariantsRepository.update(existingBySku.id, variantData);
                  variantsUpdated++;
                  console.log(`Updated variant by SKU (upsert): ${sku}`);
                } else {
                  const newVariant = this.productVariantsRepository.create(variantData);
                  await this.productVariantsRepository.save(newVariant);
                  variantsCreated++;
                  console.log(`Created variant: ${sku}`);
                }

                // Update product to mark it has variants
                if (!product.hasVariants && finalProductId) {
                  await this.productsRepository.update(finalProductId, { hasVariants: true });
                }
              } else {
                console.error(`[Variants] Product verification failed - product: ${!!product}, vendorId: ${vendorId}, productVendorId: ${product?.vendorId}`);
                errors.push(`Variants Sheet, Row ${rowNumber}: Product not found or doesn't belong to vendor`);
              }
            }
          })();

          variantPromises.push(promise);

        } catch (error) {
          errors.push(`Variants Sheet, Row ${rowNumber}: ${error.message}`);
        }
      });

      // Wait for all variant operations to complete
      await Promise.all(variantPromises);
      console.log(`Variants processing complete: ${variantsCreated} created, ${variantsUpdated} updated`);

    }

    // Roll up variant stocks to the parent product so it is never shown as sold out
    for (const pid of Array.from(processedProductIds)) {
      const product = await this.productsRepository.findOne({ where: { id: pid } });
      if (product?.hasVariants) {
        const variants = await this.productVariantsRepository.find({ where: { productId: pid } });
        const totalStock = variants.reduce((sum, v) => sum + (v.stockQuantity || 0), 0);
        await this.productsRepository.update(pid, { stockQuantity: totalStock });
        console.log(`[Import] Updated product "${product.name}" stock to ${totalStock} (sum of ${variants.length} variants)`);
      }
    }

    // Add info about created categories to result
    if (createdCategories.length > 0) {
      console.log(`[Import] Auto-created ${createdCategories.length} categories: ${createdCategories.join(', ')}`);
    }

    return { 
      created, 
      updated, 
      errors,
      createdCategories: createdCategories.length > 0 ? createdCategories : undefined
    };
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

  /**
   * Generate a sample template with 3 example products and dummy images
   */
  async generateSampleTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();

    // ─── Sizes & Colors for the variant product ───────────────────────────────
    const SIZES = ['S', 'M', 'L', 'XL'];
    const COLORS = ['Red', 'Blue', 'Green'];
    const PRODUCT_NAME = 'Classic Cotton T-Shirt';
    const TOTAL_VARIANTS = SIZES.length * COLORS.length; // 12

    // Color → RGB used for dummy images
    const COLOR_MAP: Record<string, { r: number; g: number; b: number }> = {
      Red:   { r: 220, g: 50,  b: 50  },
      Blue:  { r: 50,  g: 100, b: 220 },
      Green: { r: 50,  g: 180, b: 80  },
    };

    // ─── Uncategorized sheet (product row) ────────────────────────────────────
    const productSheet = workbook.addWorksheet('Uncategorized');
    const columns = this.getProductColumns();
    productSheet.columns = columns;
    this.styleHeaderRow(productSheet, 'FF4A90E2');

    // Build image list: one main image per color + one extra per color
    const productImageFilenames = COLORS.flatMap(c => [
      `tshirt-${c.toLowerCase()}-front.jpg`,
      `tshirt-${c.toLowerCase()}-back.jpg`,
    ]);

    productSheet.addRow({
      _id: '',
      name: PRODUCT_NAME,
      description: '<p>Premium quality 100% cotton t-shirt available in multiple sizes (S, M, L, XL) and colours (Red, Blue, Green). Soft, breathable and durable fabric suitable for everyday wear.</p>',
      images: productImageFilenames.join(', '),
      hasVariants: 'YES',
      price: 499,
      compareAtPrice: 699,
      stockQuantity: 0,
      status: 'active',
      variantCount: TOTAL_VARIANTS,
      hsnCode: '6109',
      sacCode: '',
      gstRate: 12,
      priceType: 'selling_price_without_gst',
      productType: 'physical',
      bookingDuration: '',
      bookingDurationUnit: '',
      bookingBufferTime: '',
      bookingAvailableDays: '',
      bookingTimeSlots: '',
      mrp: 699,
      basePrice: 445,
      gstAmount: 54,
      costPerItem: 280,
    });

    // ─── Product Variants sheet (Size × Color matrix) ─────────────────────────
    const variantsSheet = workbook.addWorksheet('Product Variants');
    const variantColumns = this.getVariantColumns();
    variantsSheet.columns = variantColumns;
    this.styleHeaderRow(variantsSheet, 'FF9B59B6');

    // Price overrides: XL costs a bit more
    const priceFor = (size: string): number => size === 'XL' ? 549 : 499;

    SIZES.forEach(size => {
      COLORS.forEach(color => {
        variantsSheet.addRow({
          _variantId: '',
          _productId: '',
          productName: PRODUCT_NAME,
          sku: `CTS-${size}-${color.toUpperCase().substring(0, 3)}`,
          attributes: `Size: ${size}, Color: ${color}`,
          price: priceFor(size),
          compareAtPrice: 699,
          stock: Math.floor(Math.random() * 20) + 5,
          isActive: 'YES',
        });
      });
    });

    this.applyVariantDataValidation(variantsSheet, TOTAL_VARIANTS);

    // ─── Instructions sheet ───────────────────────────────────────────────────
    const instructionsSheet = workbook.addWorksheet('📖 Instructions');
    instructionsSheet.getColumn(1).width = 100;

    const addBold = (row: number, text: string) => {
      instructionsSheet.getCell(`A${row}`).value = text;
      instructionsSheet.getCell(`A${row}`).font = { bold: true };
    };
    const add = (row: number, text: string) => {
      instructionsSheet.getCell(`A${row}`).value = text;
    };

    addBold(1,  'PRODUCT IMPORT TEMPLATE — Physical Product with Size × Color Variants');
    add(3,  `This template demonstrates one product (${PRODUCT_NAME}) with ${TOTAL_VARIANTS} variants across ${SIZES.length} sizes and ${COLORS.length} colours.`);
    add(5,  'SHEETS IN THIS WORKBOOK:');
    addBold(5, 'SHEETS IN THIS WORKBOOK:');
    add(6,  `• Uncategorized  — the product header row (hasVariants = YES)`);
    add(7,  `• Product Variants — one row per Size × Color combination (${SIZES.join(', ')} × ${COLORS.join(', ')})`);
    add(8,  '• 📖 Instructions — this sheet');
    add(10, 'HOW TO USE:');
    addBold(10, 'HOW TO USE:');
    add(11, '1. Replace the sample data with your own product name, description, price, HSN code, etc.');
    add(12, '2. In "Product Variants", update SKUs, prices, stock quantities and attributes for each variant.');
    add(13, '3. Replace the dummy image filenames with your actual image files.');
    add(14, '4. Place your images in the "images/" folder inside the ZIP.');
    add(15, '5. Import the ZIP via Admin → Products → Import from ZIP.');
    add(17, 'VARIANT ATTRIBUTES:');
    addBold(17, 'VARIANT ATTRIBUTES:');
    add(18, '• Format: "Size: M, Color: Red"  (key: value, comma-separated)');
    add(19, '• You can add extra attributes: "Size: M, Color: Red, Material: Cotton"');
    add(20, '• The "Product Name" column must exactly match the name in the product sheet.');
    add(22, 'IMAGES:');
    addBold(22, 'IMAGES:');
    add(23, '• Product row Images column: comma-separated filenames (e.g. tshirt-red-front.jpg, tshirt-red-back.jpg)');
    add(24, '• Images must be placed in the "images/" folder inside the ZIP.');
    add(25, '• Dummy placeholder images are already included in this ZIP for reference.');
    add(26, '• Supported formats: JPG, PNG, WebP (max 5 MB each).');
    add(28, 'ID COLUMNS:');
    addBold(28, 'ID COLUMNS:');
    add(29, '• Leave ID columns blank → system creates new records.');
    add(30, '• Populate ID columns with existing UUIDs → system updates those records.');

    // ─── HSN-SAC Reference sheet ──────────────────────────────────────────────
    const sampleHsnCodes: HsnCode[] = [
      { id: '1', code: '6109', description: 'T-shirts, singlets and other vests, knitted or crocheted', recommendedGstRate: 12, isActive: true } as HsnCode,
      { id: '2', code: '6205', description: 'Men\'s or boys\' shirts, woven', recommendedGstRate: 12, isActive: true } as HsnCode,
      { id: '3', code: '6204', description: 'Women\'s or girls\' suits, dresses, skirts, trousers, woven', recommendedGstRate: 12, isActive: true } as HsnCode,
      { id: '4', code: '6403', description: 'Footwear with outer soles of rubber/plastics and leather uppers', recommendedGstRate: 18, isActive: true } as HsnCode,
      { id: '5', code: '4202', description: 'Trunks, suit-cases, handbags and similar containers', recommendedGstRate: 18, isActive: true } as HsnCode,
    ];
    await this.createHsnSacReferenceSheet(workbook, sampleHsnCodes);

    // ─── Build ZIP ────────────────────────────────────────────────────────────
    const excelBuffer = await workbook.xlsx.writeBuffer();
    console.log('✅ Template Excel buffer created, size:', Buffer.from(excelBuffer as ArrayBuffer).length);

    // Helper: create a minimal valid 1×1 PNG solid-colour placeholder
    const createDummyPng = (color: { r: number; g: number; b: number }): Buffer => {
      const crc32 = (data: Buffer): number => {
        let crc = 0xFFFFFFFF;
        for (let i = 0; i < data.length; i++) {
          crc = crc ^ data[i];
          for (let j = 0; j < 8; j++) {
            crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
          }
        }
        return crc ^ 0xFFFFFFFF;
      };
      const ihdrData = Buffer.from([
        0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01,
        0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00,
      ]);
      const ihdrCrc = crc32(ihdrData);
      const idatContent = Buffer.from([0x00, color.r, color.g, color.b]);
      const zlib = require('zlib');
      const compressed = zlib.deflateSync(idatContent);
      const idatData = Buffer.concat([Buffer.from([0x49, 0x44, 0x41, 0x54]), compressed]);
      const idatCrc = crc32(idatData);
      const iendData = Buffer.from([0x49, 0x45, 0x4E, 0x44]);
      const iendCrc = crc32(iendData);
      const u32be = (n: number) => Buffer.from([(n >>> 24) & 0xFF, (n >>> 16) & 0xFF, (n >>> 8) & 0xFF, n & 0xFF]);
      return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
        u32be(0x0D), ihdrData, u32be(ihdrCrc),
        u32be(compressed.length), idatData, u32be(idatCrc),
        u32be(0x00), iendData, u32be(iendCrc),
      ]);
    };

    const archive = archiver('zip', { zlib: { level: 9 } });
    const buffers: Buffer[] = [];
    archive.on('data', (chunk) => buffers.push(chunk));

    const zipPromise = new Promise<Buffer>((resolve, reject) => {
      archive.on('end', () => resolve(Buffer.concat(buffers)));
      archive.on('error', reject);
    });

    archive.append(Buffer.from(excelBuffer as ArrayBuffer), { name: 'products.xlsx' });

    // Add one front + one back dummy image per colour
    console.log('📦 Adding dummy images to ZIP...');
    COLORS.forEach(color => {
      const rgb = COLOR_MAP[color];
      archive.append(createDummyPng(rgb), { name: `images/tshirt-${color.toLowerCase()}-front.jpg` });
      archive.append(createDummyPng(rgb), { name: `images/tshirt-${color.toLowerCase()}-back.jpg` });
    });
    // README inside images folder
    archive.append(
      Buffer.from(
        `Dummy placeholder images (1×1 px solid colour).\n` +
        `Replace with your actual product photos.\n\n` +
        `Included files:\n` +
        COLORS.flatMap(c => [
          `  images/tshirt-${c.toLowerCase()}-front.jpg  — ${c} front`,
          `  images/tshirt-${c.toLowerCase()}-back.jpg   — ${c} back`,
        ]).join('\n') +
        `\n\nSupported formats: JPG, PNG, WebP  |  Recommended size: 1200×800 px or larger\n`,
      ),
      { name: 'images/README.txt' },
    );
    console.log(`✅ Added ${COLORS.length * 2} dummy images`);

    archive.finalize();
    const result = await zipPromise;
    console.log('✅ Template ZIP created, size:', result.length);
    return result;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // SIMPLE PHYSICAL PRODUCT IMPORT / EXPORT
  // Lean 11-column format designed for easy day-to-day use.
  // User assigns their own "Product Code" (e.g. 1, 2, SHIRT-01) which acts as
  // a stable upsert key — re-importing the same file updates existing products.
  // ────────────────────────────────────────────────────────────────────────────

  /** 11 columns — everything physical, nothing booking/GST-calculation noise */
  private getSimpleProductColumns(): any[] {
    return [
      { header: 'Product Code',     key: 'productCode',    width: 16 },
      { header: 'Product Name',     key: 'name',           width: 30 },
      { header: 'Description',      key: 'description',    width: 50 },
      { header: 'Category',         key: 'category',       width: 20 },
      { header: 'Price',            key: 'price',          width: 12 },
      { header: 'Compare At Price', key: 'compareAtPrice', width: 18 },
      { header: 'Stock',            key: 'stockQuantity',  width: 12 },
      { header: 'Status',           key: 'status',         width: 12 },
      { header: 'Images',           key: 'images',         width: 40 },
      { header: 'HSN Code',         key: 'hsnCode',        width: 15 },
      { header: 'GST Rate (%)',     key: 'gstRate',        width: 12 },
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

      let hsnCode = product.hsnCode || '';
      if (hsnCode.includes(' - ')) hsnCode = hsnCode.split(' - ')[0].trim();

      productSheet.addRow({
        productCode:    product.sku || '',
        name:           product.name,
        description:    product.description || '',
        category:       product.categories?.[0]?.name || '',
        price:          product.price,
        compareAtPrice: product.compareAtPrice || '',
        stockQuantity:  totalStock,
        status:         product.status,
        images:         imagesList,
        hsnCode,
        gstRate:        product.gstRate || '',
      });
    }

    // Status dropdown applied AFTER data rows so addRow positions are unaffected
    for (let row = 2; row <= products.length + 1; row++) {
      productSheet.getCell(row, 8).dataValidation = {
        type: 'list', allowBlank: false,
        formulae: ['"active,draft,archived"'],
        showErrorMessage: true, errorTitle: 'Invalid Status',
        error: 'Choose: active, draft or archived',
      };
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
   *  Variants are upserted by Variant Code (= variant sku field). */
  async importSimplePhysicalZip(
    vendorId: string | null,
    zipBuffer: Buffer,
  ): Promise<{ created: number; updated: number; errors: string[] }> {
    const zip = new AdmZip(zipBuffer);
    const imageMap = new Map<string, MulterFile>();
    let excelBuffer: Buffer | null = null;

    for (const entry of zip.getEntries()) {
      if (entry.entryName === 'products.xlsx') {
        excelBuffer = entry.getData();
      } else if (entry.entryName.startsWith('images/') && !entry.isDirectory) {
        const filename = path.basename(entry.entryName).toLowerCase();
        const buf = entry.getData();
        imageMap.set(filename, {
          fieldname: 'images', originalname: filename,
          encoding: '7bit', mimetype: this.getMimeType(filename),
          buffer: buf, size: buf.length,
        } as MulterFile);
      }
    }

    if (!excelBuffer) throw new Error('No products.xlsx found in ZIP');

    const resolvedVendorId = vendorId ?? (await this.getOrCreatePlatformVendorForImport()).id;

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(excelBuffer as any);

    let created = 0, updated = 0;
    const errors: string[] = [];

    // productCode → DB id, used when processing variants
    const productCodeToId = new Map<string, string>();

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
      return { created, updated, errors };
    }

    const productHeaders = buildHeaderMap(productSheet);

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
        const rawStatus      = g('Status')?.trim().toLowerCase() || 'active';
        const status         = ['active', 'draft', 'archived'].includes(rawStatus) ? rawStatus : 'active';
        const imagesCell     = g('Images')?.trim() || '';
        let hsnCode          = g('HSN Code')?.trim() || null;
        if (hsnCode?.includes(' - ')) hsnCode = hsnCode.split(' - ')[0].trim();
        let gstRate          = parseFloat(g('GST Rate (%)') || '0') || 0;

        if (!gstRate && hsnCode) {
          gstRate = (await this.getGstRateFromHsnCode(hsnCode)) ?? 18;
        } else if (!gstRate) {
          gstRate = 18;
        }

        // Resolve category
        let category: Category | null = null;
        if (categoryName) {
          category = await this.categoriesRepository.findOne({
            where: { name: categoryName, isActive: true },
          }) ?? null;
        }

        // Process images
        const productImages: string[] = [];
        if (imagesCell) {
          for (const filename of imagesCell.split(',').map(f => f.trim()).filter(Boolean)) {
            if (filename.startsWith('http://') || filename.startsWith('https://')) {
              productImages.push(filename);
            } else {
              const imageFile = imageMap.get(filename.toLowerCase());
              if (imageFile) {
                try {
                  productImages.push(await this.saveUploadedImage(imageFile, resolvedVendorId));
                } catch (e) {
                  errors.push(`Row ${rn}: Failed to upload image "${filename}": ${e.message}`);
                }
              }
            }
          }
        }

        const productData: any = {
          name,
          description,
          price,
          compareAtPrice: compareAtPrice || null,
          stockQuantity,
          sku: productCode || `${resolvedVendorId.substring(0, 8)}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          status,
          productType: 'physical',
          vendorId: resolvedVendorId,
          hsnCode,
          gstRate,
          images: productImages.length > 0 ? productImages : null,
          featuredImage: productImages.length > 0 ? productImages[0] : null,
        };

        // Upsert: find by productCode (sku), then by name within same vendor
        let existing: Product | null = null;
        if (productCode) {
          existing = await this.productsRepository.findOne({
            where: { sku: productCode },
            relations: ['categories'],
          }) ?? null;
        }
        if (!existing) {
          existing = await this.productsRepository.findOne({
            where: { name, vendorId: resolvedVendorId },
            relations: ['categories'],
          }) ?? null;
        }

        if (existing) {
          if (!vendorId || existing.vendorId === resolvedVendorId) {
            await this.productsRepository.update(existing.id, productData);
            if (category) {
              existing.categories = [category];
              await this.productsRepository.save(existing);
            }
            updated++;
            productCodeToId.set(productCode || name, existing.id);
            console.log(`[SimpleImport] Updated "${name}" (id: ${existing.id})`);
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
          productCodeToId.set(productCode || name, saved.id);
          console.log(`[SimpleImport] Created "${name}" (id: ${saved.id})`);
        }
      } catch (err) {
        errors.push(`Products Row ${rn}: ${err.message}`);
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

          const productId = productCodeToId.get(productCode);
          if (!productId) {
            errors.push(`Variants Row ${rn}: No product found with code "${productCode}"`);
            continue;
          }

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
    for (const [, productId] of productCodeToId) {
      const product = await this.productsRepository.findOne({ where: { id: productId } });
      if (product?.hasVariants) {
        const variants = await this.productVariantsRepository.find({ where: { productId } });
        const totalStock = variants.reduce((sum, v) => sum + (v.stockQuantity || 0), 0);
        await this.productsRepository.update(productId, { stockQuantity: totalStock });
        console.log(`[SimpleImport] Updated product "${product.name}" stock to ${totalStock}`);
      }
    }

    return { created, updated, errors };
  }

  /** Generate a simple template ZIP — 1 product with 4×3 size/colour variants */
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
      productCode: '1', name: 'Classic Cotton T-Shirt',
      description: 'Comfortable 100% cotton t-shirt available in multiple sizes and colours.',
      category: 'Clothing', price: 499, compareAtPrice: 699,
      stockQuantity: 0, status: 'active',
      images: 'tshirt-red-front.jpg, tshirt-red-back.jpg',
      hsnCode: '6109', gstRate: 12,
    });
    productSheet.addRow({
      productCode: '2', name: 'Leather Wallet',
      description: 'Genuine leather slim wallet with 6 card slots.',
      category: 'Accessories', price: 1299, compareAtPrice: 1599,
      stockQuantity: 50, status: 'active',
      images: 'wallet-brown.jpg',
      hsnCode: '4202', gstRate: 18,
    });
    addDropdown(productSheet, 8, 3, '"active,draft,archived"'); // Status on rows 2-3

    // ── Variants sheet ────────────────────────────────────────────────────────
    const variantSheet = workbook.addWorksheet('Variants');
    variantSheet.columns = this.getSimpleVariantColumns();
    this.styleHeaderRow(variantSheet, 'FF8E44AD');

    const sizes = ['S', 'M', 'L', 'XL'];
    const colors = ['Red', 'Blue', 'Green'];
    sizes.forEach(size => colors.forEach(color => {
      variantSheet.addRow({
        productCode: '1',
        variantCode: `1-${size}-${color.substring(0, 3).toUpperCase()}`,
        attributes:  `Size: ${size}, Color: ${color}`,
        price:          size === 'XL' ? 549 : 499,
        compareAtPrice: 699,
        stock:          Math.floor(Math.random() * 15) + 3,
        isActive:       'YES',
      });
    }));
    addDropdown(variantSheet, 7, 13, '"YES,NO"'); // Active on variant rows 2-13

    // ── Instructions sheet ────────────────────────────────────────────────────
    const instr = workbook.addWorksheet('Instructions');
    instr.getColumn(1).width = 100;
    const b = (r: number, t: string) => { instr.getCell(`A${r}`).value = t; instr.getCell(`A${r}`).font = { bold: true, size: 12 }; };
    const n = (r: number, t: string) => { instr.getCell(`A${r}`).value = t; };

    b(1,  '📋  PRODUCT IMPORT — QUICK START GUIDE');
    n(3,  'There are 2 sheets:');
    n(4,  '  • Products   — one row per product');
    n(5,  '  • Variants   — one row per size/colour combination (only needed when Has Variants)');
    b(7,  'PRODUCT CODE — your own short ID');
    n(8,  '  Enter any value you like:  1   2   3   or   SHIRT-01   WALLET-BRN');
    n(9,  '  This code is the stable key.  Re-import the same file → existing products are UPDATED, not duplicated.');
    n(10, '  The Product Code in the Variants sheet must match exactly to link variants to their product.');
    b(12, 'EVERYDAY WORKFLOW');
    n(13, '  1. First time: fill in the two sheets, zip with images folder, import.');
    n(14, '  2. Stock changed → edit the Stock cell(s), re-import.  Done.');
    n(15, '  3. New product → add a new row with a new Product Code, re-import.');
    n(16, '  4. Price update → edit Price cell, re-import.');
    b(18, 'IMAGES');
    n(19, '  • Images column: comma-separated filenames, e.g.   front.jpg, back.jpg, side.jpg');
    n(20, '  • Put the actual files in the  images/  folder inside the ZIP before importing.');
    n(21, '  • You can also paste a full https:// URL — it will be used without uploading.');
    b(23, 'VARIANTS');
    n(24, '  • Attributes format:   Size: M, Color: Red   (key: value, comma-separated)');
    n(25, '  • Variant Code must be unique across ALL variants.  Recommended pattern: PRODCODE-SIZE-COLOR');
    n(26, '  • For products WITHOUT variants: leave their rows out of the Variants sheet; enter stock on Products sheet.');
    b(28, 'HSN CODE & GST RATE');
    n(29, '  • HSN Code: numeric only, e.g.  6109   (no description text)');
    n(30, '  • GST Rate (%): number only, e.g.  12    Leave blank → auto-filled from HSN code.');

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
      archive.append(createPng(220, 50, 50),  { name: 'images/tshirt-red-front.jpg' });
      archive.append(createPng(200, 40, 40),  { name: 'images/tshirt-red-back.jpg' });
      archive.append(createPng(139, 90, 43),  { name: 'images/wallet-brown.jpg' });
      archive.append(
        Buffer.from('Replace these placeholder images with your real product photos.\nFormat: JPG, PNG or WebP | Recommended: 1200×800 px or larger\n'),
        { name: 'images/README.txt' },
      );
      archive.finalize();
    });
  }
}
