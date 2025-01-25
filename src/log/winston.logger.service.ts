import { Injectable, LoggerService } from '@nestjs/common';
import * as winston from 'winston';
import 'winston-daily-rotate-file';
import { join } from 'path';
import { getTraceId } from './request.namespace';


@Injectable()
export class WinstonLoggerService implements LoggerService {
  private readonly logger: winston.Logger;
  private readonly query: winston.Logger;

  constructor() {

    const logPath = process.env.LOG_DIR || join(__dirname, '../logs');

    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss',
        }),
        winston.format.errors({ stack: true }),
        winston.format.printf(({ level, message, timestamp, stack }) => {
          const traceId = getTraceId();
          return stack
            ? `${timestamp} [${level.toUpperCase()}] [${traceId}] ${message}  ${stack}`
            : `${timestamp} [${level.toUpperCase()}] [${traceId}] ${message}`;
        }),
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.DailyRotateFile({
          dirname: logPath,
          filename: 'service-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '20m',
          maxFiles: '14d',
        }),
      ],
    });
    this.query = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.printf(({ message }) => {
          return `${message}`;
        })
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.DailyRotateFile({
        dirname: process.env.LOG_DIR,
        filename: 'query-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '14d',
      })],
    });
  }

  log(message: string) {
    this.logger.info(message);
  }

  error(message: string, trace: string) {
    this.logger.error(message, { trace });
  }

  warn(message: string) {
    this.logger.warn(message);
  }

  debug(message: string) {
    this.logger.debug(message);
  }

  verbose(message: string) {
    this.logger.verbose(message);
  }

  logQuery(message: string) {
    this.query.info(message);
  }
}