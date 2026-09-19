import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
declare const module: any;

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const encryptionKey = process.env.PAYMENT_ACCOUNT_ENCRYPTION_KEY;
  if (!encryptionKey || !/^[0-9a-fA-F]{64}$/.test(encryptionKey)) {
    throw new Error(
      'Missing or invalid PAYMENT_ACCOUNT_ENCRYPTION_KEY — must be 64 hex characters',
    );
  }

  const app = await NestFactory.create(AppModule);

  if (module.hot) {
    module.hot.accept();
    module.hot.dispose(() => app.close());
  }
  app.enableCors({ origin: process.env.CLIENT_URL });
  app.useGlobalPipes(new ValidationPipe());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());
  const config = new DocumentBuilder()
    .setTitle('Framed API DOCS')
    .setDescription('The framed API description')
    .setVersion('1.0')
    .addTag('framed')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory);
  logger.log('Swagger API DOCS available at: http://localhost:3000/api');
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
