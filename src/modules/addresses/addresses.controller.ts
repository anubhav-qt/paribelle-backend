import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AddressesService } from './addresses.service';
import { Address } from './address.entity';

@ApiTags('addresses')
@Controller('user/addresses')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all addresses for current user' })
  async findAll(@Request() req): Promise<Address[]> {
    return this.addressesService.findAllByUser(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get address by ID' })
  async findOne(@Param('id') id: string, @Request() req): Promise<Address> {
    return this.addressesService.findOne(id, req.user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new address' })
  async create(@Body() addressData: Partial<Address>, @Request() req): Promise<Address> {
    return this.addressesService.create(req.user.id, addressData);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an address' })
  async update(
    @Param('id') id: string,
    @Body() addressData: Partial<Address>,
    @Request() req,
  ): Promise<Address> {
    return this.addressesService.update(id, req.user.id, addressData);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an address' })
  async remove(@Param('id') id: string, @Request() req): Promise<void> {
    return this.addressesService.remove(id, req.user.id);
  }
}
