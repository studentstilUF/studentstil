/**
 * Extra innehåll på produktsidorna (/produkt/?id=…): fakta i punktform och
 * storleksguide. Namn, pris, beskrivning, bilder och lager kommer från databasen
 * (Supabase → products). Det här är texter som sällan ändras – redigera dem här.
 * Nyckeln är produktens id i databasen.
 */

export type SizeGuide = {
  note: string;
  /** Måtttabell, t.ex. kolumner ['Storlek', 'Bröstvidd (cm)'] och en rad per storlek. */
  table?: {
    columns: readonly string[];
    rows: readonly (readonly string[])[];
  };
};

export type ProductInfo = {
  facts: readonly string[];
  sizeGuide?: SizeGuide;
};

const INFO: Readonly<Record<string, ProductInfo>> = {
  studentoverall: {
    // Källa: leverantörens produktblad (PROwear, art.nr PKM041301).
    facts: [
      '100 % bomull, 260 g/m²',
      'Dold knäppning för en stilren look',
      'Gjord för att bäras nercabbad',
      'Två framfickor – den högra med dragkedja',
      'Tumstocksficka på höger ben och benficka på vänster ben',
      'Resår i ryggen för bättre passform',
      'Hällor i midjan och hank på höger ben',
    ],
    sizeGuide: {
      note: 'Unisex i storlek XS–XL. Som riktmärke: en person som är 173 cm har storlek XS och en som är 187 cm har storlek M. Overallen ska sitta ledigt så att du kan ha kläder under – är du mellan två storlekar, välj den större. Måtten nedan är plaggets mått i centimeter. Jämför gärna med ett plagg som sitter bra på dig.',
      // Källa: leverantörens måttlista (PROwear Unisex overall Cotton, art.nr PKM0413).
      // Bröstvidden är dubbla "½ chest", alltså hela omkretsen.
      table: {
        columns: ['Plaggmått (cm)', 'XS', 'S', 'M', 'L', 'XL'],
        rows: [
          ['Bröstvidd', '102', '108', '114', '120', '126'],
          ['Midja', '84', '92', '98', '106', '112'],
          ['Axelbredd', '44', '46,5', '49', '51,5', '54'],
          ['Ärmlängd', '64', '65,5', '67', '68', '69'],
          ['Innerbenslängd', '80', '82', '84', '86', '88'],
        ],
      },
    },
  },
  sprayfarg: {
    // Visa inte märket i texterna. Färgen är en graffitifärg, inte en textilfärg – lova inget om tvätt.
    facts: [
      '400 ml sprayburk',
      'Högt tryck och blank yta',
      'Mjuk ventil – mycket färg men lätt att styra strålen',
      'Spraya utomhus eller med god ventilation, och skaka burken ordentligt',
      'Låt färgen torka ordentligt innan overallen används',
    ],
  },
  spritpenna: {
    // Källa: återförsäljarens produktsida (8-färgs pennset, 14,3 × 1,4 cm, fiber/ABS/filt).
    facts: [
      '8 pennor: röd, gul, grön, ljusblå, vit, svart, guld och silver',
      'Vattentätt och blekningsbeständigt bläck',
      'Spets i filt, 2,0 mm, för exakta linjer',
      'Storlek: 14,3 cm lång, 1,4 cm bred',
      'Fungerar bäst på torrt, slätt tyg',
    ],
  },
};

export function productInfo(productId: string): ProductInfo {
  return INFO[productId] ?? { facts: [] };
}
