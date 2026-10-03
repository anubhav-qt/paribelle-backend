import { ArgumentsHost, BadRequestException, Catch, ConflictException, HttpException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { QueryFailedError } from 'typeorm';

type PgError = { code?: string; detail?: string; column?: string; table?: string; message?: string };

/**
 * A request the database refused, answered as the caller's mistake (4xx) with what was
 * wrong, instead of a bare 500: a value that's already taken (a SKU, a slug), a required
 * field left out, a reference to something that isn't there, or a value of the wrong
 * shape. Anything else stays a 500, as before.
 */
@Catch(QueryFailedError)
export class QueryFailedFilter extends BaseExceptionFilter {
  catch(err: QueryFailedError, host: ArgumentsHost) {
    super.catch(toHttp((err as QueryFailedError & { driverError?: PgError }).driverError ?? {}) ?? err, host);
  }
}

function toHttp(pg: PgError): HttpException | null {
  // e.g. Key (sku)=(PB-045-M) already exists.
  const detail = pg.detail?.replace(/^Key /, '').trim();
  switch (pg.code) {
    case '23505':
      return new ConflictException(detail ? `Already taken: ${detail}` : 'Something with the same unique value already exists.');
    case '23502':
      return new BadRequestException(`${pg.column ?? 'A required field'} is required${pg.table ? ` (${pg.table})` : ''}.`);
    case '23503':
      return new BadRequestException(detail ? `Refers to something that isn't there: ${detail}` : "Refers to something that isn't there.");
    case '22P02': // invalid input syntax (a malformed uuid, number or enum value)
    case '22001': // too long for its column
    case '22003': // number out of range
    case '23514': // a check constraint
      return new BadRequestException(pg.message ?? 'A value is not valid.');
    default:
      return null;
  }
}
