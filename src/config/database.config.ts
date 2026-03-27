import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { Ticket } from '../tickets/entities/ticket.entity';

export function databaseConfiguration(): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
    username: process.env.DATABASE_USER ?? 'postgres',
    password: process.env.DATABASE_PASSWORD ?? 'postgres',
    database: process.env.DATABASE_NAME ?? 'tickets',
    entities: [Ticket],
    synchronize: process.env.TYPEORM_SYNC !== 'false',
    logging: process.env.TYPEORM_LOGGING === 'true',
  };
}
