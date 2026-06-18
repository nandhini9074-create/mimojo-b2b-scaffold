import 'dotenv/config'; // must be first — LangSmith reads env vars at module init
import './tracer';
import { ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationError } from 'class-validator';
import { appConfig, servicesURLs } from 'config/server.config';
import { AppModule } from './app.module';
import { exceptionFactory } from './common/errors/exception-factory.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';
import { EnvironmentEnum } from 'env.validation';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const { SERVER_HTTP_HOST, SERVER_HTTP_PORT, NODE_ENV, IS_SWAGGER_ENABLED } = appConfig();
  const { GRAVITEE_ENDPOINT } = servicesURLs();

  // Serve the scaffold UI at GET /
  app.useStaticAssets(path.join(process.cwd(), 'public'));

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      exceptionFactory: (validationErrors: ValidationError[] = []) => exceptionFactory(validationErrors),
    })
  );
  app.enableCors();
  if (NODE_ENV === EnvironmentEnum.LOCAL) {
    setupLocalSwagger(app, GRAVITEE_ENDPOINT);
  }

  if (IS_SWAGGER_ENABLED && NODE_ENV !== EnvironmentEnum.LOCAL) {
    setupGraviteeSwagger(app, GRAVITEE_ENDPOINT);
  }
  app.get(HttpAdapterHost);
  await app.listen(SERVER_HTTP_PORT);
  console.log(`Http Server is running over: ${SERVER_HTTP_HOST}:${SERVER_HTTP_PORT}`);
}
bootstrap();

function setupLocalSwagger(app: any, graviteeEndpoint: string) {
  const { SERVER_HTTP_HOST, SERVER_HTTP_PORT } = appConfig();
  const config = new DocumentBuilder()
    .setTitle('mimojo-consumer-identity-service-qnb')
    .setDescription('Consumer Identity service QNB API description')
    .setVersion('1.0')
    .addServer(`http://${SERVER_HTTP_HOST}:${SERVER_HTTP_PORT}`, 'Localhost URL')
    .addServer(graviteeEndpoint, 'Gravitee URL')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        in: 'header',
      },
      'access-token'
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);
}

/**
 * Sets up Swagger for Gravitee deployment, rewrites paths, and saves swagger.json.
 */
function setupGraviteeSwagger(app: any, graviteeEndpoint: string) {
  const config = new DocumentBuilder()
    .setTitle('Consumer Identity service ADIB')
    .setDescription('API documentation')
    .setVersion('1.0')
    .addServer(graviteeEndpoint, 'Gravitee URL')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        in: 'header',
      },
      'access-token'
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Ensure docs folder exists
  const docsDir = path.resolve(process.cwd(), 'docs');
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  // Rewrite paths for Gravitee
  document.servers = [{ url: graviteeEndpoint, description: 'Gravitee Gateway' }];
  document.paths = rewriteSwaggerPaths(document.paths);
  SwaggerModule.setup('api-docs', app, document);

  // Save swagger.json
  fs.writeFileSync(path.join(docsDir, 'swagger.json'), JSON.stringify(document, null, 2));
}

/**
 * Rewrites Swagger paths according to Gravitee prefix mapping.
 */
function rewriteSwaggerPaths(paths: typeof SwaggerModule.createDocument.prototype.paths) {
  const prefixMap: Record<string, string> = {
    '/users': '/adib/users',
    '/consumer': '/adib/consumers',
  };

  const newPaths: typeof paths = {};
  for (const [p, def] of Object.entries(paths)) {
    let replaced = false;

    for (const [controllerPrefix, externalPrefix] of Object.entries(prefixMap)) {
      if (p === controllerPrefix) {
        newPaths[externalPrefix] = def;
        replaced = true;
        break;
      } else if (p.startsWith(controllerPrefix + '/')) {
        newPaths[externalPrefix + p.slice(controllerPrefix.length)] = def;
        replaced = true;
        break;
      }
    }

    if (!replaced) {
      newPaths[p] = def;
    }
  }

  return newPaths;
}
