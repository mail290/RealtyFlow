-- =====================================================================
-- Seed: locales (i18n layer 2) and trade taxonomy with no/en/es names
-- =====================================================================

insert into locales (code, name_en, rtl) values
  ('no', 'Norwegian', false),
  ('en', 'English',   false),
  ('es', 'Spanish',   false),
  ('de', 'German',    false),
  ('nl', 'Dutch',     false),
  ('sv', 'Swedish',   false),
  ('da', 'Danish',    false),
  ('fr', 'French',    false),
  ('pt', 'Portuguese',false),
  ('el', 'Greek',     false)
on conflict (code) do nothing;

insert into trades (code, sort_order) values
  ('plumbing', 1),
  ('electrical', 2),
  ('hvac', 3),
  ('pool', 4),
  ('gardening', 5),
  ('awnings', 6),
  ('glazing', 7),
  ('locksmith', 8),
  ('cleaning', 9),
  ('pest_control', 10),
  ('roofing', 11),
  ('painting', 12),
  ('appliances', 13),
  ('alarm_security', 14),
  ('general', 15)
on conflict (code) do nothing;

-- Spanish names reviewed-pending: trade terminology (vannlås/sluk/rejas)
-- should be checked by a native speaker before production, per Phase 1 brief.
insert into trade_translations (trade_code, locale, name) values
  ('plumbing','no','Rørlegger'),          ('plumbing','en','Plumbing'),            ('plumbing','es','Fontanería'),
  ('electrical','no','Elektriker'),        ('electrical','en','Electrical'),        ('electrical','es','Electricidad'),
  ('hvac','no','Klima og ventilasjon'),    ('hvac','en','HVAC'),                    ('hvac','es','Climatización'),
  ('pool','no','Basseng'),                 ('pool','en','Pool'),                    ('pool','es','Piscina'),
  ('gardening','no','Hage og grønt'),      ('gardening','en','Gardening'),          ('gardening','es','Jardinería'),
  ('awnings','no','Markiser og persienner'),('awnings','en','Awnings and blinds'),  ('awnings','es','Toldos y persianas'),
  ('glazing','no','Glass og vinduer'),     ('glazing','en','Glazing'),              ('glazing','es','Cristalería'),
  ('locksmith','no','Låsesmed'),           ('locksmith','en','Locksmith'),          ('locksmith','es','Cerrajería'),
  ('cleaning','no','Renhold'),             ('cleaning','en','Cleaning'),            ('cleaning','es','Limpieza'),
  ('pest_control','no','Skadedyrkontroll'),('pest_control','en','Pest control'),    ('pest_control','es','Control de plagas'),
  ('roofing','no','Tak og takrenner'),     ('roofing','en','Roofing'),              ('roofing','es','Tejados'),
  ('painting','no','Maler'),               ('painting','en','Painting'),            ('painting','es','Pintura'),
  ('appliances','no','Hvitevarer'),        ('appliances','en','Appliances'),        ('appliances','es','Electrodomésticos'),
  ('alarm_security','no','Alarm og sikkerhet'),('alarm_security','en','Alarm and security'),('alarm_security','es','Alarma y seguridad'),
  ('general','no','Generelt'),             ('general','en','General'),              ('general','es','General')
on conflict (trade_code, locale) do nothing;
