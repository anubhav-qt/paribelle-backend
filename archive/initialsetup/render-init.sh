#!/bin/bash
set -e  # Exit on any error

echo "🚀 Starting Render deployment initialization..."

# Run database initialization
echo "📦 Step 1/3: Initializing database..."
npm run db:init -- --force
DB_INIT_EXIT=$?

if [ $DB_INIT_EXIT -ne 0 ]; then
  echo "❌ Database initialization failed with exit code $DB_INIT_EXIT"
  exit 1
fi

echo "✅ Database initialization complete"

# Run seeding
echo "🌱 Step 2/3: Seeding database..."
npm run seed
SEED_EXIT=$?

if [ $SEED_EXIT -ne 0 ]; then
  echo "❌ Database seeding failed with exit code $SEED_EXIT"
  exit 1
fi

echo "✅ Database seeding complete"

# Start production server
echo "🎬 Step 3/3: Starting production server..."
npm run start:prod
