import { Controller, Get, Post, Patch, Param, Query, Body, UseGuards, NotFoundException, ForbiddenException, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminOnly } from '../../common/decorators/admin-only.decorator';
import { UserRole } from '../users/user.entity';
import { BookingsService } from './bookings.service';
import { BookingStatus } from './booking.entity';

/**
 * Slot availability is public so customers can browse before signing in.
 * Everything else needs a session, and the vendor-wide views need an admin.
 */
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
  @AdminOnly()
  @ApiOperation({ summary: 'Get all bookings for a vendor' })
  async findByVendor(@Param('vendorId') vendorId: string) {
    return this.bookingsService.findByVendor(vendorId);
  }

  @Get('user/:userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all bookings for a user (own, or any as admin)' })
  async findByUser(@Param('userId') userId: string, @Request() req) {
    const isAdmin =
      req.user.role === UserRole.SUPER_ADMIN ||
      req.user.role === UserRole.VENDOR_ADMIN;
    if (req.user.id !== userId && !isAdmin) {
      throw new ForbiddenException('You may only read your own bookings');
    }
    return this.bookingsService.findByUser(userId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update booking details (status, payment, address)' })
  async update(
    @Param('id') id: string,
    @Body() updateBookingDto: any,
  ) {
    return this.bookingsService.update(id, updateBookingDto);
  }

  @Patch(':id/status')
  @AdminOnly()
  @ApiOperation({ summary: 'Update booking status' })
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: BookingStatus,
  ) {
    return this.bookingsService.updateStatus(id, status);
  }

  @Patch(':id/payment')
  @AdminOnly()
  @ApiOperation({ summary: 'Update booking payment reference' })
  async updatePayment(
    @Param('id') id: string,
    @Body('paymentId') paymentId: string,
  ) {
    return this.bookingsService.updatePayment(id, paymentId);
  }
}
