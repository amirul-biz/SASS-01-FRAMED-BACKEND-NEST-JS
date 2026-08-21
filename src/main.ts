import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
declare const module: any;

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  if (module.hot) {
    module.hot.accept();
    module.hot.dispose(() => app.close());
  }
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe());
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
