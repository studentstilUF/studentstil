-- =====================================================================
-- Studentstils produkter. Kör EFTER schema.sql (SQL Editor → New query → Run).
-- Filen går att köra igen: befintliga produkter uppdateras, och produkter
-- som inte finns med här döljs i butiken (active = false) i stället för att
-- raderas, så att gamla ordrar fortfarande hänger ihop.
--
-- Ändra sedan priser, texter och lager i Supabase Table Editor
-- (tabellerna "products" och "product_sizes"). Priser är hela kronor inkl. moms.
-- =====================================================================

-- bulk_price_sek = klasspris i klassbeställningar med minst 25 overaller:
-- ordinarie pris × 0,9 (10 % rabatt), avrundat till hela kronor (sprayfärgen avrundad ned till 69).
insert into products (id, name, description, price_sek, image, gallery, featured, active, sort_order, variant_label, bulk_price_sek) values
  ('studentoverall', 'Studentoverall',
   'Modern vit studentoverall i 100 % bomull med dold knäppning för en stilren look. Gjord för att bäras nercabbad på flaket – och för att klasskompisarna ska skriva och spraya på den. Ett minne för livet.',
   299, '/bilder/overall/framsida.png',
   array['/bilder/overall/baksida.png', '/bilder/overall/sida-1.png', '/bilder/overall/sida-2.png'],
   true, true, 10, 'Storlek', 269),
  ('sprayfarg', 'Sprayfärg',
   'Sprayfärg i 400 ml-burk med högt tryck och blank yta. Ventilen ger mycket färg men är mjuk, så strålen är lätt att styra. Perfekt för att sätta klassens tag på overallen.',
   79, '/bilder/sprayfarg/sprayburk.jpg', '{}', true, true, 20, 'Färg', 69),
  ('spritpenna', 'Spritpennor 8-pack',
   'Set med 8 färgpennor i olika färger med vattentätt och blekningsbeständigt bläck. Perfekt för autografer, namn och hälsningar på overallen.',
   139, '/bilder/spritpennor/forpackning.jpg', array['/bilder/spritpennor/forpackning-2.jpg'],
   true, true, 30, 'Förpackning', 125)
on conflict (id) do update set
  bulk_price_sek = excluded.bulk_price_sek,
  name = excluded.name,
  description = excluded.description,
  price_sek = excluded.price_sek,
  image = excluded.image,
  gallery = excluded.gallery,
  featured = excluded.featured,
  active = excluded.active,
  sort_order = excluded.sort_order,
  variant_label = excluded.variant_label;

-- Dölj alla andra produkter (t.ex. tidigare exempelprodukter).
update products set active = false
 where id not in ('studentoverall', 'sprayfarg', 'spritpenna');

insert into product_sizes (product_id, size, stock, sort_order) values
  ('studentoverall', 'XS', 5, 1),
  ('studentoverall', 'S', 10, 2),
  ('studentoverall', 'M', 15, 3),
  ('studentoverall', 'L', 15, 4),
  ('studentoverall', 'XL', 8, 5),
  ('sprayfarg', 'Gul', 10, 1),
  ('sprayfarg', 'Grön', 10, 2),
  ('sprayfarg', 'Orange', 10, 3),
  ('sprayfarg', 'Rosa', 10, 4),
  ('sprayfarg', 'Blå', 10, 5),
  ('sprayfarg', 'Röd', 10, 6),
  ('spritpenna', '8 färger', 30, 1)
-- Lagret ändras inte om raden redan finns, men ordningen uppdateras.
on conflict (product_id, size) do update set sort_order = excluded.sort_order;

-- Spritpennorna säljs som ett paket (inget färgval). Ta bort gamla lösa färger om de finns.
delete from product_sizes
 where product_id = 'spritpenna' and size <> '8 färger';

-- Sprayfärgen finns i gul, grön, orange, rosa, blå och röd. Ta bort andra färger.
delete from product_sizes
 where product_id = 'sprayfarg' and size not in ('Gul', 'Grön', 'Orange', 'Rosa', 'Blå', 'Röd');

-- Overallen säljs bara i XS–XL. Ta bort andra storlekar om de finns sedan tidigare.
delete from product_sizes
 where product_id = 'studentoverall' and size not in ('XS', 'S', 'M', 'L', 'XL');
