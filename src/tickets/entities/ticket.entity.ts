import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('tickets')
export class Ticket {
  @PrimaryColumn({ type: 'varchar', length: 26 })
  id!: string;

  @Column({ type: 'varchar', length: 128 })
  player_id!: string;

  @Column({ type: 'decimal', precision: 14, scale: 4 })
  bet_amount!: string;

  @Column({ type: 'decimal', precision: 14, scale: 4 })
  multiplier!: string;

  @Column({ type: 'jsonb' })
  combination!: number[];

  @Column({ type: 'int' })
  hit_count!: number;

  @Column({ type: 'varchar', length: 32 })
  win_tier!: string;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  payout!: string;

  @Column({ type: 'jsonb' })
  w_numbers!: string[];

  @Column({ type: 'jsonb' })
  y_numbers!: string[];

  @Column({ type: 'jsonb' })
  near_miss_positions!: number[];

  @Column({ type: 'jsonb' })
  amount_layout!: { amounts: number[]; tiers: string[] };

  @Column({ type: 'varchar', length: 64, unique: true })
  ticket_no!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
