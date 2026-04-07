export type WinTier =
  | 'NO_WIN'
  | 'WIN'
  | 'BIG_WIN'
  | 'SUPER_WIN'
  | 'MEGA_WIN'
  | 'JACKPOT';

export interface Recipe {
  multiplier: number;
  combination: number[];
  win_tier: WinTier;
  count: number;
}
