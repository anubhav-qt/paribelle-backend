import { DataSource } from 'typeorm';
import { Product } from '../modules/products/product.entity';

const multiImageProducts = {
  'wireless-headphones': [
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500',
    'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=500',
    'https://images.unsplash.com/photo-1545127398-14699f92334b?w=500',
    'https://images.unsplash.com/photo-1577174881658-0f30157f72c4?w=500'
  ],
  'smart-watch-pro': [
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500',
    'https://images.unsplash.com/photo-1434494878577-86c23bcb06b9?w=500',
    'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=500',
    'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=500',
    'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=500'
  ],
  'portable-bluetooth-speaker': [
    'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=500',
    'https://images.unsplash.com/photo-1589492477829-5e65395b66cc?w=500',
    'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=500'
  ],
  'yoga-mat-pro': [
    'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=500',
    'https://images.unsplash.com/photo-1592432678016-e910b452ce45?w=500',
    'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=500',
    'https://www.youtube.com/embed/v7AYKMP6rOE'
  ],
  'running-shoes-pro': [
    'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500',
    'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?w=500',
    'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=500',
    'https://www.youtube.com/embed/dQw4w9WgXcQ'
  ]
};

export async function updateProductImages(dataSource: DataSource) {
  const productRepository = dataSource.getRepository(Product);

  console.log('🖼️  Updating product images...');

  for (const [slug, images] of Object.entries(multiImageProducts)) {
    const product = await productRepository.findOne({ where: { slug } });
    
    if (product) {
      product.images = images;
      await productRepository.save(product);
      console.log(`✅ Updated ${slug} with ${images.length} images`);
    } else {
      console.log(`⚠️  Product ${slug} not found`);
    }
  }

  console.log('✅ Product images updated successfully!');
}
