import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { Product } from './product.entity';
import { ProductVariant } from './product-variant.entity';
import { Category } from '../categories/category.entity';
import { Vendor } from '../vendors/vendor.entity';
import { HsnCode } from './hsn-code.entity';
import * as fs from 'fs';
import * as path from 'path';
import archiver from 'archiver';
import AdmZip from 'adm-zip';

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

        // Build columns - NO IDs, NO SLUGS, user-editable only
        const columns: any[] = [
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

        // Add category-specific attribute columns
        categoryFilters.forEach(filter => {
          columns.push({
            header: filter.label,
            key: `attr_${filter.id}`,
            width: 20,
          });
        });

        // Hidden column for tracking existing products
        columns.push({
          header: '_ID',
          key: '_id',
          width: 10,
          hidden: true,
        });

        sheet.columns = columns;

        // Actually hide the _ID column (ExcelJS requires this)
        sheet.getColumn(columns.length).hidden = true;

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
            mrp: product.mrp || '',
            basePrice: product.basePrice || '',
            gstAmount: product.gstAmount || '',
            costPerItem: product.costPerItem || '',
            _id: product.id, // Hidden ID for updates
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
        const sheet = workbook.addWorksheet('Uncategorized');

        const columns: any[] = [
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
          { header: '_ID', key: '_id', width: 10, hidden: true },
        ];

        sheet.columns = columns;

        // Actually hide the _ID column (ExcelJS requires this)
        sheet.getColumn(columns.length).hidden = true;

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
        console.log(`Creating Variants sheet with ${allVariants.length} variants...`);
        const variantsSheet = workbook.addWorksheet('Product Variants');
        
        variantsSheet.columns = [
          { header: 'Product Name', key: 'productName', width: 30 },
          { header: 'Variant SKU', key: 'sku', width: 30 },
          { header: 'Variant Attributes', key: 'attributes', width: 40 },
          { header: 'Price', key: 'price', width: 12 },
          { header: 'Compare At Price', key: 'compareAtPrice', width: 18 },
          { header: 'Stock', key: 'stock', width: 12 },
          { header: 'Active', key: 'isActive', width: 10 },
          { header: '_PRODUCT_ID', key: '_productId', width: 10, hidden: true },
          { header: '_VARIANT_ID', key: '_variantId', width: 10, hidden: true },
        ];

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
            productName: product.name,
            sku: variant.sku,
            attributes: attributesStr,
            price: variant.price,
            compareAtPrice: variant.compareAtPrice || '',
            stock: variant.stockQuantity,
            isActive: variant.isActive ? 'YES' : 'NO',
            _productId: product.id,
            _variantId: variant.id,
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

        // Hide ID columns
        variantsSheet.getColumn(8).hidden = true;
        variantsSheet.getColumn(9).hidden = true;

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
      instructionsSheet.getCell('A32').value = '• Leave the _ID column empty (it\'s hidden and auto-generated)';
      instructionsSheet.getCell('A33').value = '• New products will be assigned to that sheet\'s category';
      
      instructionsSheet.getCell('A35').value = 'PRODUCT IMAGES:';
      instructionsSheet.getCell('A35').font = { bold: true };
      instructionsSheet.getCell('A36').value = '• If you exported as ZIP, images are in the "images" folder';
      instructionsSheet.getCell('A37').value = '• In the Images column, enter comma-separated filenames (e.g., "image1.jpg, image2.png")';
      instructionsSheet.getCell('A38').value = '• You can reuse existing images or add new ones';
      instructionsSheet.getCell('A39').value = '• Supported formats: JPG, PNG, WEBP (max 5MB per image)';
      
      instructionsSheet.getCell('A41').value = 'PRICING & GST CONFIGURATION:';
      instructionsSheet.getCell('A41').font = { bold: true };
      instructionsSheet.getCell('A42').value = '• HSN Code/SAC Code: For goods/services GST classification (select from HSN-SAC Reference sheet)';
      instructionsSheet.getCell('A43').value = '• GST Rate (%): Auto-filled from HSN/SAC code when available, or select from dropdown (0, 5, 12, 18, 28)';
      instructionsSheet.getCell('A44').value = '• GST Rate is editable - system suggestion can be overridden if needed';
      instructionsSheet.getCell('A45').value = '• Price Type: "mrp_with_gst" or "selling_price_without_gst"';
      instructionsSheet.getCell('A46').value = '• MRP: Maximum Retail Price (if using mrp_with_gst)';
      instructionsSheet.getCell('A47').value = '• Base Price: Price before GST (auto-calculated)';
      instructionsSheet.getCell('A48').value = '• GST Amount: Tax amount (auto-calculated)';
      instructionsSheet.getCell('A49').value = '• Cost Per Item: Your cost/purchase price';
      
      instructionsSheet.getCell('A45').value = 'PRODUCT VARIANTS:';
      instructionsSheet.getCell('A45').font = { bold: true };
      instructionsSheet.getCell('A46').value = '• Products with variants are marked "YES" in the "Has Variants" column';
      instructionsSheet.getCell('A47').value = '• Variant products show price ranges (e.g., "3.00 - 333.00") and total stock across all variants';
      instructionsSheet.getCell('A48').value = '• Check the "Product Variants" sheet for detailed variant information';
      instructionsSheet.getCell('A49').value = '• Each variant has its own SKU, price, stock, and attributes (Size, Color, etc.)';
      instructionsSheet.getCell('A50').value = '• You can edit variant prices, stock, and active status in the "Product Variants" sheet';
      instructionsSheet.getCell('A51').value = '• Variants will be automatically created/updated during import';
      
      instructionsSheet.getCell('A53').value = 'IMPORTING:';
      instructionsSheet.getCell('A53').font = { bold: true };
      instructionsSheet.getCell('A54').value = 'Option 1: Import as ZIP (Recommended)';
      instructionsSheet.getCell('A55').value = '• Keep this Excel file in the ZIP with the images folder';
      instructionsSheet.getCell('A56').value = '• Upload the entire ZIP file - everything is imported together';
      instructionsSheet.getCell('A57').value = '• Both products and variants will be imported automatically';
      instructionsSheet.getCell('A58').value = '';
      instructionsSheet.getCell('A59').value = 'Option 2: Import Excel + Images separately';
      instructionsSheet.getCell('A60').value = '• Upload the Excel file and select image files individually';
      instructionsSheet.getCell('A61').value = '• The system will match filenames from Excel with uploaded files';

      instructionsSheet.getColumn('A').width = 80;
      console.log('Instructions sheet created');

      console.log('Generating Excel buffer...');
      const buffer = await workbook.xlsx.writeBuffer();
      console.log('Excel buffer generated, converting to Node Buffer...');
      const nodeBuffer = Buffer.from(buffer);
      console.log(`Excel export complete. Buffer size: ${nodeBuffer.length} bytes`);
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
      const imageFiles: Express.Multer.File[] = [];

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
          } as Express.Multer.File);
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
    imageFiles: Express.Multer.File[],
  ): Promise<{ created: number; updated: number; errors: string[] }> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    // If vendorId is null (admin importing all), we need to handle this differently
    // For now, throw an error as importing all products requires vendor specification in Excel
    if (!vendorId) {
      throw new Error('Import for all vendors requires vendor IDs to be specified in the Excel file');
    }

    const vendor = await this.vendorsRepository.findOne({ where: { id: vendorId } });
    if (!vendor) {
      throw new Error('Vendor not found');
    }

    // Create a map of uploaded images by filename
    const imageMap = new Map<string, Express.Multer.File>();
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
    
    // First pass: Process product sheets to create/update products
    const processedProductIds = new Set<string>();

    // Process each worksheet (except Instructions and Product Variants on first pass)
    for (const worksheet of workbook.worksheets) {
      const sheetName = worksheet.name;
      
      // Skip instructions and variants sheets on first pass (handle variants after products)
      if (sheetName === 'Instructions' || sheetName === 'Product Variants') continue;

      // Find the category for this sheet
      const category = categoryMap.get(sheetName);
      const isUncategorized = sheetName === 'Uncategorized';
      
      if (!category && !isUncategorized) {
        errors.push(`Sheet "${sheetName}": No matching category found`);
        continue;
      }

      // Get category-specific filters if available
      const categoryFilters = category?.filterConfig?.filters?.filter(f => f.id !== 'priceRange') || [];

      // Collect all rows to process (skip header and reference rows)
      const rowsToProcess: { row: ExcelJS.Row; rowNumber: number }[] = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header
        const firstCell = row.getCell(1).value?.toString().trim();
        if (!firstCell || firstCell.includes('options:')) return; // Skip reference rows
        rowsToProcess.push({ row, rowNumber });
      });

      // Process each row asynchronously
      const rowPromises = rowsToProcess.map(async ({ row, rowNumber }) => {

        try {
          const _id = row.getCell('_id').value?.toString().trim();
          const name = row.getCell('name').value?.toString().trim();
          const description = row.getCell('description').value?.toString().trim();
          const imagesCell = row.getCell('images').value?.toString().trim();
          const price = parseFloat(row.getCell('price').value?.toString() || '0');
          const compareAtPrice = parseFloat(row.getCell('compareAtPrice').value?.toString() || '0');
          const stockQuantity = parseInt(row.getCell('stockQuantity').value?.toString() || '0');
          const status = row.getCell('status').value?.toString().trim() || 'active';
          
          // Read GST/Pricing fields
          // Extract just the code part if format is "code - description"
          let hsnCode = row.getCell('hsnCode').value?.toString().trim() || null;
          if (hsnCode && hsnCode.includes(' - ')) {
            hsnCode = hsnCode.split(' - ')[0].trim();
          }
          
          let sacCode = row.getCell('sacCode').value?.toString().trim() || null;
          if (sacCode && sacCode.includes(' - ')) {
            sacCode = sacCode.split(' - ')[0].trim();
          }
          
          let gstRate = parseFloat(row.getCell('gstRate').value?.toString() || '0');
          const priceType = row.getCell('priceType').value?.toString().trim() || 'selling_price_without_gst';
          const mrp = parseFloat(row.getCell('mrp').value?.toString() || '0') || null;
          const basePrice = parseFloat(row.getCell('basePrice').value?.toString() || '0') || null;
          const gstAmount = parseFloat(row.getCell('gstAmount').value?.toString() || '0') || null;
          const costPerItem = parseFloat(row.getCell('costPerItem').value?.toString() || '0') || null;

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

          // Process images
          const productImages: string[] = [];
          if (imagesCell) {
            const imageFilenames = imagesCell.split(',').map(f => f.trim()).filter(f => f.length > 0);
            for (const filename of imageFilenames) {
              const imageFile = imageMap.get(filename.toLowerCase());
              if (imageFile) {
                // Save the image to the uploads directory
                const uploadPath = this.saveUploadedImage(imageFile, vendorId);
                productImages.push(uploadPath);
              } else {
                errors.push(`Sheet "${sheetName}", Row ${rowNumber}: Image "${filename}" not found in uploaded files`);
              }
            }
          }

          // Collect attributes from category-specific columns
          const attributes: Record<string, any> = {};
          categoryFilters.forEach(filter => {
            const cellValue = row.getCell(`attr_${filter.id}`).value?.toString().trim();
            if (cellValue) {
              attributes[filter.id] = cellValue;
            }
          });

          // Prepare product data
          const productData: any = {
            name,
            slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
            description: description || '',
            price,
            compareAtPrice: compareAtPrice || null,
            stockQuantity,
            sku: `${vendorId.substring(0, 8)}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            status,
            productType: 'physical',
            vendorId,
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
            this.productsRepository.findOne({ where: { id: _id } }).then(existingProduct => {
              if (existingProduct && existingProduct.vendorId === vendorId) {
                this.productsRepository.update(_id, productData).then(() => {
                  // Update categories relationship
                  if (category) {
                    existingProduct.categories = [category];
                    this.productsRepository.save(existingProduct);
                  }
                  updated++;
                }).catch(err => {
                  errors.push(`Sheet "${sheetName}", Row ${rowNumber}: Update failed - ${err.message}`);
                });
              } else {
                errors.push(`Sheet "${sheetName}", Row ${rowNumber}: Product not found or doesn't belong to vendor`);
              }
            }).catch(err => {
              errors.push(`Sheet "${sheetName}", Row ${rowNumber}: ${err.message}`);
            });
          } else {
            // Create new product
            const product = this.productsRepository.create(productData);
            this.productsRepository.save(product).then(() => {
              created++;
            }).catch(err => {
              errors.push(`Sheet "${sheetName}", Row ${rowNumber}: Create failed - ${err.message}`);
            });
          }

        } catch (error) {
          errors.push(`Sheet "${sheetName}", Row ${rowNumber}: ${error.message}`);
        }
      });

      // Wait for all row processing to complete for this sheet
      await Promise.all(rowPromises);
    }

    // Second pass: Process Product Variants sheet
    const variantsSheet = workbook.getWorksheet('Product Variants');
    if (variantsSheet) {
      console.log('Processing Product Variants sheet...');
      let variantsCreated = 0;
      let variantsUpdated = 0;

      // Process each variant row
      const variantPromises: Promise<void>[] = [];
      
      variantsSheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header

        try {
          const productId = row.getCell('_productId').value?.toString().trim();
          const variantId = row.getCell('_variantId').value?.toString().trim();
          const sku = row.getCell('sku').value?.toString().trim();
          const attributesStr = row.getCell('attributes').value?.toString().trim();
          const price = parseFloat(row.getCell('price').value?.toString() || '0');
          const compareAtPrice = parseFloat(row.getCell('compareAtPrice').value?.toString() || '0');
          const stock = parseInt(row.getCell('stock').value?.toString() || '0');
          const isActiveStr = row.getCell('isActive').value?.toString().trim()?.toUpperCase();
          const isActive = isActiveStr === 'YES' || isActiveStr === 'TRUE';

          if (!productId || !sku) {
            errors.push(`Variants Sheet, Row ${rowNumber}: Missing product ID or SKU`);
            return;
          }

          // Parse attributes string (e.g., "Size: xs, Color: black, Weight: 250g")
          const variantAttributes: Record<string, string> = {};
          if (attributesStr) {
            attributesStr.split(',').forEach(attr => {
              const [key, value] = attr.split(':').map(s => s.trim());
              if (key && value) {
                variantAttributes[key] = value;
              }
            });
          }

          const variantData: any = {
            productId,
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

          const promise = (async () => {
            if (variantId && variantId.length > 0) {
              // Update existing variant
              const existingVariant = await this.productVariantsRepository.findOne({
                where: { id: variantId },
                relations: ['product'],
              });

              if (existingVariant && existingVariant.product.vendorId === vendorId) {
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
                where: { id: productId },
              });

              if (product && product.vendorId === vendorId) {
                const newVariant = this.productVariantsRepository.create(variantData);
                await this.productVariantsRepository.save(newVariant);
                
                // Update product to mark it has variants
                if (!product.hasVariants) {
                  await this.productsRepository.update(productId, { hasVariants: true });
                }
                
                variantsCreated++;
                console.log(`Created variant: ${sku}`);
              } else {
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

    return { created, updated, errors };
  }

  private saveUploadedImage(file: Express.Multer.File, vendorId: string): string {
    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'products', vendorId);
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Generate unique filename
    const ext = path.extname(file.originalname);
    const filename = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${ext}`;
    const filePath = path.join(uploadsDir, filename);

    // Write file
    fs.writeFileSync(filePath, file.buffer);

    // Return relative path for storage
    return `/uploads/products/${vendorId}/${filename}`;
  }
}
