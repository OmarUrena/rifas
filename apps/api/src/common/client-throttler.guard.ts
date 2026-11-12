import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';
import { clientAddress } from './client-address';

@Injectable()
export class ClientThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(request: Record<string, unknown>): Promise<string> {
    return clientAddress(request as unknown as Request);
  }
}
