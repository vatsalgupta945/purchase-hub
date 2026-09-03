describe('Alerts & Dismissal Business Rules', () => {
  interface AlertState {
    requisitionId: string;
    status: string;
    neededBy: string; // YYYY-MM-DD
    linesComplete: boolean;
    dismissals: Array<{ approverId: string; dismissedNeededBy: string }>;
  }

  function isAlertActiveForApprover(state: AlertState, approverId: string, currentDate: string): boolean {
    if (state.status !== 'Ordered') return false;
    if (state.neededBy >= currentDate) return false;
    if (state.linesComplete) return false;

    // Check if dismissed for current needed_by
    const dismissal = state.dismissals.find((d) => d.approverId === approverId);
    if (dismissal && dismissal.dismissedNeededBy === state.neededBy) {
      return false; // Dismissed
    }

    return true; // Active alert
  }

  it('detects overdue requisitions past needed_by date with incomplete receiving', () => {
    const state: AlertState = {
      requisitionId: 'req-1',
      status: 'Ordered',
      neededBy: '2026-08-20',
      linesComplete: false,
      dismissals: [],
    };

    expect(isAlertActiveForApprover(state, 'approver-1', '2026-08-30')).toBe(true);
  });

  it('hides alert when dismissed by approver for current needed_by date', () => {
    const state: AlertState = {
      requisitionId: 'req-1',
      status: 'Ordered',
      neededBy: '2026-08-20',
      linesComplete: false,
      dismissals: [{ approverId: 'approver-1', dismissedNeededBy: '2026-08-20' }],
    };

    expect(isAlertActiveForApprover(state, 'approver-1', '2026-08-30')).toBe(false);
    expect(isAlertActiveForApprover(state, 'approver-2', '2026-08-30')).toBe(true); // per-approver dismissal
  });

  it('re-activates alert when needed_by date changes and passes again', () => {
    const state: AlertState = {
      requisitionId: 'req-1',
      status: 'Ordered',
      neededBy: '2026-08-28', // date extended to 08-28, which has now also passed
      linesComplete: false,
      dismissals: [{ approverId: 'approver-1', dismissedNeededBy: '2026-08-20' }], // dismissed for old date
    };

    expect(isAlertActiveForApprover(state, 'approver-1', '2026-08-30')).toBe(true);
  });
});
