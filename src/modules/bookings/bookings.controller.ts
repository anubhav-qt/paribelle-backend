import { Controller, Get, Post, Patch, Param, Query, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import { BookingStatus } from './booking.entity';

@ApiTags('bookings')
@Controller('bookings')
export class BookingsController {
  constructor(private bookingsService: BookingsService) {}

  @Get('availability/:productId')
  @ApiOperation({ summary: 'Get available time slots for a booking product' })
  async getAvailability(
    @Param('productId') productId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.bookingsService.getAvailability(productId, startDate, endDate);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new booking' })
  async create(@Body() createBookingDto: any) {
    return this.bookingsService.create(createBookingDto);
  }

  @Get('vendor/:vendorId')
  @ApiOperation({ summary: 'Get all bookings for a vendor' })
  async findByVendor(@Param('vendorId') vendorId: string) {
    return this.bookingsService.findByVendor(vendorId);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get all bookings for a user' })
  async findByUser(@Param('userId') userId: string) {
    return this.bookingsService.findByUser(userId);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update booking status' })
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: BookingStatus,
  ) {
    return this.bookingsService.updateStatus(id, status);
  }
}
