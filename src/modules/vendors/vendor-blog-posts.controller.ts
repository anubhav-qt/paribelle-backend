import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
  ForbiddenException,
} from '@nestjs/common';
import { VendorBlogPostsService } from './vendor-blog-posts.service';
import { CreateBlogPostDto } from './dto/create-blog-post.dto';
import { UpdateBlogPostDto } from './dto/update-blog-post.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';

@Controller('vendors/:vendorId/blog')
export class VendorBlogPostsController {
  constructor(private readonly blogPostsService: VendorBlogPostsService) {}

  // Public endpoints
  @Get()
  findAll(
    @Param('vendorId') vendorId: string,
    @Query('includeUnpublished') includeUnpublished?: string,
  ) {
    // Only allow includeUnpublished for authenticated vendor owners
    return this.blogPostsService.findAll(vendorId, includeUnpublished === 'true');
  }

  @Get('recent')
  findRecent(@Param('vendorId') vendorId: string, @Query('limit') limit?: string) {
    return this.blogPostsService.findRecent(vendorId, limit ? parseInt(limit, 10) : 5);
  }

  @Get('tag/:tag')
  findByTag(@Param('vendorId') vendorId: string, @Param('tag') tag: string) {
    return this.blogPostsService.findByTag(vendorId, tag);
  }

  @Get(':slug')
  findOne(@Param('vendorId') vendorId: string, @Param('slug') slug: string) {
    return this.blogPostsService.findOne(vendorId, slug);
  }

  // Protected endpoints - Vendor only
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  async create(
    @Param('vendorId') vendorId: string,
    @Body() createBlogPostDto: CreateBlogPostDto,
    @Request() req,
  ) {
    // Verify user owns this vendor
    if (req.user.vendorId !== vendorId) {
      throw new ForbiddenException('You can only create blog posts for your own vendor');
    }

    return this.blogPostsService.create(vendorId, createBlogPostDto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  async update(
    @Param('vendorId') vendorId: string,
    @Param('id') id: string,
    @Body() updateBlogPostDto: UpdateBlogPostDto,
    @Request() req,
  ) {
    // Verify user owns this vendor
    if (req.user.vendorId !== vendorId) {
      throw new ForbiddenException('You can only update blog posts for your own vendor');
    }

    return this.blogPostsService.update(id, vendorId, updateBlogPostDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  async remove(@Param('vendorId') vendorId: string, @Param('id') id: string, @Request() req) {
    // Verify user owns this vendor
    if (req.user.vendorId !== vendorId) {
      throw new ForbiddenException('You can only delete blog posts for your own vendor');
    }

    await this.blogPostsService.remove(id, vendorId);
    return { message: 'Blog post deleted successfully' };
  }
}
