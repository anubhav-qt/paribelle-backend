// Force output immediately
process.stdout.write('🟢 main.ts file loading...\n');

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { MonitoringService } from './modules/monitoring/monitoring.service';

// Force output immediately
process.stdout.write('🟢 All imports loaded successfully\n');

// Global error handlers
process.on('uncaughtException', (error) => {
  process.stderr.write(`❌ UNCAUGHT EXCEPTION: ${error.message}\n`);
  process.stderr.write(`Stack: ${error.stack}\n`);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  process.stderr.write(`❌ UNHANDLED REJECTION at ${promise}\n`);
  process.stderr.write(`Reason: ${reason}\n`);
  process.exit(1);
});

async function bootstrap() {
  process.stdout.write('🔵 Starting bootstrap...\n');
  
  try {
    process.stdout.write('🔵 Creating NestJS application...\n');
    const app = await NestFactory.create<NestExpressApplication>(AppModule);
    process.stdout.write('✅ NestJS application created\n');

  // Get MonitoringService for the logging interceptor
  const monitoringService = app.get(MonitoringService);

  // Add logging interceptor for request monitoring
  app.useGlobalInterceptors(new LoggingInterceptor(monitoringService));

  // Serve static files from public directory
  // In development: __dirname is 'src', go up one level to project root, then into 'public'
  // In production/dist: __dirname is 'dist/src', go up two levels to project root, then into 'public'
  const publicPath = process.env.NODE_ENV === 'production' 
    ? join(__dirname, '..', '..', 'public')
    : join(__dirname, '..', 'public');
  
  console.log('Serving static files from:', publicPath);
  app.useStaticAssets(publicPath, {
    prefix: '/',
  });

    // Security
    // Helmet is a middleware that helps secure your Express-based applications by setting various HTTP headers. These headers can help protect your app from well-known web vulnerabilities like cross-site scripting (XSS), clickjacking, and others.
    // Some of the things Helmet does by default:
    // Adds X-Content-Type-Options to prevent browsers from interpreting files as a different MIME type (helps protect against some types of attacks).
    // Sets X-XSS-Protection to "1; mode=block" to activate the browser's XSS protection mechanism.
    // Restricts clickjacking through the X-Frame-Options header.
    // Sets Strict-Transport-Security (HSTS) to force HTTPS connections.
    // Allows you to customize security headers further.
    app.use(helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }));
    // CORS is a mechanism that allows or restricts resources to be requested from another domain. This is important when your frontend and backend are on different domains or ports.
    // Allow both main domain and vendor subdomains
    app.enableCors({
        origin: (origin, callback) => {
            const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
            
            // Debug logging
            console.log('CORS Request from origin:', origin);
            console.log('Allowed origins:', allowedOrigins);
            
            // Allow requests with no origin (like mobile apps or curl requests)
            if (!origin) {
                console.log('✓ Allowing request with no origin');
                return callback(null, true);
            }
            
            // Check if origin matches any allowed origin exactly
            if (allowedOrigins.includes(origin)) {
                console.log('✓ Origin matches allowed list');
                return callback(null, true);
            }
            
            // Check if origin matches subdomain pattern (*.localhost:3000)
            const subdomainPattern = /^http:\/\/[\w-]+\.localhost:3000$/;
            if (subdomainPattern.test(origin)) {
                console.log('✓ Origin matches subdomain pattern');
                return callback(null, true);
            }
            
            // Check for production subdomain pattern if needed
            const prodPattern = process.env.PRODUCTION_DOMAIN 
                ? new RegExp(`^https?://[\\w-]+\\.${process.env.PRODUCTION_DOMAIN.replace('.', '\\.')}$`)
                : null;
            if (prodPattern && prodPattern.test(origin)) {
                console.log('✓ Origin matches production pattern');
                return callback(null, true);
            }
            
            // Allow all Vercel preview and production deployments
            const vercelPattern = /^https:\/\/[\w-]+\.vercel\.app$/;
            if (vercelPattern.test(origin)) {
                console.log('✓ Origin matches Vercel pattern');
                return callback(null, true);
            }
            
            // If ALLOWED_ORIGINS is not set, allow all
            if (allowedOrigins.length === 0) {
                console.log('✓ No allowed origins set, allowing all');
                return callback(null, true);
            }
            
            console.log('✗ Origin not allowed by CORS');
            callback(new Error('Not allowed by CORS'));
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
        exposedHeaders: ['Content-Length', 'Content-Type'],
    });

    // Compression middleware uses the gzip or brotli algorithms to compress the HTTP responses sent from your server. This helps reduce the size of the responses (e.g., HTML, CSS, JavaScript files), which speeds up the transfer and loading time for clients.
    app.use(compression());

    // Global validation pipe
    // ValidationPipe is a powerful feature in NestJS that automatically validates and transforms incoming request data (e.g., request body, query parameters). It integrates seamlessly with class-validator and class-transformer to apply validation rules.
    // Here's a breakdown of the options configured:
    // whitelist: true: Automatically removes properties from the request that are not defined in the DTO (Data Transfer Object). This helps to avoid accepting unexpected or malicious fields.
    // transform: true: Automatically transforms payloads to the type specified in the DTO. For example, if you have a DTO that expects a number but the client sends it as a string, this option will automatically convert it to a number.
    // forbidNonWhitelisted: true: If set to true, any property in the request that is not in the DTO will cause a validation error. This is useful to ensure that the data conforms strictly to the schema and that no additional properties are included.
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            transform: true,
            forbidNonWhitelisted: true,
        }),
    );

  // API prefix
  app.setGlobalPrefix('api/v1');

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('GaliCart API')
    .setDescription('API documentation for the marketplace platform')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Authentication endpoints')
    .addTag('users', 'User management')
    .addTag('vendors', 'Vendor management')
    .addTag('products', 'Product catalog')
    .addTag('orders', 'Order management')
    .addTag('payments', 'Payment processing')
    .addTag('admin', 'Admin operations')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3001;
  process.stdout.write(`🔵 Attempting to listen on port ${port}...\n`);
  await app.listen(port, '0.0.0.0');

  process.stdout.write(`🚀 Application is running on: http://0.0.0.0:${port}\n`);
  process.stdout.write(`📚 Swagger docs available at: http://0.0.0.0:${port}/api/docs\n`);
  } catch (error) {
    process.stderr.write('❌ FATAL ERROR during bootstrap:\n');
    process.stderr.write(`Error message: ${error.message}\n`);
    process.stderr.write(`Error stack: ${error.stack}\n`);
    process.exit(1);
  }
}

process.stdout.write('🔵 Calling bootstrap()...\n');
bootstrap().catch((error) => {
  process.stderr.write(`❌ BOOTSTRAP FAILED: ${error.message}\n`);
  process.stderr.write(`Stack: ${error.stack}\n`);
  process.exit(1);
});
