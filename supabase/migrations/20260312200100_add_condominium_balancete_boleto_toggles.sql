ALTER TABLE omnia_condominiums
  ADD COLUMN balancete_digital BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN boleto_impresso BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN omnia_condominiums.balancete_digital IS 'Indica se o condomínio recebe balancete digital';
COMMENT ON COLUMN omnia_condominiums.boleto_impresso IS 'Indica se o condomínio recebe boleto impresso';
