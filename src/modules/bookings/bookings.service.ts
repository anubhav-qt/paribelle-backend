import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Booking, BookingStatus } from './booking.entity';
import { Product, ProductType } from '../products/product.entity';

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
  ) {}

  async create(createBookingDto: any): Promise<Booking> {
    console.log('Creating booking with data:', createBookingDto);
    const booking = this.bookingRepository.create(createBookingDto);
    const savedBooking = await this.bookingRepository.save(booking);
    const result = Array.isArray(savedBooking) ? savedBooking[0] : savedBooking;
    console.log('Saved booking:', result);
    console.log('Booking ID:', result?.id);
    return result;
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

    const bookingMeta = product.attributes?.booking;
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
          slots = this.generateTimeSlots(
            bookingMeta.timeSlots || [{ start: '09:00', end: '17:00' }],
            bookingMeta.duration || 60,
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
