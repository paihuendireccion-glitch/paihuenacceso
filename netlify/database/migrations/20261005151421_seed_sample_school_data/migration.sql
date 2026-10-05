-- Custom SQL migration file, put your code below! ---- Datos de ejemplo (marcados con is_sample = true). Se pueden borrar desde Administración.
INSERT INTO "courses" ("id", "name", "level", "teacher_name", "is_sample") VALUES
  ('11111111-1111-1111-1111-111111111111', 'Medio Mayor A', 'Medio Mayor', 'Profesora Carla Rojas', true),
  ('22222222-2222-2222-2222-222222222222', 'NT1 A', 'NT1', 'Profesora Marta Silva', true),
  ('33333333-3333-3333-3333-333333333333', 'NT2 A', 'NT2', 'Profesora Ana Muñoz', true);
--> statement-breakpoint
INSERT INTO "students" ("id", "course_id", "list_number", "enrollment_number", "level", "apellido_paterno", "apellido_materno", "nombres", "run_ipe", "birth_date", "sex", "nee_full_support", "address", "comuna", "guardian_interview", "is_sample") VALUES
  ('a1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 1, 'M-2026-001', 'Medio Mayor', 'Aguilar', 'Pérez', 'Sofía Antonia', '25.123.456-7', '2022-04-12', 'Femenino', false, 'Los Aromos 145', 'Temuco', 'Familia participativa. Se acuerda apoyo en lenguaje.', true),
  ('a1000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 2, 'M-2026-002', 'Medio Mayor', 'Bravo', 'Soto', 'Matías Ignacio', '25.234.567-8', '2022-07-03', 'Masculino', true, 'Pasaje El Roble 22', 'Padre Las Casas', 'Requiere apoyo completo, informe fonoaudiológico entregado.', true),
  ('a1000000-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 1, 'M-2026-010', 'NT1', 'Cárdenas', 'Lagos', 'Emilia Paz', '24.876.543-2', '2021-02-18', 'Femenino', false, 'Av. Alemania 1220', 'Temuco', 'Sin observaciones relevantes.', true),
  ('a1000000-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 2, 'M-2026-011', 'NT1', 'Díaz', 'Muñoz', 'Benjamín Andrés', '24.765.432-1', '2021-05-30', 'Masculino', false, 'Caupolicán 780', 'Temuco', 'Apoderada solicita reuniones mensuales.', true),
  ('a1000000-0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', 3, 'M-2026-012', 'NT1', 'Espinoza', 'Vidal', 'Isidora Belén', '24.654.321-9', '2021-09-14', 'Femenino', true, 'Los Cerezos 45', 'Freire', 'Ingresa con apoyo PIE.', true),
  ('a1000000-0000-0000-0000-000000000006', '33333333-3333-3333-3333-333333333333', 1, 'M-2026-020', 'NT2', 'Fuentes', 'Riquelme', 'Tomás Alonso', '23.543.210-8', '2020-03-08', 'Masculino', false, 'Bulnes 350', 'Temuco', 'Buena adaptación.', true),
  ('a1000000-0000-0000-0000-000000000007', '33333333-3333-3333-3333-333333333333', 2, 'M-2026-021', 'NT2', 'González', 'Herrera', 'Amanda Josefa', '23.432.109-7', '2020-06-25', 'Femenino', false, 'Los Notros 89', 'Padre Las Casas', 'Se registra entrevista inicial completa.', true),
  ('a1000000-0000-0000-0000-000000000008', '33333333-3333-3333-3333-333333333333', 3, 'M-2026-022', 'NT2', 'Huenchur', 'Painen', 'Lautaro Nahuel', '23.321.098-6', '2020-11-02', 'Masculino', false, 'Camino Labranza km 4', 'Temuco', 'Familia mapuche, solicita apoyo intercultural.', true);
--> statement-breakpoint
INSERT INTO "guardians" ("student_id", "list_number", "apellido_paterno", "apellido_materno", "nombres", "address", "comuna", "phone", "email", "observations")
SELECT s.id, s.list_number, s.apellido_paterno, s.apellido_materno, 'Apoderado/a de ' || s.nombres, s.address, s.comuna,
  '+569' || lpad((floor(random() * 90000000) + 10000000)::text, 8, '0'),
  lower(replace(s.apellido_paterno, ' ', '')) || '.apoderado@correo.cl', 'Contacto preferente por teléfono.'
FROM "students" s WHERE s.is_sample;
--> statement-breakpoint
INSERT INTO "health_records" ("student_id", "blood_type", "notes")
SELECT id, (ARRAY['O+','A+','B+','O-','A-'])[1 + (row_number() OVER (ORDER BY id))::int % 5], 'Ficha de salud actualizada al inicio del año escolar.'
FROM "students" WHERE is_sample;
--> statement-breakpoint
INSERT INTO "health_allergies" ("student_id", "name", "severity") VALUES
  ('a1000000-0000-0000-0000-000000000002', 'Maní', 'Alta'),
  ('a1000000-0000-0000-0000-000000000002', 'Polen', 'Media'),
  ('a1000000-0000-0000-0000-000000000005', 'Penicilina', 'Alta'),
  ('a1000000-0000-0000-0000-000000000007', 'Lactosa', 'Baja');
--> statement-breakpoint
INSERT INTO "health_conditions" ("student_id", "name", "notes") VALUES
  ('a1000000-0000-0000-0000-000000000002', 'Asma', 'Usa inhalador, disponible en enfermería.'),
  ('a1000000-0000-0000-0000-000000000005', 'Trastorno del lenguaje', 'Atención fonoaudiológica semanal.');
--> statement-breakpoint
INSERT INTO "emergency_contacts" ("student_id", "name", "relationship", "phone")
SELECT id, 'Contacto de ' || nombres, 'Madre', '+56912345678' FROM "students" WHERE is_sample;
--> statement-breakpoint
INSERT INTO "student_movements" ("student_id", "movement_date", "movement_type", "reason", "observations", "responsible") VALUES
  ('a1000000-0000-0000-0000-000000000004', '2026-04-15', 'Cambio de jornada', 'Trabajo de la apoderada', 'Pasa de jornada mañana a tarde.', 'Jefa de UTP'),
  ('a1000000-0000-0000-0000-000000000006', '2026-06-02', 'Cambio Escuela Paihuen - Paihuen Mapu', 'Cercanía al domicilio', 'Traslado interno autorizado.', 'Jefa de UTP');
--> statement-breakpoint
INSERT INTO "attendance" ("student_id", "course_id", "attendance_date", "status")
SELECT s.id, s.course_id, d::date,
  CASE WHEN random() < 0.86 THEN 'presente' WHEN random() < 0.6 THEN 'justificado' ELSE 'ausente' END
FROM "students" s
CROSS JOIN generate_series('2026-08-03'::date, '2026-10-02'::date, interval '1 day') d
WHERE s.is_sample AND extract(isodow FROM d) < 6;
