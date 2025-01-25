import {
  Injectable,
  CanActivate,
  ExecutionContext,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const keys = this.reflector.get<string[]>('keys', context.getHandler());

    if (!keys.length) {
      return true;
    }

    const authorization = request.headers.authorization;
    const key = authorization?.replace('Bearer ', '');
    if (!keys.includes(key)) {
      throw new UnauthorizedException();
    }

    return true;
  }
}

export const AdminKey = (...keys: string[]) => SetMetadata('keys', keys);
