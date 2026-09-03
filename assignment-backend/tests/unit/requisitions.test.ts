describe('Requisitions & Line Items Calculation Rules', () => {
  interface LineItemInput {
    ordered_quantity: number;
    unit_price: number;
  }

  function calculateServerTotal(lines: LineItemInput[]): string {
    const total = lines.reduce((acc, line) => acc + line.ordered_quantity * line.unit_price, 0);
    return total.toFixed(2);
  }

  it('calculates requisition total accurately from line items', () => {
    const lines = [
      { ordered_quantity: 2, unit_price: 15.50 },
      { ordered_quantity: 1, unit_price: 100.00 },
      { ordered_quantity: 5, unit_price: 4.99 },
    ];

    // (2 * 15.50) + (1 * 100.00) + (5 * 4.99) = 31 + 100 + 24.95 = 155.95
    expect(calculateServerTotal(lines)).toBe('155.95');
  });

  it('returns 0.00 total for requisitions without line items', () => {
    expect(calculateServerTotal([])).toBe('0.00');
  });
});
