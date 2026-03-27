import { Body, Controller, Post } from '@nestjs/common';
import { GenerateTicketDto } from './dto/generate-ticket.dto';
import { TicketsService } from './tickets.service';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Post('generate')
  generate(@Body() body: GenerateTicketDto) {
    return this.tickets.generate(body);
  }
}
