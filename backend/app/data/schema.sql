-- ============================================================
-- KAPIROLL — Tabla de nómina para Supabase
-- ============================================================

CREATE TABLE IF NOT EXISTS nomina (
    id                  BIGSERIAL PRIMARY KEY,
    cedula              TEXT        NOT NULL,
    nombre              TEXT        NOT NULL,
    area                TEXT        NOT NULL,
    tipo_contrato       TEXT        NOT NULL,
    fecha_ingreso       DATE        NOT NULL,
    periodo             TEXT        NOT NULL,            -- formato "YYYY-MM"

    -- Ingresos
    total_ingresos      NUMERIC(12,2) NOT NULL DEFAULT 0,

    -- Descuentos
    total_descuentos    NUMERIC(12,2) NOT NULL DEFAULT 0,

    -- Provisiones (obligaciones patronales)
    total_provisiones   NUMERIC(12,2) NOT NULL DEFAULT 0,

    -- Neto a recibir
    a_recibir           NUMERIC(12,2) NOT NULL DEFAULT 0,

    -- Horas extras
    h_ext_100           NUMERIC(10,2) NOT NULL DEFAULT 0,
    h_ext_50            NUMERIC(10,2) NOT NULL DEFAULT 0,
    recnocturno         NUMERIC(10,2) NOT NULL DEFAULT 0,

    -- Provisiones detalle
    decimo_13           NUMERIC(10,2) NOT NULL DEFAULT 0,
    decimo_14           NUMERIC(10,2) NOT NULL DEFAULT 0,
    vacaciones_prov     NUMERIC(10,2) NOT NULL DEFAULT 0,
    fondos_reserva      NUMERIC(10,2) NOT NULL DEFAULT 0,
    iess_patronal       NUMERIC(10,2) NOT NULL DEFAULT 0,

    -- Aportes IESS empleado
    iess_personal       NUMERIC(10,2) NOT NULL DEFAULT 0,

    -- Préstamos IESS
    pr_h_iess           NUMERIC(10,2) NOT NULL DEFAULT 0,
    pr_q_iess           NUMERIC(10,2) NOT NULL DEFAULT 0,

    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_nomina_periodo        ON nomina(periodo);
CREATE INDEX IF NOT EXISTS idx_nomina_cedula         ON nomina(cedula);
CREATE INDEX IF NOT EXISTS idx_nomina_area           ON nomina(area);
CREATE INDEX IF NOT EXISTS idx_nomina_tipo_contrato  ON nomina(tipo_contrato);
CREATE INDEX IF NOT EXISTS idx_nomina_periodo_cedula ON nomina(periodo, cedula);

-- RLS: permitir lectura pública, escritura con service role
ALTER TABLE nomina ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read"   ON nomina FOR SELECT USING (true);
CREATE POLICY "Allow service insert" ON nomina FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow service update" ON nomina FOR UPDATE USING (true);
CREATE POLICY "Allow service delete" ON nomina FOR DELETE USING (true);
