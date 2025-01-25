import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestFactory } from '@nestjs/core';
import * as Sentry from '@sentry/node';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { WinstonLoggerService } from './log/winston.logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: true,
    rawBody: true,
    logger: new WinstonLoggerService()
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
    }),
  );

  // const config = new DocumentBuilder()
  //   .addBearerAuth()
  //   .setTitle('Unofficial Pyg Backend')
  //   .setDescription('The Unofficial Pyg API description')
  //   .setVersion('1.0')
  //   .build();
  // const document = SwaggerModule.createDocument(app, config);
  // SwaggerModule.setup('api', app, document);

  const configService = app.get(ConfigService);
  const port = configService.getOrThrow('RUNNING_PORT');
  await app.listen(parseInt(port, 10) || 3000);

  Sentry.init({
    dsn: 'https://2d76ed73986b4f94a121d1781ec06e9f@o4505098397483008.ingest.sentry.io/4505098448076800',

    // Set tracesSampleRate to 1.0 to capture 100%
    // of transactions for performance monitoring.
    // We recommend adjusting this value in production
    tracesSampleRate: 1.0,
  });

  console.log(
    `App is running on port ${port}. Environment: ${
      process.env.NODE_ENV || 'Local'
    }`,
  );
}
bootstrap();
