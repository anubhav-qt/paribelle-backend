import { Module, Global } from '@nestjs/common';
import { SimpleEmailService } from './simple-email.service';

@Global()
@Module({
  providers: [SimpleEmailService],
  exports: [SimpleEmailService],
})
export class SimpleEmailModule {}
