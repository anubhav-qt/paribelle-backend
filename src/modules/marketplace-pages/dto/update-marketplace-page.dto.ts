import { PartialType } from '@nestjs/mapped-types';
import { CreateMarketplacePageDto } from './create-marketplace-page.dto';

export class UpdateMarketplacePageDto extends PartialType(
  CreateMarketplacePageDto,
) {}
