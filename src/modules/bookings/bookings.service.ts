import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Booking, BookingStatus } from './booking.entity';
import { Product, ProductType } from '../products/product.entity';
import { User } from '../users/user.entity';

export interface TimeSlot {
  startTime: string;
  endTime: string;
  available: boolean;
  price?: number;
}

export interface AvailableDate {
  date: string;
  slots: TimeSlot[];
}

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private bookingRepository: Repository<Booking>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async create(createBookingDto: any): Promise<Booking> {
    console.log('Creating booking with data:', createBookingDto);

    const shippingAddress = createBookingDto.shippingAddress || createBookingDto.shippingAddressDetails;
    const billingAddress = createBookingDto.billingAddress || createBookingDto.billingAddressDetails;

    if (shippingAddress) {
      createBookingDto.shippingAddressDetails = shippingAddress;
      if (createBookingDto.billingAddressSameAsShipping === undefined) {
        createBookingDto.billingAddressSameAsShipping = !billingAddress;
      }
      if (billingAddress) {
        createBookingDto.billingAddressDetails = billingAddress;
      }
    }
    
    // Validate that user exists
    if (!createBookingDto.userId) {
      throw new BadRequestException('User ID is required');
    }
    
    const user = await this.userRepository.findOne({ where: { id: createBookingDto.userId } });
    if (!user) {
      throw new NotFoundException(
        'USER_NOT_FOUND',
        'Your session has expired or is invalid. Please log in again.'
      );
    }
    
    // Auto-populate customer details from shipping address first, then user profile.
    createBookingDto.customerName = createBookingDto.customerName || shippingAddress?.fullName || `${user.firstName} ${user.lastName}`;
    createBookingDto.customerEmail = createBookingDto.customerEmail || shippingAddress?.email || user.email;
    createBookingDto.customerPhone = createBookingDto.customerPhone || shippingAddress?.phone || user.phone || 'Not provided';
    
    const booking = this.bookingRepository.create(createBookingDto);
    
    try {
      const savedBooking = await this.bookingRepository.save(booking);
      const result = Array.isArray(savedBooking) ? savedBooking[0] : savedBooking;
      console.log('Saved booking:', result);
      console.log('Booking ID:', result?.id);
      return result;
    } catch (error) {
      console.error('Error saving booking:', error);
      if (error.code === '23503') { // PostgreSQL foreign key constraint violation
        throw new BadRequestException(
          'Invalid reference in booking data. Please refresh the page and try again.'
        );
      }
      throw error;
    }
  }

  async update(id: string, updateBookingDto: any): Promise<Booking | null> {
    const existing = await this.bookingRepository.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Booking with ID ${id} not found`);
    }

    const patch: any = { ...updateBookingDto };
    const shippingAddress = updateBookingDto.shippingAddress || updateBookingDto.shippingAddressDetails;
    const billingAddress = updateBookingDto.billingAddress || updateBookingDto.billingAddressDetails;

    if (shippingAddress) {
      patch.shippingAddressDetails = shippingAddress;
      patch.customerName = patch.customerName || shippingAddress.fullName || existing.customerName;
      patch.customerEmail = patch.customerEmail || shippingAddress.email || existing.customerEmail;
      patch.customerPhone = patch.customerPhone || shippingAddress.phone || existing.customerPhone;
    }

    if (billingAddress) {
      patch.billingAddressDetails = billingAddress;
    }

    delete patch.shippingAddress;
    delete patch.billingAddress;

    await this.bookingRepository.update(id, patch);
    return this.bookingRepository.findOne({
      where: { id },
      relations: ['product', 'user', 'vendor', 'payment'],
    });
  }

  async findAll(): Promise<Booking[]> {
    return this.bookingRepository.find({
      relations: ['product', 'user', 'vendor'],
    });
  }

  async findByVendor(vendorId: string): Promise<Booking[]> {
    return this.bookingRepository.find({
      where: { vendorId },
      relations: ['product', 'user'],
      order: { bookingDate: 'ASC', startTime: 'ASC' },
    });
  }

  async findByUser(userId: string): Promise<Booking[]> {
    return this.bookingRepository.find({
      where: { userId },
      relations: ['product', 'vendor'],
      order: { bookingDate: 'ASC', startTime: 'ASC' },
    });
  }

  async updateStatus(id: string, status: BookingStatus): Promise<Booking | null> {
    await this.bookingRepository.update(id, { status });
    return this.bookingRepository.findOne({ 
      where: { id },
      relations: ['product', 'user', 'vendor', 'payment'],
    });
  }

  async updatePayment(id: string, paymentId: string): Promise<Booking | null> {
    await this.bookingRepository.update(id, { paymentId });
    return this.bookingRepository.findOne({ 
      where: { id },
      relations: ['product', 'user', 'vendor', 'payment'],
    });
  }

  async findOne(id: string): Promise<Booking | null> {
    console.log('Finding booking with ID:', id);
    const booking = await this.bookingRepository.findOne({
      where: { id },
      relations: ['product', 'user', 'vendor', 'payment'],
    });
    console.log('Found booking:', booking);
    return booking;
  }

  async getAvailability(
    productId: string,
    startDate: string,
    endDate: string,
  ): Promise<AvailableDate[]> {
    const product = await this.productRepository.findOne({
      where: { id: productId },
    });

    if (!product || product.productType !== ProductType.BOOKING) {
      throw new Error('Product is not a booking type');
    }

    const bookingMeta = product.metadata?.booking;
    if (!bookingMeta) {
      return [];
    }

    // Get existing bookings for this date range
    // Note: We'll filter by date string comparison to avoid timezone issues
    const allBookings = await this.bookingRepository.find({
      where: {
        productId,
        status: BookingStatus.CONFIRMED,
      },
    });

    // Filter bookings by date range using string comparison
    const existingBookings = allBookings.filter((booking) => {
      const bookingDateStr = new Date(booking.bookingDate).toISOString().split('T')[0];
      return bookingDateStr >= startDate && bookingDateStr <= endDate;
    });

    const availableDates: AvailableDate[] = [];
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      const dayName = current.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

      // Check if this day is available
      if (bookingMeta.availableDays?.includes(dayName)) {
        let slots: TimeSlot[] = [];

        // For daily bookings, check if the day is booked (no time slots)
        if (bookingMeta.durationUnit === 'days') {
          const dayBookings = existingBookings.filter(
            (b) => new Date(b.bookingDate).toISOString().split('T')[0] === dateStr,
          );
          
          // If there's any booking for this day (without specific time), mark day as unavailable
          const isFullDayBooked = dayBookings.some(
            (b) => !b.startTime && !b.endTime,
          );
          
          slots = [{
            startTime: 'full-day',
            endTime: 'full-day',
            available: !isFullDayBooked,
          }];
        } else {
          // For hourly/session bookings, generate time slots
          // Convert duration to minutes based on durationUnit
          const durationInMinutes = bookingMeta.durationUnit === 'hours' 
            ? (bookingMeta.duration || 1) * 60 
            : bookingMeta.duration || 60;
          
          console.log('Generating slots:', {
            duration: bookingMeta.duration,
            durationUnit: bookingMeta.durationUnit,
            durationInMinutes,
            bufferTime: bookingMeta.bufferTime,
          });
          
          slots = this.generateTimeSlots(
            bookingMeta.timeSlots || [{ start: '09:00', end: '17:00' }],
            durationInMinutes,
            bookingMeta.bufferTime || 0,
            existingBookings.filter(
              (b) => new Date(b.bookingDate).toISOString().split('T')[0] === dateStr,
            ),
          );
        }

        availableDates.push({
          date: dateStr,
          slots,
        });
      }

      current.setDate(current.getDate() + 1);
    }

    return availableDates;
  }

  private generateTimeSlots(
    ranges: Array<{ start: string; end: string }>,
    duration: number,
    bufferTime: number,
    bookedSlots: Booking[],
  ): TimeSlot[] {
    const slots: TimeSlot[] = [];

    for (const range of ranges) {
      const startMinutes = this.timeToMinutes(range.start);
      const endMinutes = this.timeToMinutes(range.end);

      let currentMinutes = startMinutes;

      while (currentMinutes + duration <= endMinutes) {
        const slotStart = this.minutesToTime(currentMinutes);
        const slotEnd = this.minutesToTime(currentMinutes + duration);

        // Check if this specific slot is booked (not just any slot on that day)
        const isBooked = bookedSlots.some(
          (booking) =>
            booking.startTime === slotStart && booking.endTime === slotEnd,
        );

        slots.push({
          startTime: slotStart,
          endTime: slotEnd,
          available: !isBooked,
        });

        currentMinutes += duration + bufferTime;
      }
    }

    return slots;
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private minutesToTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }
}
