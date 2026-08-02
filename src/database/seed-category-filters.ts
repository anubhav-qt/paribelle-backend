import { DataSource } from 'typeorm';
import { Category } from '../modules/categories/category.entity';
import { FILTER_PRESETS } from './common-filters';

export async function seedCategoryFilters(dataSource: DataSource) {
  const categoryRepo = dataSource.getRepository(Category);

  console.log('🔧 Seeding category filters...');

  const kurtis = await categoryRepo.findOne({ where: { slug: 'kurtis' } });
  if (kurtis) {
    kurtis.filterConfig = { filters: FILTER_PRESETS.kurtis };
    await categoryRepo.save(kurtis);
    console.log('✅ Kurtis filters added');
  }

  const jewellery = await categoryRepo.findOne({ where: { slug: 'jewellery' } });
  if (jewellery) {
    jewellery.filterConfig = { filters: FILTER_PRESETS.jewellery };
    await categoryRepo.save(jewellery);
    console.log('✅ Jewellery filters added');
  }

  console.log('✅ Category filters seeded successfully!');
}
