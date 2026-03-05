import { Controller, Get, Post, Patch, Param, Query, Body, NotFoundException } from '@nestjs/common';
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

  @Post()
  @ApiOperation({ summary: 'Create a new booking' })
  async create(@Body() createBookingDto: any) {
    console.log('=== BOOKING CREATE ENDPOINT HIT ===');
    console.log('Creating booking with data:', createBookingDto);
    const result = await this.bookingsService.create(createBookingDto);
    console.log('Saved booking:', result);
    console.log('=== BOOKING CREATE COMPLETE ===');
    return result;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get booking by ID' })
  async findOne(@Param('id') id: string) {
    console.log('=== BOOKING FINDONE ENDPOINT HIT ===');
    console.log('Controller - Finding booking with ID:', id);
    const booking = await this.bookingsService.findOne(id);
    console.log('Controller - Found booking:', booking);
    if (!booking) {
      console.log('Controller - Booking not found, throwing NotFoundException');
      throw new NotFoundException(`Booking with ID ${id} not found`);
    }
    console.log('=== BOOKING FINDONE COMPLETE ===');
    return booking;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update booking details (status, payment, address)' })
  async update(
    @Param('id') id: string,
    @Body() updateBookingDto: any,
  ) {
    return this.bookingsService.update(id, updateBookingDto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update booking status' })
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: BookingStatus,
  ) {
    return this.bookingsService.updateStatus(id, status);
  }

  @Patch(':id/payment')
  @ApiOperation({ summary: 'Update booking payment reference' })
  async updatePayment(
    @Param('id') id: string,
    @Body('paymentId') paymentId: string,
  ) {
    return this.bookingsService.updatePayment(id, paymentId);
  }
}
