import { Global, Module } from '@nestjs/common';
import { GenericHttpService } from './generic-http.service';
import { HttpModule } from '@nestjs/axios';

@Global()
@Module({
  imports: [
    HttpModule.registerAsync({
      useFactory: () => ({
        timeout: 10000,
        maxRedirects: 5,
      }),
    }),
  ],
  providers: [GenericHttpService],
  exports: [GenericHttpService],
})
export class GenericHttpModule {}
