import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException, Logger,
} from '@nestjs/common';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    if (exception instanceof HttpException) {
      // Handle HttpExceptions
      const status = exception.getStatus();
      const message = exception.getResponse();

      response.status(status).json({
        statusCode: status,
        message: message,
      });
      this.logger.error(exception);
    } else {
      // Handle all other exceptions
      console.error(exception);
      response.status(500).json({
        statusCode: 500,
        message: 'Internal server error',
      });
    }
  }
}
