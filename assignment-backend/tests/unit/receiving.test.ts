describe('Receiving Business Rules', () => {
  interface LineItem {
    id: string;
    description: string;
    ordered_quantity: number;
    received_quantity: number;
  }

  function processReceipt(line: LineItem, quantityToReceive: number): { updatedLine: LineItem; complete: boolean } {
    const newReceived = line.received_quantity + quantityToReceive;
    if (newReceived > line.ordered_quantity) {
      throw new Error(`Recording receipt of ${quantityToReceive} would exceed ordered quantity (${newReceived} > ${line.ordered_quantity})`);
    }
    const updatedLine = { ...line, received_quantity: newReceived };
    return {
      updatedLine,
      complete: updatedLine.received_quantity === updatedLine.ordered_quantity,
    };
  }

  it('leaves requisition status as Ordered on partial receipt', () => {
    const line: LineItem = { id: 'line-1', description: 'Item 1', ordered_quantity: 10, received_quantity: 0 };
    const { updatedLine, complete } = processReceipt(line, 4);

    expect(updatedLine.received_quantity).toBe(4);
    expect(complete).toBe(false);
  });

  it('completes line and triggers Received status when all items arrive', () => {
    const line: LineItem = { id: 'line-1', description: 'Item 1', ordered_quantity: 10, received_quantity: 5 };
    const { updatedLine, complete } = processReceipt(line, 5);

    expect(updatedLine.received_quantity).toBe(10);
    expect(complete).toBe(true);
  });

  it('rejects receiving quantities that exceed ordered quantity', () => {
    const line: LineItem = { id: 'line-1', description: 'Item 1', ordered_quantity: 10, received_quantity: 8 };
    
    expect(() => processReceipt(line, 3)).toThrow(
      'Recording receipt of 3 would exceed ordered quantity (11 > 10)'
    );
  });
});
