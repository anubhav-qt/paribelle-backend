import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as XLSX from 'xlsx';
import { HsnCodesService } from './hsn-codes.service';
import { CreateHsnCodeDto, UpdateHsnCodeDto } from './dto/hsn-code.dto';
import { AdminOnly } from '../../common/decorators/admin-only.decorator';
import { UserRole } from '../users/user.entity';

@Controller('hsn-codes')
export class HsnCodesController {
  constructor(private hsnCodesService: HsnCodesService) {}

  /** Autocomplete for the product form. Public: the CBIC schedule is public data. */
  @Get('search')
  search(@Query('q') q = '', @Query('limit') limit?: string) {
    const query = q.trim();
    if (query.length < 2 || query.length > 80) return [];
    return this.hsnCodesService.suggest(query, Math.min(Math.max(parseInt(limit ?? '', 10) || 10, 1), 25));
  }

  @Get()
  @AdminOnly()
  findAll(@Query('search') search?: string) {
    const query = search?.trim();
    return query ? this.hsnCodesService.search(query) : this.hsnCodesService.findAll();
  }

  @Get(':code')
  async findByCode(@Param('code') code: string) {
    const hsnCode = await this.hsnCodesService.findByCode(code);
    if (!hsnCode) throw new NotFoundException('HSN code not found');
    return hsnCode;
  }

  /** Refreshes every code from the official CBIC schedule; existing codes are overwritten. */
  @Post('import-preset')
  @AdminOnly(UserRole.SUPER_ADMIN)
  async importPreset() {
    const { codes, source } = await this.hsnCodesService.officialCodes();
    const result = await this.hsnCodesService.upsertMany(codes);
    return { message: 'Official CBIC HSN codes import completed', source, total: codes.length, ...result };
  }

  /** A spreadsheet (xlsx or csv) with columns HSN Code, Description, GST Rate. */
  @Post('import')
  @AdminOnly()
  @UseInterceptors(FileInterceptor('file'))
  async importSheet(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');

    let sheetRows: Record<string, unknown>[];
    try {
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      sheetRows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
    } catch {
      throw new BadRequestException('That file could not be read as a spreadsheet');
    }

    const rows: Array<{ code: string; description: string; gstRate: number }> = [];
    let invalid = 0;
    for (const row of sheetRows) {
      const code = String(row['HSN Code'] ?? row['code'] ?? row['Code'] ?? '').replace(/\s+/g, '');
      const description = String(row['Description'] ?? row['description'] ?? '').trim();
      const gstRate = Number(row['GST Rate'] ?? row['gstRate'] ?? 18);
      if (!/^\d{4,8}$/.test(code) || !description || !(gstRate >= 0 && gstRate <= 40)) {
        invalid++;
        continue;
      }
      rows.push({ code, description: description.slice(0, 500), gstRate });
    }

    const result = await this.hsnCodesService.upsertMany(rows);
    return { message: 'Import completed', ...result, skipped: result.skipped + invalid };
  }

  @Post()
  @AdminOnly()
  create(@Body() dto: CreateHsnCodeDto) {
    return this.hsnCodesService.create(dto);
  }

  @Put(':id')
  @AdminOnly()
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateHsnCodeDto) {
    return this.hsnCodesService.update(id, dto);
  }

  @Delete(':id')
  @AdminOnly(UserRole.SUPER_ADMIN)
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.hsnCodesService.delete(id);
    return { message: 'HSN code deleted successfully' };
  }
}
