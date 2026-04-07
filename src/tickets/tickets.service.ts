import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket } from './entities/ticket.entity';
import { GenerateTicketDto } from './dto/generate-ticket.dto';
import {
  assertBasicCombinationRules,
  assertReferenceRow,
} from './validation/reference.validator';
import { roundMoney, sumCombination } from './validation/numeric.utils';
import { formatTicketNumber, generateTicketLayout, newTicketId } from './engine/ticket-generator';

export interface TicketResponse {
  ticket_no: string;
  multiplier: number;
  win_tier: string;
  hit_count: number;
  w_numbers: string[];
  y_numbers: string[];
  amount_layout: { amounts: number[] };
}

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket)
    private readonly tickets: Repository<Ticket>,
  ) {}

  async generate(dto: GenerateTicketDto): Promise<TicketResponse> {
    const multiplier = roundMoney(sumCombination(dto.combination));
    assertBasicCombinationRules(multiplier, dto.combination);
    const { winTier, hitCount } = assertReferenceRow(multiplier, dto.combination);
    const isLoss = multiplier === 0;

    const hitAmounts = isLoss ? [] : dto.combination.map(roundMoney);
    const layout = generateTicketLayout(hitCount, isLoss, hitAmounts);

    const id = newTicketId();
    const ticketNo = formatTicketNumber();

    const row = this.tickets.create({
      id,
      multiplier: roundMoney(multiplier).toFixed(4),
      combination: dto.combination.map(roundMoney),
      hit_count: hitCount,
      win_tier: winTier,
      w_numbers: layout.w_numbers,
      y_numbers: layout.y_numbers,
      near_miss_positions: layout.near_miss_positions,
      amount_layout: layout.amount_layout,
      ticket_no: ticketNo,
    });

    await this.tickets.save(row);

    return {
      ticket_no: row.ticket_no,
      multiplier,
      win_tier: winTier,
      hit_count: hitCount,
      w_numbers: layout.w_numbers,
      y_numbers: layout.y_numbers,
      amount_layout: { amounts: layout.amount_layout.amounts },
    };
  }
}
