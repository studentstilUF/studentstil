/**
 * Kampanjen för de första kunderna (räknas i create_order i supabase/schema.sql):
 *  - "gratis-overall": en av de 5 första vanliga beställningarna – betalar fullt pris
 *    och får en återbetalning för en overall i efterhand.
 *  - "flak-celsius":   en av de 5 första klassbeställningarna – ett flak Celsius ingår.
 */
import * as v from 'valibot';

export const CampaignSchema = v.picklist(['gratis-overall', 'flak-celsius']);
export type Campaign = v.InferOutput<typeof CampaignSchema>;

/** Hur många beställningar av varje sort som får kampanjen. */
export const CAMPAIGN_LIMIT = 5;

export function campaignLabel(campaign: Campaign): string {
  return campaign === 'gratis-overall'
    ? 'Du är en av de fem första som beställt! En återbetalning för en overall görs när vi har registrerat din betalning.'
    : 'Ett flak Celsius ingår – ni är en av de 5 första klasserna som beställt!';
}

/** Kort text för admin, CSV och packsedel. */
export function campaignShortLabel(campaign: Campaign): string {
  return campaign === 'gratis-overall' ? 'Återbetala en overall' : 'Flak Celsius';
}
