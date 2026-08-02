import { Controller, Get, Post, Put, Patch, Delete, Body, Param, UseGuards, NotFoundException, ForbiddenException, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, UserRole } from './user.entity';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all users (admin only)' })
  async findAll(): Promise<User[]> {
    return this.usersService.findAll();
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@Request() req): Promise<User> {
    // The JWT strategy returns the full user object
    if (!req.user || !req.user.id) {
      throw new NotFoundException('User not authenticated');
    }
    
    const userId = req.user.id;
    const user = await this.usersService.findOne(userId);
    
    if (!user) {
      throw new NotFoundException('User not found');
    }
    
    return user;
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user by ID (own account, or any as admin)' })
  async findOne(@Param('id') id: string, @Request() req): Promise<User> {
    if (req.user.id !== id && req.user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('You may only read your own account');
    }

    const user = await this.usersService.findOne(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user profile' })
  async updateProfile(@Request() req, @Body() userData: Partial<User>): Promise<User> {
    if (!req.user || !req.user.id) {
      throw new NotFoundException('User not authenticated');
    }
    
    const userId = req.user.id;
    
    // Don't allow updating certain fields through profile endpoint
    const allowedFields = ['firstName', 'lastName', 'phone'];
    const filteredData: any = {};
    
    for (const field of allowedFields) {
      if (userData[field] !== undefined) {
        filteredData[field] = userData[field];
      }
    }
    
    // Check if there's any data to update
    if (Object.keys(filteredData).length === 0) {
      // No fields to update, just return current user
      const user = await this.usersService.findOne(userId);
      if (!user) {
        throw new NotFoundException('User not found');
      }
      return user;
    }
    
    const user = await this.usersService.update(userId, filteredData);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user (admin only)' })
  async update(@Param('id') id: string, @Body() userData: UpdateUserDto): Promise<User> {
    const user = await this.usersService.update(id, userData);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete user (admin only)' })
  async remove(@Param('id') id: string): Promise<void> {
    return this.usersService.remove(id);
  }
}
