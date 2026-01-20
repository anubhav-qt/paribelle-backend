import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { Product } from './product.entity';
import { ProductVariant } from './product-variant.entity';
import { Category } from '../categories/category.entity';
import { Vendor } from '../vendors/vendor.entity';
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
    @InjectRepository(HsnCode)
    private hsnCodeRepository: Repository<HsnCode>,
    private cloudinaryService: CloudinaryService,
  ) {}

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

        // Build columns - ID column FIRST and VISIBLE for update operations
        console.log(`🔧 Building columns for category: ${category.name}`);
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

        console.log(`✅ Setting ${columns.length} columns for sheet "${category.name}"`);
        console.log(`✅ First 3 columns:`, JSON.stringify(columns.slice(0, 3), null, 2));
        sheet.columns = columns;
        console.log(`✅ Sheet columns set successfully for "${category.name}"`);
        console.log(`📋 Verification - Sheet "${category.name}" column count: ${sheet.columns.length}`);
        console.log(`📋 First column header: ${sheet.getColumn(1).header}, key: ${sheet.getColumn(1).key}, width: ${sheet.getColumn(1).width}`);
        console.log(`📋 Second column header: ${sheet.getColumn(2).header}, key: ${sheet.getColumn(2).key}`);
        console.log(`📋 Third column header: ${sheet.getColumn(3).header}, key: ${sheet.getColumn(3).key}`);

        // Style header row
        sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        sheet.getRow(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF4472C4' },
        };

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

        // Add data validation (dropdowns) to columns
        const dataRowStart = 2; // After header
        const dataRowEnd = categoryProducts.length + 1;
        
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
          const hsnCount = allHsnCodes.filter(h => h.code.length !== 6).length;
          if (hsnCount > 0) {
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
        
        const variantColumns = [
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

        console.log(`✅ Setting ${variantColumns.length} columns for Variants sheet`);
        console.log(`✅ First 3 columns:`, JSON.stringify(variantColumns.slice(0, 3), null, 2));
        variantsSheet.columns = variantColumns;
        console.log(`✅ Variants sheet columns set successfully`);
        console.log(`📋 Verification - Variants column count: ${variantsSheet.columns.length}`);
        console.log(`📋 First column header: ${variantsSheet.getColumn(1).header}, key: ${variantsSheet.getColumn(1).key}, width: ${variantsSheet.getColumn(1).width}`);
        console.log(`📋 Second column header: ${variantsSheet.getColumn(2).header}, key: ${variantsSheet.getColumn(2).key}, width: ${variantsSheet.getColumn(2).width}`);
        console.log(`📋 Third column header: ${variantsSheet.getColumn(3).header}, key: ${variantsSheet.getColumn(3).key}`);

        // Style header
        variantsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        variantsSheet.getRow(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF9B59B6' }, // Purple for variants
        };

        // Add variant data
        allVariants.forEach(({ product, variant }) => {
          const attributesStr = Object.entries(variant.variantAttributes)
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

        // Add data validation (dropdowns) to Product Variants sheet
        const variantDataRowStart = 2;
        const variantDataRowEnd = allVariants.length + 1;

        // Active status dropdown for variants
        const activeColumn = variantsSheet.columns.findIndex(c => c.key === 'isActive') + 1;
        if (activeColumn > 0) {
          for (let row = variantDataRowStart; row <= variantDataRowEnd + 50; row++) {
            variantsSheet.getCell(row, activeColumn).dataValidation = {
              type: 'list',
              allowBlank: false,
              formulae: ['"YES,NO"'],
              showErrorMessage: true,
              errorTitle: 'Invalid Value',
              error: 'Please select: YES or NO',
            };
          }
        }

        console.log(`Variants sheet created with ${allVariants.length} variants`);
      }

      // Create HSN/SAC Codes Reference sheet
      console.log('Creating HSN/SAC Codes Reference sheet...');
      const hsnRefSheet = workbook.addWorksheet('HSN-SAC Reference');
      
      // Add header row
      hsnRefSheet.columns = [
        { header: 'Code with Description', key: 'codeWithDesc', width: 50 },
        { header: 'Full Description', key: 'description', width: 60 },
        { header: 'GST Rate (%)', key: 'gstRate', width: 12 },
        { header: 'Type', key: 'type', width: 10 },
      ];
      
      // Style header
      hsnRefSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      hsnRefSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2E7D32' }, // Green for reference data
      };
      
      // Add all HSN/SAC codes
      allHsnCodes.forEach(hsn => {
        const type = hsn.code.length === 6 ? 'SAC' : 'HSN';
        // Format code with description for dropdown (50 chars max)
        const shortDesc = hsn.description.substring(0, 50);
        const codeWithDesc = `${hsn.code} - ${shortDesc}${hsn.description.length > 50 ? '...' : ''}`;
        
        hsnRefSheet.addRow({
          codeWithDesc: codeWithDesc,
          description: hsn.description,
          gstRate: hsn.recommendedGstRate,
          type: type,
        });
      });
      
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
      
      // Get the Excel buffer first
      const excelBuffer = await this.exportToExcel(vendorId);
      
      // Get products to extract images
      const whereCondition = vendorId ? { vendorId } : {};
      const products = await this.productsRepository.find({
        where: whereCondition,
      });

      console.log(`Found ${products.length} products for ZIP export`);
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

    // Create a map of uploaded images by filename
    const imageMap = new Map<string, MulterFile>();
    imageFiles.forEach(file => {
      imageMap.set(file.originalname.toLowerCase(), file);
    });

    // Get all categories to map sheet names to category IDs
    const categories = await this.categoriesRepository.find({ where: { isActive: true } });
    const categoryMap = new Map<string, Category>();
    categories.forEach(cat => {
      categoryMap.set(cat.name, cat);
      categoryMap.set(cat.name.substring(0, 30), cat); // Handle truncated names
    });

    let created = 0;
    let updated = 0;
    const errors: string[] = [];
    const createdCategories: string[] = [];
    
    // First pass: Process product sheets to create/update products
    const processedProductIds = new Set<string>();
    const productNameToIdMap = new Map<string, string>(); // Track product names -> IDs for variant lookup

    // Process each worksheet (except Instructions and Product Variants on first pass)
    for (const worksheet of workbook.worksheets) {
      const sheetName = worksheet.name;
      
      // Skip instructions and variants sheets on first pass (handle variants after products)
      if (sheetName === 'Instructions' || sheetName === 'Product Variants') continue;

      // Find the category for this sheet
      let category = categoryMap.get(sheetName);
      const isUncategorized = sheetName === 'Uncategorized';
      
      // Auto-create category if not found (except for Uncategorized)
      if (!category && !isUncategorized) {
        try {
          console.log(`[Import] Creating new category: ${sheetName}`);
          const slug = sheetName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          const maxSortOrder = await this.categoriesRepository
            .createQueryBuilder('category')
            .select('MAX(category.sortOrder)', 'max')
            .getRawOne();
          
          const newCategory = this.categoriesRepository.create({
            name: sheetName,
            slug: slug,
            description: `Auto-created from Excel import`,
            isActive: true,
            sortOrder: (maxSortOrder?.max || 0) + 1,
          });
          
          const savedCategories = await this.categoriesRepository.save(newCategory);
          category = Array.isArray(savedCategories) ? savedCategories[0] : savedCategories;
          if (category) {
            categoryMap.set(sheetName, category);
            createdCategories.push(sheetName);
            console.log(`[Import] Created category: ${sheetName} (ID: ${category.id})`);
          }
        } catch (error) {
          errors.push(`Sheet "${sheetName}": Failed to create category - ${error.message}`);
          continue;
        }
      }
      
      if (!category && !isUncategorized) {
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
          const productType = getCellValue(row, 'Product Type')?.toString().trim().toLowerCase() || 'physical';
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
          let finalVendorId: string | null = vendorId;
          if (!finalVendorId) {
            // Get or create platform vendor for admin import
            let platformVendor = await this.vendorsRepository.findOne({ where: { slug: 'marketplace-platform' } });
            
            if (!platformVendor) {
              // Create platform vendor if it doesn't exist
              try {
                platformVendor = this.vendorsRepository.create({
                  storeName: 'Platform Store',
                  slug: 'marketplace-platform',
                  businessName: 'Platform Business',
                  contactEmail: 'platform@marketplace.com',
                  contactPhone: '0000000000',
                  status: 'active' as any,
                  kycStatus: 'approved' as any,
                });
                platformVendor = await this.vendorsRepository.save(platformVendor);
                console.log('[Import] Created platform vendor for admin imports');
              } catch (err) {
                errors.push(`Sheet "${sheetName}", Row ${rowNumber}: Failed to create platform vendor - ${err.message}`);
                return;
              }
            }
            
            finalVendorId = platformVendor?.id || null;
            if (!finalVendorId) {
              errors.push(`Sheet "${sheetName}", Row ${rowNumber}: No vendor ID provided and platform vendor not available`);
              return;
            }
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
            categories: category ? [category] : [],
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
                if (category) {
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
          
          // Method 1: Parse from "Attributes" column (e.g., "Size: xs, Color: black, Weight: 250g")
          if (attributesStr) {
            attributesStr.split(',').forEach(attr => {
              const [key, value] = attr.split(':').map(s => s.trim());
              if (key && value) {
                variantAttributes[key] = value;
              }
            });
          }
          
          // Method 2: Parse from individual attribute columns (Size, Color, etc.)
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
              // Create new variant
              // Verify the product exists and belongs to the vendor
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
                const newVariant = this.productVariantsRepository.create(variantData);
                await this.productVariantsRepository.save(newVariant);
                
                // Update product to mark it has variants
                if (!product.hasVariants && finalProductId) {
                  await this.productsRepository.update(finalProductId, { hasVariants: true });
                }
                
                variantsCreated++;
                console.log(`Created variant: ${sku}`);
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
}
