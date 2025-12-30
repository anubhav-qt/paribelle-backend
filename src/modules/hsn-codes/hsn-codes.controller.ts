import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpException,
  HttpStatus,
  Query,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { HsnCodesService, CreateHsnCodeDto, UpdateHsnCodeDto } from './hsn-codes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/user.entity';
import * as XLSX from 'xlsx';

@Controller('hsn-codes')
@UseGuards(JwtAuthGuard)
export class HsnCodesController {
  constructor(private hsnCodesService: HsnCodesService) {}

  // Import route must come BEFORE generic POST route
  @Post('import')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  async importExcel(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
    }

    try {
      // Parse Excel file
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const row of data as any[]) {
        try {
          // Support different column name formats
          const code = row['HSN Code'] || row['code'] || row['Code'] || row['HSNCode'];
          const description = row['Description'] || row['description'];
          const gstRate = parseFloat(row['GST Rate'] || row['gstRate'] || row['GSTRate'] || '18');

          if (!code || !description) {
            skipped++;
            errors.push(`Row skipped: Missing code or description`);
            continue;
          }

          // Check if already exists
          const existing = await this.hsnCodesService.findByCode(code.toString());
          if (existing) {
            // Update existing
            await this.hsnCodesService.update(existing.id, {
              description: description.toString(),
              gstRate,
            });
            imported++;
          } else {
            // Create new
            await this.hsnCodesService.create({
              code: code.toString(),
              description: description.toString(),
              gstRate,
            });
            imported++;
          }
        } catch (error) {
          skipped++;
          errors.push(`Error processing row: ${error.message}`);
        }
      }

      return {
        message: 'Import completed',
        imported,
        skipped,
        errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
      };
    } catch (error) {
      console.error('Error importing HSN codes:', error);
      throw new HttpException(
        `Failed to import HSN codes: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async findAll(@Query('search') search?: string) {
    try {
      if (search) {
        return await this.hsnCodesService.search(search);
      }
      return await this.hsnCodesService.findAll();
    } catch (error) {
      console.error('Error fetching HSN codes:', error);
      throw new HttpException(
        'Failed to fetch HSN codes',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':code')
  async findByCode(@Param('code') code: string) {
    try {
      const hsnCode = await this.hsnCodesService.findByCode(code);
      if (!hsnCode) {
        throw new HttpException('HSN code not found', HttpStatus.NOT_FOUND);
      }
      return hsnCode;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.error('Error fetching HSN code:', error);
      throw new HttpException(
        'Failed to fetch HSN code',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async create(@Body() createDto: CreateHsnCodeDto) {
    try {
      // Check if code already exists
      const existing = await this.hsnCodesService.findByCode(createDto.code);
      if (existing) {
        throw new HttpException(
          'HSN code already exists',
          HttpStatus.CONFLICT,
        );
      }

      return await this.hsnCodesService.create(createDto);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.error('Error creating HSN code:', error);
      throw new HttpException(
        'Failed to create HSN code',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async update(@Param('id') id: string, @Body() updateDto: UpdateHsnCodeDto) {
    try {
      return await this.hsnCodesService.update(id, updateDto);
    } catch (error) {
      console.error('Error updating HSN code:', error);
      throw new HttpException(
        'Failed to update HSN code',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async delete(@Param('id') id: string) {
    try {
      await this.hsnCodesService.delete(id);
      return { message: 'HSN code deleted successfully' };
    } catch (error) {
      console.error('Error deleting HSN code:', error);
      throw new HttpException(
        'Failed to delete HSN code',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
