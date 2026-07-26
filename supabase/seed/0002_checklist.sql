-- =====================================================================
-- Seed: standard 42-point checklist (generated from checklist-seed.csv)
-- Do not edit by hand — regenerate via scripts/gen_checklist_seed.mjs
-- =====================================================================
-- Checklist items carry org_id (Principle 1), so the template is created
-- per organisation. This reusable function provisions the standard
-- template for any org (used at seed time and when onboarding a new
-- SaaS tenant). Editing an item later means bumping to a new version;
-- this function always creates version 1 of code 'standard'.
-- =====================================================================

create or replace function kh_seed_default_checklist(p_org_id uuid)
returns uuid
language plpgsql
as $fn$
declare
  v_template_id uuid;
  v_item_id     uuid;
begin
  insert into kh_checklist_templates(
      org_id, code, version, name, property_types, min_photos, is_active)
    values (
      p_org_id, 'standard', 1, 'Standard 42-punkts tilsyn',
      '{apartment,townhouse,villa,finca}', 14, true)
    returning id into v_template_id;

  insert into kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'arrival.checkin', 1, 'arrival_exterior',
      false, false, null, '{apartment,townhouse,villa,finca}', true)
    returning id into v_item_id;
  insert into kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Ankomst registrert — GPS og klokkeslett'),
    (v_item_id, 'en', 'Arrival registered — GPS and time'),
    (v_item_id, 'es', 'Llegada registrada — GPS y hora');

  insert into kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'exterior.facade', 2, 'arrival_exterior',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Fasade og yttervegger — sprekker og fuktmerker'),
    (v_item_id, 'en', 'Façade and exterior walls — cracks and damp marks'),
    (v_item_id, 'es', 'Fachada y muros exteriores — grietas y manchas de humedad');

  insert into kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'exterior.roof_gutters', 3, 'arrival_exterior',
      false, false, null, '{townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Tak, takrenner og nedløp'),
    (v_item_id, 'en', 'Roof, gutters and downpipes'),
    (v_item_id, 'es', 'Tejado, canalones y bajantes');

  insert into kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'exterior.terrace', 4, 'arrival_exterior',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Terrasse og utegulv — løse fliser og avrenning'),
    (v_item_id, 'en', 'Terrace and outdoor flooring — loose tiles and drainage'),
    (v_item_id, 'es', 'Terraza y suelos exteriores — baldosas sueltas y desagüe');

  insert into kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'exterior.furniture', 5, 'arrival_exterior',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Utemøbler, parasoll og puter — sikret'),
    (v_item_id, 'en', 'Outdoor furniture, parasol and cushions — secured'),
    (v_item_id, 'es', 'Mobiliario de exterior, sombrilla y cojines — asegurados');

  insert into kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'exterior.awnings', 6, 'arrival_exterior',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Markiser og utvendige persienner'),
    (v_item_id, 'en', 'Awnings and external blinds'),
    (v_item_id, 'es', 'Toldos y persianas exteriores');

  insert into kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'exterior.garden', 7, 'arrival_exterior',
      false, false, null, '{townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Hage, potteplanter og vanningsanlegg'),
    (v_item_id, 'en', 'Garden, potted plants and irrigation'),
    (v_item_id, 'es', 'Jardín, plantas en maceta y sistema de riego');

  insert into kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'security.entrance_door', 8, 'security_access',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Inngangsdør, lås og sylinder'),
    (v_item_id, 'en', 'Entrance door, lock and cylinder'),
    (v_item_id, 'es', 'Puerta de entrada, cerradura y bombín');

  insert into kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'security.rejas', 9, 'security_access',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Rejas og sikkerhetsgitter'),
    (v_item_id, 'en', 'Security bars (rejas)'),
    (v_item_id, 'es', 'Rejas de seguridad');

  insert into kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'security.windows', 10, 'security_access',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Vinduer og balkongdører — lukket og låst'),
    (v_item_id, 'en', 'Windows and balcony doors — closed and locked'),
    (v_item_id, 'es', 'Ventanas y puertas de balcón — cerradas y con llave');

  insert into kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'security.alarm', 11, 'security_access',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Alarm — status, testsignal og batterinivå'),
    (v_item_id, 'en', 'Alarm — status, test signal and battery level'),
    (v_item_id, 'es', 'Alarma — estado, señal de prueba y nivel de batería');

  insert into kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'security.sensors', 12, 'security_access',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Bevegelses- og dørsensorer'),
    (v_item_id, 'en', 'Motion and door sensors'),
    (v_item_id, 'es', 'Sensores de movimiento y de puerta');

  insert into kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'security.advertising', 13, 'security_access',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Reklame, aviser og pakkelapper fjernet'),
    (v_item_id, 'en', 'Advertising, newspapers and parcel notes removed'),
    (v_item_id, 'es', 'Publicidad, periódicos y avisos de paquetería retirados');

  insert into kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'security.intrusion', 14, 'security_access',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Spor etter innbruddsforsøk eller uvedkommende'),
    (v_item_id, 'en', 'Signs of attempted intrusion or trespass'),
    (v_item_id, 'es', 'Indicios de intento de robo o intrusión');

  insert into kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'mail.collected', 15, 'mail_documents',
      false, true, 'count', '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Postkasse tømt — antall forsendelser'),
    (v_item_id, 'en', 'Mailbox emptied — number of items'),
    (v_item_id, 'es', 'Buzón vaciado — número de envíos');

  insert into kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'mail.official', 16, 'mail_documents',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Post fra ayuntamiento, Suma, forsikring eller sameie'),
    (v_item_id, 'en', 'Mail from town hall, Suma, insurer or community'),
    (v_item_id, 'es', 'Correo del ayuntamiento, Suma, aseguradora o comunidad');

  insert into kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'mail.scanned', 17, 'mail_documents',
      true, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Fristbelagte brev skannet og lastet opp'),
    (v_item_id, 'en', 'Time-sensitive letters scanned and uploaded'),
    (v_item_id, 'es', 'Cartas con plazo escaneadas y subidas');

  insert into kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'water.trap_kitchen', 18, 'water_drainage',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Vannlås kjøkken — fylt'),
    (v_item_id, 'en', 'Kitchen drain trap — filled'),
    (v_item_id, 'es', 'Sifón de la cocina — lleno');

  insert into kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'water.trap_bath1', 19, 'water_drainage',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Vannlås bad 1 — fylt'),
    (v_item_id, 'en', 'Bathroom 1 drain trap — filled'),
    (v_item_id, 'es', 'Sifón del baño 1 — lleno');

  insert into kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'water.trap_bath2', 20, 'water_drainage',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Vannlås bad 2 eller gjeste-wc — fylt'),
    (v_item_id, 'en', 'Bathroom 2 or guest WC trap — filled'),
    (v_item_id, 'es', 'Sifón del baño 2 o aseo — lleno');

  insert into kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'water.floor_drains', 21, 'water_drainage',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Sluk i dusj og badegulv — spylt og luktfritt'),
    (v_item_id, 'en', 'Shower and floor drains — flushed and odour-free'),
    (v_item_id, 'es', 'Desagües de ducha y suelo — enjuagados y sin olor');

  insert into kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'water.toilets', 22, 'water_drainage',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Toaletter spylt, ingen renning i sisterne'),
    (v_item_id, 'en', 'Toilets flushed, no running cistern'),
    (v_item_id, 'es', 'Inodoros descargados, cisterna sin pérdidas');

  insert into kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'water.leaks', 23, 'water_drainage',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Under vask og bak wc — ingen synlig lekkasje'),
    (v_item_id, 'en', 'Under sinks and behind WC — no visible leaks'),
    (v_item_id, 'es', 'Bajo fregaderos y tras el inodoro — sin fugas visibles');

  insert into kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'water.boiler', 24, 'water_drainage',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Varmtvannsbereder — trykk, temperatur, ingen drypp'),
    (v_item_id, 'en', 'Water heater — pressure, temperature, no dripping'),
    (v_item_id, 'es', 'Termo o caldera — presión, temperatura, sin goteo');

  insert into kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'water.stopcock', 25, 'water_drainage',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Stoppekran og vanntrykk i anlegget'),
    (v_item_id, 'en', 'Stopcock and system water pressure'),
    (v_item_id, 'es', 'Llave de paso y presión de la instalación');

  insert into kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'climate.ventilation', 26, 'climate_indoor',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Krysslufting gjennomført, 30–45 minutter'),
    (v_item_id, 'en', 'Cross-ventilation completed, 30–45 minutes'),
    (v_item_id, 'es', 'Ventilación cruzada realizada, 30–45 minutos');

  insert into kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'climate.temperature', 27, 'climate_indoor',
      false, true, 'C', '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Innetemperatur'),
    (v_item_id, 'en', 'Indoor temperature'),
    (v_item_id, 'es', 'Temperatura interior');

  insert into kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'climate.humidity', 28, 'climate_indoor',
      false, true, 'pct', '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Relativ luftfuktighet'),
    (v_item_id, 'en', 'Relative humidity'),
    (v_item_id, 'es', 'Humedad relativa');

  insert into kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'climate.mould', 29, 'climate_indoor',
      true, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Mugg- og fuktkontroll — skap, hjørner, bak møbler'),
    (v_item_id, 'en', 'Mould and damp check — cupboards, corners, behind furniture'),
    (v_item_id, 'es', 'Control de moho y humedad — armarios, esquinas, tras los muebles');

  insert into kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'climate.ac_cooling', 30, 'climate_indoor',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Klimaanlegg testet — kjøling'),
    (v_item_id, 'en', 'Air conditioning tested — cooling'),
    (v_item_id, 'es', 'Aire acondicionado probado — frío');

  insert into kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'climate.ac_heating', 31, 'climate_indoor',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Klimaanlegg testet — varme'),
    (v_item_id, 'en', 'Air conditioning tested — heating'),
    (v_item_id, 'es', 'Aire acondicionado probado — calor');

  insert into kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'climate.ac_filter', 32, 'climate_indoor',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'AC-filter og kondensavløp'),
    (v_item_id, 'en', 'AC filter and condensate drain'),
    (v_item_id, 'es', 'Filtro del aire y desagüe de condensados');

  insert into kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'power.breakers', 33, 'power_meters',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Sikringsskap — ingen utløste kurser'),
    (v_item_id, 'en', 'Consumer unit — no tripped breakers'),
    (v_item_id, 'es', 'Cuadro eléctrico — sin diferenciales saltados');

  insert into kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'power.electricity_meter', 34, 'power_meters',
      true, true, 'kWh', '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Strømmåler avlest'),
    (v_item_id, 'en', 'Electricity meter reading'),
    (v_item_id, 'es', 'Lectura del contador de luz');

  insert into kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'power.water_meter', 35, 'power_meters',
      true, true, 'm3', '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Vannmåler avlest'),
    (v_item_id, 'en', 'Water meter reading'),
    (v_item_id, 'es', 'Lectura del contador de agua');

  insert into kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'power.fridge', 36, 'power_meters',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Kjøleskap og fryser i drift — temperatur'),
    (v_item_id, 'en', 'Fridge and freezer running — temperature'),
    (v_item_id, 'es', 'Frigorífico y congelador en marcha — temperatura');

  insert into kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'power.timers', 37, 'power_meters',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Belysning og tidsur for tilstedeværelsessimulering'),
    (v_item_id, 'en', 'Lighting and timers for occupancy simulation'),
    (v_item_id, 'es', 'Iluminación y temporizadores de simulación de presencia');

  insert into kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'rooms.walkthrough', 38, 'rooms_checkout',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Samtlige rom visuelt gjennomgått'),
    (v_item_id, 'en', 'All rooms visually inspected'),
    (v_item_id, 'es', 'Todas las estancias inspeccionadas visualmente');

  insert into kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'rooms.pests', 39, 'rooms_checkout',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Skadedyr og insekter — spor og feller'),
    (v_item_id, 'en', 'Pests and insects — traces and traps'),
    (v_item_id, 'es', 'Plagas e insectos — rastros y trampas');

  insert into kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'rooms.appliances', 40, 'rooms_checkout',
      false, false, null, '{apartment,townhouse,villa,finca}', false)
    returning id into v_item_id;
  insert into kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Hvitevarer og elektronikk — ingen feilkoder'),
    (v_item_id, 'en', 'Appliances and electronics — no fault codes'),
    (v_item_id, 'es', 'Electrodomésticos y electrónica — sin códigos de error');

  insert into kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'pool.technical', 41, 'rooms_checkout',
      true, false, null, '{villa,finca}', false)
    returning id into v_item_id;
  insert into kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Basseng og teknisk rom — vannivå, pumpe, klarhet'),
    (v_item_id, 'en', 'Pool and plant room — water level, pump, clarity'),
    (v_item_id, 'es', 'Piscina y cuarto técnico — nivel de agua, bomba, claridad');

  insert into kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, 'checkout.secure', 42, 'rooms_checkout',
      false, false, null, '{apartment,townhouse,villa,finca}', true)
    returning id into v_item_id;
  insert into kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', 'Utsjekk — alt låst, alarm aktivert, GPS og klokkeslett'),
    (v_item_id, 'en', 'Check-out — all locked, alarm armed, GPS and time'),
    (v_item_id, 'es', 'Salida — todo cerrado, alarma activada, GPS y hora');

  return v_template_id;
end
$fn$;
