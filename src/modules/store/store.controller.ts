import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminOnly } from '../../common/decorators/admin-only.decorator';
import { StoreService } from './store.service';
import { UpdateStoreDto, UpdateStorePoliciesDto } from './dto/update-store.dto';

/**
 * The shop's business details and policies.
 *
 * The `vendors/:id` paths are the ones the OMS was built against; they answer
 * for the store whatever the id, since there is no other seller.
 */
@ApiTags('store')
@Controller()
export class StoreController {
  constructor(private storeService: StoreService) {}

  @Get('store/policies')
  @ApiOperation({ summary: 'Return and cancellation policies, as shoppers see them' })
  policies() {
    return this.storeService.policies();
  }

  @Get(['store', 'vendors/:id'])
  @AdminOnly()
  @ApiOperation({ summary: 'The store business details and its own policies' })
  get() {
    return this.storeService.get();
  }

  @Patch(['store', 'vendors/:id'])
  @AdminOnly()
  @ApiOperation({ summary: 'Update the business details printed on invoices' })
  update(@Body() dto: UpdateStoreDto) {
    return this.storeService.update(dto);
  }

  @Patch(['store/policies', 'vendors/:id/policies'])
  @AdminOnly()
  @ApiOperation({ summary: 'Set or clear the store return and cancellation policies' })
  updatePolicies(@Body() dto: UpdateStorePoliciesDto) {
    return this.storeService.updatePolicies(dto);
  }
}
