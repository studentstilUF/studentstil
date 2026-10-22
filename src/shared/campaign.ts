/**
 * Kampanjen för de första kunderna (räknas i create_order i supabase/schema.sql):
 *  - "gratis-overall": en av de 3 första vanliga beställningarna – en overall gratis.
 *  - "flak-celsius":   en av de 3 första klassbeställningarna – ett flak Celsius ingår.
 */
import * as v from 'valibot';

export const CampaignSchema = v.picklist(['gratis-overall', 'flak-celsius']);
export type Campaign = v.InferOutput<typeof CampaignSchema>;

/** Hur många beställningar av varje sort som får kampanjen. */
export const CAMPAIGN_LIMIT = 3;

export function campaignLabel(campaign: Campaign): string {
  return campaign === 'gratis-overall'
    ? 'En overall gratis – du är en av de 3 första som beställt!'
    : 'Ett flak Celsius ingår – ni är en av de 3 första klasserna som beställt!';
}

/** Kort text för admin, CSV och packsedel. */
export function campaignShortLabel(campaign: Campaign): string {
  return campaign === 'gratis-overall' ? 'Gratis overall' : 'Flak Celsius';
}
