-- ChemStab Industrial — PostgreSQL Initialization
-- Enable extensions for full-text search and trigram matching

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Create indexes for molecule search performance
-- (Tables created by SQLAlchemy, this adds PostgreSQL-specific indexes)

-- Trigram indexes for fuzzy molecule name search
-- CREATE INDEX IF NOT EXISTS idx_molecule_name_trgm ON molecules USING gin (name gin_trgm_ops);
-- CREATE INDEX IF NOT EXISTS idx_molecule_smiles_trgm ON molecules USING gin (canonical_smiles gin_trgm_ops);

-- Set default search path
ALTER DATABASE chemstab_industrial SET search_path TO public;
