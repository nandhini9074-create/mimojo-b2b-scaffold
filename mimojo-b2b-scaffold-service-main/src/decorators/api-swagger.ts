import { applyDecorators, Type, HttpStatus } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiExtraModels,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  getSchemaPath,
} from '@nestjs/swagger';

export interface ApiEndpointOptions<T = any> {
  summary: string;
  description?: string;
  authRequired?: boolean;
  bodyType?: Type<T>;
  exampleBody?: Partial<T> | Record<string, any>;
  successType?: Type<any>;
  responseType?: Type<any>;
  exampleResponse?: any;
  queries?: {
    name: string;
    required?: boolean;
    description?: string;
    example?: any;
  }[];
  headers?: {
    name: string;
    required?: boolean;
    description?: string;
    example?: any;
  }[];
  pathParams?: { name: string; description?: string; type?: any; example?: string }[];
  includeIp?: boolean;
  timezoneInfoHeader?: boolean;
}

export function ApiEndpoint<T = any>(options: ApiEndpointOptions<T>) {
  const decorators: any[] = [];

  decorators.push(
    ApiOperation({
      summary: options.summary,
      description: options.description,
    })
  );

  decorators.push(ApiBearerAuth('access-token'));

  if (options.timezoneInfoHeader) {
    decorators.push(
      ApiHeader({
        name: 'timezoneinfo',
        description: 'Timezone offset info (e.g., "Asia/Dubai") used for date calculations',
        required: false,
        schema: { type: 'string', example: 'Asia/Dubai' },
      })
    );
  }

  if (options.bodyType) {
    decorators.push(ApiExtraModels(options.bodyType));
    decorators.push(
      ApiBody({
        type: options.bodyType,
        description: `${options.bodyType.name} payload`,
        schema: { $ref: getSchemaPath(options.bodyType) },
        examples: options.exampleBody
          ? {
              default: {
                summary: 'Example request body',
                value: options.exampleBody,
              },
            }
          : undefined,
      })
    );
  }

  if (options.queries?.length) {
    options.queries.forEach(q => {
      decorators.push(
        ApiQuery({
          name: q.name,
          required: q.required ?? false,
          description: q.description,
          example: q.example,
        })
      );
    });
  }

  if (options.headers?.length) {
    options.headers.forEach(h => {
      decorators.push(
        ApiHeader({
          name: h.name,
          required: h.required ?? false,
          description: h.description,
          example: h.example,
        })
      );
    });
  }

  if (options.pathParams?.length) {
    options.pathParams.forEach(param => {
      decorators.push(
        ApiParam({
          name: param.name,
          description: param.description ?? '',
          type: param.type ?? String,
          example: param.example ?? '',
        })
      );
    });
  }

  decorators.push(
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Request successful',
      schema: options.exampleResponse ? { example: options.exampleResponse } : undefined,
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Invalid request',
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Invalid or missing authorization token',
    }),
    ApiResponse({
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      description: 'Internal server error',
    }),
    ApiResponse({
      status: HttpStatus.CREATED,
      description: 'Created successfully',
    }),
    ApiResponse({
      status: HttpStatus.NO_CONTENT,
      description: 'Deleted successfully',
    })
  );

  return applyDecorators(...decorators);
}
