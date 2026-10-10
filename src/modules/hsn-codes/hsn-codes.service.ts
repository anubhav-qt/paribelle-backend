import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as https from 'https';
import * as http from 'http';
import { HsnCode } from './hsn-code.entity';
import { CreateHsnCodeDto, UpdateHsnCodeDto } from './dto/hsn-code.dto';
import { CBIC_HSN_CODES } from './hsn-codes.data';

type HsnRow = { code: string; description: string; gstRate: number; category?: string };

/** LIKE pattern with the user's wildcards matched literally. */
const like = (text: string, prefixOnly = false) =>
  `${prefixOnly ? '' : '%'}${text.replace(/[\%_]/g, (c) => `\${c}`)}%`;

@Injectable()
export class HsnCodesService {
  constructor(
    @InjectRepository(HsnCode)
    private hsnCodeRepository: Repository<HsnCode>,
  ) {}

  findAll(): Promise<HsnCode[]> {
    return this.hsnCodeRepository.find({
      where: { isActive: true },
      order: { code: 'ASC' },
    });
  }

  /** Code or description contains the text. */
  search(query: string, limit?: number): Promise<HsnCode[]> {
    return this.hsnCodeRepository
      .createQueryBuilder('hsn')
      .where('hsn.isActive = true')
      .andWhere('(hsn.code ILIKE :search OR hsn.description ILIKE :search)', { search: like(query) })
      .orderBy('hsn.code', 'ASC')
      .take(limit)
      .getMany();
  }

  /** Autocomplete: codes starting with the text first, then description matches. */
  async suggest(query: string, limit: number): Promise<HsnCode[]> {
    const byCode = await this.hsnCodeRepository
      .createQueryBuilder('hsn')
      .where('hsn.isActive = true')
      .andWhere('hsn.code LIKE :prefix', { prefix: like(query, true) })
      .orderBy('hsn.code', 'ASC')
      .take(limit)
      .getMany();
    if (byCode.length >= limit) return byCode;

    const byDescription = await this.hsnCodeRepository
      .createQueryBuilder('hsn')
      .where('hsn.isActive = true')
      .andWhere('hsn.description ILIKE :search', { search: like(query) })
      .orderBy('hsn.code', 'ASC')
      .take(limit)
      .getMany();
    const seen = new Set(byCode.map((h) => h.id));
    return [...byCode, ...byDescription.filter((h) => !seen.has(h.id))].slice(0, limit);
  }

  findByCode(code: string): Promise<HsnCode | null> {
    return this.hsnCodeRepository.findOne({ where: { code, isActive: true } });
  }

  async create(dto: CreateHsnCodeDto): Promise<HsnCode> {
    if (await this.hsnCodeRepository.exists({ where: { code: dto.code } })) {
      throw new ConflictException(`HSN code ${dto.code} already exists`);
    }
    return this.hsnCodeRepository.save(
      this.hsnCodeRepository.create({
        code: dto.code,
        description: dto.description,
        recommendedGstRate: dto.gstRate,
        category: dto.category,
        isActive: true,
      }),
    );
  }

  async update(id: string, dto: UpdateHsnCodeDto): Promise<HsnCode> {
    const hsnCode = await this.hsnCodeRepository.findOne({ where: { id } });
    if (!hsnCode) throw new NotFoundException('HSN code not found');

    if (dto.code !== undefined && dto.code !== hsnCode.code) {
      if (await this.hsnCodeRepository.exists({ where: { code: dto.code } })) {
        throw new ConflictException(`HSN code ${dto.code} already exists`);
      }
      hsnCode.code = dto.code;
    }
    if (dto.description !== undefined) hsnCode.description = dto.description;
    if (dto.gstRate !== undefined) hsnCode.recommendedGstRate = dto.gstRate;
    if (dto.category !== undefined) hsnCode.category = dto.category;
    return this.hsnCodeRepository.save(hsnCode);
  }

  async delete(id: string): Promise<void> {
    const { affected } = await this.hsnCodeRepository.delete(id);
    if (!affected) throw new NotFoundException('HSN code not found');
  }

  /** Inserts new codes and updates the description/rate of existing ones (inactive ones are reactivated). */
  async upsertMany(rows: HsnRow[]): Promise<{ imported: number; skipped: number; errors?: string[] }> {
    let imported = 0;
    const errors: string[] = [];
    for (const row of rows) {
      try {
        const existing = await this.hsnCodeRepository.findOne({ where: { code: row.code } });
        await this.hsnCodeRepository.save(
          this.hsnCodeRepository.create({
            ...existing,
            code: row.code,
            description: row.description,
            recommendedGstRate: row.gstRate,
            category: row.category ?? existing?.category,
            isActive: true,
          }),
        );
        imported++;
      } catch (error) {
        errors.push(`${row.code}: ${error.message}`);
      }
    }
    return { imported, skipped: errors.length, errors: errors.length ? errors.slice(0, 10) : undefined };
  }

