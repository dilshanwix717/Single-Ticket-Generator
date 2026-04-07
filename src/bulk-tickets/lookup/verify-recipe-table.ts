import {
  RECIPES,
  BATCH_SIZE,
  totalRecipeCount,
  countsByWinTier,
  assertRecipeTotals,
} from './recipe-table';

assertRecipeTotals();

const total = totalRecipeCount();
const byTier = countsByWinTier();
const noWinRows = RECIPES.filter((r) => r.win_tier === 'NO_WIN').length;

console.log('Recipe table verification');
console.log('-------------------------');
console.log(`Rows         : ${RECIPES.length}`);
console.log(`Total count  : ${total.toLocaleString()}`);
console.log(`Expected     : ${BATCH_SIZE.toLocaleString()}`);
console.log(`Match        : ${total === BATCH_SIZE ? 'YES' : 'NO'}`);
console.log(`NO_WIN rows  : ${noWinRows}`);
console.log('');
console.log('Counts by win_tier:');
for (const [tier, count] of Object.entries(byTier)) {
  const pct = ((count / BATCH_SIZE) * 100).toFixed(4);
  console.log(`  ${tier.padEnd(10)} ${count.toString().padStart(10)}  (${pct}%)`);
}
