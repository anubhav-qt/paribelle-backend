import { PartialType } from '@nestjs/mapped-types';
import { CreateVendorPageDto } from './create-vendor-page.dto';

export class UpdateVendorPageDto extends PartialType(CreateVendorPageDto) {}
