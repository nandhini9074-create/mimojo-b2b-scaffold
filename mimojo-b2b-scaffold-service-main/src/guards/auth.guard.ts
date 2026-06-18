import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { GenericHttpService } from '../http/generic-http.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthGuard implements CanActivate {
  @Inject(GenericHttpService)
  public readonly httpService: GenericHttpService;
  private readonly config;

  constructor(private readonly configService: ConfigService) {
    this.config = this.configService.get('servicesURLs');
  }

  public async canActivate(ctx: ExecutionContext): Promise<boolean> | never {
    const request = ctx.switchToHttp().getRequest();
    const bearerToken = request?.headers?.authorization;

    if (!bearerToken) {
      throw new UnauthorizedException({
        code: 2,
        statusCode: 401,
        message: 'Unauthorized',
      });
    }

    const data = await this.httpService.get(`${this.config.CONSUMER_IDENTITY_SERVICE_URL}/users/validate`, {
      headers: {
        'authorization': bearerToken,
        'x-device-id': request?.headers['x-device-id'],
      },
    });
    if (!data?.data) {
      throw new UnauthorizedException({
        code: 2,
        statusCode: 401,
        message: 'Unauthorized',
      });
    }
    request['user'] = data?.data;

    return true;
  }
}