  /** The live CBIC rate schedule, or the bundled copy when it can't be read. */
  async officialCodes(): Promise<{ codes: HsnRow[]; source: string }> {
    try {
      return await this.fetchFromCBIC();
    } catch {
      return {
        codes: CBIC_HSN_CODES,
        source: 'Bundled CBIC data (offline fallback — CBIC website was unreachable)',
      };
    }
  }

  // ── Runtime CBIC fetch ────────────────────────────────────────────────────

  private async fetchFromCBIC(): Promise<{ codes: Array<{ code: string; description: string; gstRate: number }>; source: string }> {
    const urls = [
      'https://cbic-gst.gov.in/gst-goods-services-rates.html',
      'https://cbic-gst.gov.in/hindi/gst-goods-services-rates.html',
    ];

    for (const url of urls) {
      try {
        const html = await this.httpGet(url);
        const codes = this.parseHTMLForHSNCodes(html);
        if (codes.length >= 10) {
          return { codes, source: `Live CBIC data from ${url}` };
        }
      } catch (_) {
        // try next URL
      }
    }

    throw new Error('Failed to fetch or parse CBIC website');
  }

  private httpGet(url: string, maxRedirects = 5): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const lib = parsed.protocol === 'https:' ? https : http;

      const options: https.RequestOptions = {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; paribelle-hsn-sync/1.0)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        timeout: 30000,
      };

      const req = lib.request(options, (res) => {
        if ([301, 302, 307, 308].includes(res.statusCode ?? 0) && res.headers.location && maxRedirects > 0) {
          const nextUrl = res.headers.location.startsWith('http')
            ? res.headers.location
            : `${parsed.protocol}//${parsed.hostname}${res.headers.location}`;
          resolve(this.httpGet(nextUrl, maxRedirects - 1));
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} from ${url}`));
          return;
        }

        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
        res.on('error', reject);
      });

      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
      req.end();
    });
  }

  private parseHTMLForHSNCodes(html: string): Array<{ code: string; description: string; gstRate: number }> {
    const results: Array<{ code: string; description: string; gstRate: number }> = [];
    const seen = new Set<string>();

    const stripTags = (s: string) =>
      s.replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, '').replace(/\s+/g, ' ').trim();

    // Remove scripts and styles
    const cleaned = html
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '');

    // Match all <tr> blocks (non-greedy)
    const trRegex = /<tr(?:\s[^>]*)?>[\s\S]*?<\/tr>/gi;
    const tdRegex = /<td(?:\s[^>]*)?>[\s\S]*?<\/td>/gi;

    let trMatch: RegExpExecArray | null;
    while ((trMatch = trRegex.exec(cleaned)) !== null) {
      const cells: string[] = [];
      let tdMatch: RegExpExecArray | null;
      const tdRe = new RegExp(tdRegex.source, 'gi');
      while ((tdMatch = tdRe.exec(trMatch[0])) !== null) {
        cells.push(stripTags(tdMatch[0]));
      }

      // CBIC table columns: [Schedule, SlNo, HSNCode, Description, CGST%, SGST%, IGST%, Cess]
      if (cells.length < 6) continue;

      const hsnCodeCell = cells[2] || '';
      const description = cells[3] || '';
      const igstCell = cells[6] || cells[5] || '';

      if (!hsnCodeCell || !description || !igstCell) continue;
      if (/omit/i.test(description) || !/\d/.test(hsnCodeCell)) continue;

      // Parse IGST rate (handles "5%", "5", "0.25%", "0")
      const rateMatch = igstCell.match(/(\d+(?:\.\d+)?)/);
      if (!rateMatch) continue;
      const gstRate = parseFloat(rateMatch[1]);
      if (isNaN(gstRate) || gstRate > 100) continue;

      // Handle multiple comma-separated codes e.g. "0202, 0203, 0204"
      const codeParts = hsnCodeCell.split(/[,;]/).map(p => p.trim());
      for (const part of codeParts) {
        // Extract leading digit block (ignores qualifiers like "other than", ranges like "5004 to 5006" → take first)
        const codeMatch = part.match(/^(\d[\d\s]{1,9})/);
        if (!codeMatch) continue;
        const code = codeMatch[1].replace(/\s/g, '').substring(0, 8);
        if (code.length < 2 || seen.has(code)) continue;
        seen.add(code);

        results.push({ code, description: description.substring(0, 500), gstRate });
      }
    }

    return results;
  }
}

