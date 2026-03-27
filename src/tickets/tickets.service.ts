import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket } from './entities/ticket.entity';
import { GenerateTicketDto } from './dto/generate-ticket.dto';
import {
  assertBasicCombinationRules,
  assertPayout,
  assertReferenceRow,
} from './validation/reference.validator';
import { roundMoney } from './validation/numeric.utils';
import {
  formatTicketNumber,
  generateTicketLayout,
  MAX_GENERATION_ATTEMPTS,
  newTicketId,
} from './engine/ticket-generator';

export interface TicketResponse {
  ticket_no: string;
  multiplier: number;
  win_tier: string;
  hit_count: number;
  payout: number;
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

  /**
   * End-to-end flow: validate → derive tier/payout → generate scratch + amounts with
   * bounded retries → assign ULID id + `ticket_no` → persist JSONB layouts → return DTO.
   */
  async generate(dto: GenerateTicketDto): Promise<TicketResponse> {
    assertBasicCombinationRules(
      dto.multiplier,
      dto.bet_amount,
      dto.combination,
    );
    const { winTier, hitCount } = assertReferenceRow(
      dto.multiplier,
      dto.combination,
    );
    const payout = assertPayout(dto.multiplier, dto.bet_amount);
    const isLoss = dto.multiplier === 0;

    let layout;
    try {
      layout = generateTicketLayout(hitCount, isLoss);
    } catch {
      throw new ServiceUnavailableException(
        `Ticket generation failed after ${MAX_GENERATION_ATTEMPTS} attempts`,
      );
    }

    const id = newTicketId();
    const ticketNo = formatTicketNumber(id);

    const row = this.tickets.create({
      id,
      player_id: dto.player_id,
      bet_amount: roundMoney(dto.bet_amount).toFixed(4),
      multiplier: roundMoney(dto.multiplier).toFixed(4),
      combination: dto.combination.map(roundMoney),
      hit_count: hitCount,
      win_tier: winTier,
      payout: roundMoney(payout).toFixed(4),
      w_numbers: layout.w_numbers,
      y_numbers: layout.y_numbers,
      near_miss_positions: layout.near_miss_positions,
      amount_layout: layout.amount_layout,
      ticket_no: ticketNo,
    });

    await this.tickets.save(row);

    return {
      ticket_no: row.ticket_no,
      multiplier: dto.multiplier,
      win_tier: winTier,
      hit_count: hitCount,
      payout,
      w_numbers: layout.w_numbers,
      y_numbers: layout.y_numbers,
      amount_layout: { amounts: layout.amount_layout.amounts },
    };
  }
}
