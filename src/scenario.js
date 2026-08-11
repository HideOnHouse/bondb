export const scenarioRules = {
  rate: { label: 'Rate shock', min: -100, max: 100, unit: 'bp' },
  spread: { label: 'Spread shock', min: -100, max: 200, unit: 'bp' },
  fx: { label: 'FX shock', min: -10, max: 10, unit: '%' },
  fee: { label: 'Lending fee', min: -50, max: 100, unit: 'bp' },
  lendingRatio: { label: 'Lending ratio', min: 0, max: 100, unit: '%' },
  haircut: { label: 'Haircut', min: 0, max: 20, unit: '%' },
};

export function validateScenario(input) {
  const errors = {};
  Object.entries(scenarioRules).forEach(([key, rule]) => {
    const value = Number(input[key]);
    if (!Number.isFinite(value)) {
      errors[key] = `${rule.label} must be a number.`;
    } else if (value < rule.min || value > rule.max) {
      errors[key] = `${rule.label} must be between ${rule.min} and ${rule.max} ${rule.unit}.`;
    }
  });
  return { valid: Object.keys(errors).length === 0, errors };
}

export function calculateScenarioImpact(input) {
  return {
    pnl: (input.rate * 420000000) + (input.spread * -210000000) + ((input.fx - 1) * 8500000000),
    revenuePerDay: ((input.fee / 10_000) * 394800000000 * (input.lendingRatio / 100)) / 365,
    collateralCoverage: input.haircut * -1.8,
  };
}
