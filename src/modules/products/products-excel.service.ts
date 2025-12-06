import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { Product } from './product.entity';
import { Category } from '../categories/category.entity';
import { Vendor } from '../vendors/vendor.entity';
import * as fs from 'fs';
import * as path from 'path';
import archiver from 'archiver';
import AdmZip from 'adm-zip';

@Injectable()
export class ProductsExcelService {
  constructor(
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    @InjectRepository(Category)
    private categoriesRepository: Repository<Category>,
    @InjectRepository(Vendor)
    private vendorsRepository: Repository<Vendor>,
  ) {}

  async exportToExcel(vendorId: string): Promise<Buffer> {
    try {
      console.log('Starting Excel export for vendor:', vendorId);
      const workbook = new ExcelJS.Workbook();
      
      // Get vendor's products with categories
      console.log('Fetching products...');
      const products = await this.productsRepository.find({
        where: { vendorId },
        relations: ['categories'],
      });

      console.log(`Found ${products.length} products for vendor ${vendorId}`);

      // Get all categories with their filter configurations
      console.log('Fetching categories...');
      const categories = await this.categoriesRepository.find({
        where: { isActive: true },
      });
      console.log(`Found ${categories.length} categories`);

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
          uncategorizedProducts.push(product);
        }
      });

      // Create a sheet for each category with products
      productsByCategory.forEach((categoryProducts, categoryId) => {
        const category = categories.find(c => c.id === categoryId);
        if (!category) return;

        const sheetName = category.name.substring(0, 30); // Excel sheet name limit
        const sheet = workbook.addWorksheet(sheetName);

        // Get category-specific filters
        const categoryFilters = category.filterConfig?.filters?.filter(f => f.id !== 'priceRange') || [];

        // Build columns - NO IDs, NO SLUGS, user-editable only
        const columns: any[] = [
          { header: 'Product Name', key: 'name', width: 30 },
          { header: 'Description', key: 'description', width: 50 },
          { header: 'Images (comma-separated filenames)', key: 'images', width: 40 },
          { header: 'Price', key: 'price', width: 12 },
          { header: 'Compare At Price (Optional)', key: 'compareAtPrice', width: 18 },
          { header: 'Stock Quantity', key: 'stockQuantity', width: 15 },
          { header: 'Status (active/draft/archived)', key: 'status', width: 25 },
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
        categoryProducts.forEach(product => {
          const rowData: any = {
            name: product.name,
            description: product.description || '',
            images: product.images ? product.images.map(img => path.basename(img)).join(', ') : '',
            price: product.price,
            compareAtPrice: product.compareAtPrice || '',
            stockQuantity: product.stockQuantity,
            status: product.status,
            _id: product.id, // Hidden ID for updates
          };

          // Add attribute values
          if (product.attributes) {
            Object.entries(product.attributes).forEach(([key, value]) => {
              if (key !== 'booking') {
                rowData[`attr_${key}`] = value;
              }
            });
          }

          sheet.addRow(rowData);
        });

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
      });

      // Create uncategorized products sheet if any
      if (uncategorizedProducts.length > 0) {
        const sheet = workbook.addWorksheet('Uncategorized');

        const columns: any[] = [
          { header: 'Product Name', key: 'name', width: 30 },
          { header: 'Description', key: 'description', width: 50 },
          { header: 'Images (comma-separated filenames)', key: 'images', width: 40 },
          { header: 'Price', key: 'price', width: 12 },
          { header: 'Compare At Price (Optional)', key: 'compareAtPrice', width: 18 },
          { header: 'Stock Quantity', key: 'stockQuantity', width: 15 },
          { header: 'Status (active/draft/archived)', key: 'status', width: 25 },
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

        uncategorizedProducts.forEach(product => {
          sheet.addRow({
            name: product.name,
            description: product.description || '',
            images: product.images ? product.images.map(img => path.basename(img)).join(', ') : '',
            price: product.price,
            compareAtPrice: product.compareAtPrice || '',
            stockQuantity: product.stockQuantity,
            status: product.status,
            _id: product.id,
          });
        });
      }

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
      
      instructionsSheet.getCell('A8').value = 'EDITING PRODUCTS:';
      instructionsSheet.getCell('A8').font = { bold: true };
      instructionsSheet.getCell('A9').value = '• Modify any visible field (name, price, description, etc.)';
      instructionsSheet.getCell('A10').value = '• For filter fields (Size, Brand, Color, etc.), use values shown at bottom';
      instructionsSheet.getCell('A11').value = '• You can also enter new values - they will be added to the system';
      instructionsSheet.getCell('A12').value = '• Status must be: active, draft, or archived';
      
      instructionsSheet.getCell('A14').value = 'ADDING NEW PRODUCTS:';
      instructionsSheet.getCell('A14').font = { bold: true };
      instructionsSheet.getCell('A15').value = '• Add a new row in the appropriate category sheet';
      instructionsSheet.getCell('A16').value = '• Fill in all required fields (name, price, stock)';
      instructionsSheet.getCell('A17').value = '• Leave the _ID column empty (it\'s hidden and auto-generated)';
      instructionsSheet.getCell('A18').value = '• New products will be assigned to that sheet\'s category';
      
      instructionsSheet.getCell('A20').value = 'PRODUCT IMAGES:';
      instructionsSheet.getCell('A20').font = { bold: true };
      instructionsSheet.getCell('A21').value = '• If you exported as ZIP, images are in the "images" folder';
      instructionsSheet.getCell('A22').value = '• In the Images column, enter comma-separated filenames (e.g., "image1.jpg, image2.png")';
      instructionsSheet.getCell('A23').value = '• You can reuse existing images or add new ones';
      instructionsSheet.getCell('A24').value = '• Supported formats: JPG, PNG, WEBP (max 5MB per image)';
      
      instructionsSheet.getCell('A26').value = 'IMPORTING:';
      instructionsSheet.getCell('A26').font = { bold: true };
      instructionsSheet.getCell('A27').value = 'Option 1: Import as ZIP (Recommended)';
      instructionsSheet.getCell('A28').value = '• Keep this Excel file in the ZIP with the images folder';
      instructionsSheet.getCell('A29').value = '• Upload the entire ZIP file - everything is imported together';
      instructionsSheet.getCell('A30').value = '';
      instructionsSheet.getCell('A31').value = 'Option 2: Import Excel + Images separately';
      instructionsSheet.getCell('A32').value = '• Upload the Excel file and select image files individually';
      instructionsSheet.getCell('A33').value = '• The system will match filenames from Excel with uploaded files';

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

  async exportToZip(vendorId: string): Promise<Buffer> {
    try {
      console.log('Starting ZIP export for vendor:', vendorId);
      
      // Get the Excel buffer first
      const excelBuffer = await this.exportToExcel(vendorId);
      
      // Get vendor's products to extract images
      const products = await this.productsRepository.find({
        where: { vendorId },
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
          if (product.images && product.images.length > 0) {
            console.log(`Product "${product.name}" has ${product.images.length} images:`, product.images);
            product.images.forEach(imagePath => {
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

  async importFromZip(vendorId: string, zipBuffer: Buffer): Promise<{ created: number; updated: number; errors: string[] }> {
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
    vendorId: string,
    buffer: Buffer,
    imageFiles: Express.Multer.File[],
  ): Promise<{ created: number; updated: number; errors: string[] }> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

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

    // Process each worksheet (except Instructions)
    workbook.eachSheet((worksheet, sheetId) => {
      const sheetName = worksheet.name;
      
      // Skip instructions sheet
      if (sheetName === 'Instructions') return;

      // Find the category for this sheet
      const category = categoryMap.get(sheetName);
      const isUncategorized = sheetName === 'Uncategorized';
      
      if (!category && !isUncategorized) {
        errors.push(`Sheet "${sheetName}": No matching category found`);
        return;
      }

      // Get category-specific filters if available
      const categoryFilters = category?.filterConfig?.filters?.filter(f => f.id !== 'priceRange') || [];

      // Process each row (skip header)
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header
        
        // Skip reference rows at bottom (filter options)
        const firstCell = row.getCell(1).value?.toString().trim();
        if (!firstCell || firstCell.includes('options:')) return;

        try {
          const _id = row.getCell('_id').value?.toString().trim();
          const name = row.getCell('name').value?.toString().trim();
          const description = row.getCell('description').value?.toString().trim();
          const imagesCell = row.getCell('images').value?.toString().trim();
          const price = parseFloat(row.getCell('price').value?.toString() || '0');
          const compareAtPrice = parseFloat(row.getCell('compareAtPrice').value?.toString() || '0');
          const stockQuantity = parseInt(row.getCell('stockQuantity').value?.toString() || '0');
          const status = row.getCell('status').value?.toString().trim() || 'active';

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
    });

    // Wait a bit for async operations to complete
    await new Promise(resolve => setTimeout(resolve, 2000));

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
