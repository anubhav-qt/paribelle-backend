import { createConnection } from 'typeorm';
import { SiteSetting } from '../modules/admin/settings.entity';

async function seedPolicies() {
  console.log('🌱 Seeding policy settings...');
  
  try {
    const connection = await createConnection({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_DATABASE || 'marketplace',
      entities: [SiteSetting],
      synchronize: false,
    });

    const settingsRepo = connection.getRepository(SiteSetting);

    const policies = [
      {
        key: 'return_policy',
        value: JSON.stringify({
          enabled: true,
          days: 7,
          text: 'Items can be returned within 7 days of delivery in original condition with tags attached. Refund will be processed within 5-7 business days.'
        }),
        description: 'Return policy configuration'
      },
      {
        key: 'cancellation_policy',
        value: JSON.stringify({
          enabled: true,
          text: 'Orders can be cancelled before shipping. Full refund will be issued for prepaid orders. No cancellation charges apply.'
        }),
        description: 'Cancellation policy configuration'
      }
    ];

    for (const policy of policies) {
      let setting = await settingsRepo.findOne({ where: { key: policy.key } });
      
      if (setting) {
        setting.value = policy.value;
        setting.description = policy.description;
        console.log(`📝 Updating ${policy.key}...`);
      } else {
        setting = settingsRepo.create(policy);
        console.log(`✨ Creating ${policy.key}...`);
      }
      
      await settingsRepo.save(setting);
      console.log(`✅ ${policy.key} saved`);
    }

    await connection.close();
    console.log('\n🎉 Policy settings seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding policies:', error);
    process.exit(1);
  }
}

seedPolicies();
