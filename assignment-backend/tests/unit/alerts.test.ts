describe('Alerts & Dismissal Business Rules', () => {
  interface AlertState {
    requisitionId: string;
    status: string;
    neededBy: string; // YYYY-MM-DD
    linesComplete: boolean;
    dismissals: Array<{ approverId: string; dismissedNeededBy: string }>;
  }

  function isAlertActiveForApprover(state: AlertState, approverId: string, currentDate: string): boolean {
    if (!['Submitted', 'Approved', 'Ordered'].includes(state.status)) return false;
    if (state.neededBy >= currentDate) return false;
    if (state.status === 'Ordered' && state.linesComplete) return false;

    // Check if dismissed for current needed_by
    const dismissal = state.dismissals.find((d) => d.approverId === approverId);
    if (dismissal && dismissal.dismissedNeededBy === state.neededBy) {
      return false; // Dismissed
    }

    return true; // Active alert
  }

  it('detects overdue requisitions in Submitted, Approved, and Ordered past needed_by date', () => {
    const submittedReq: AlertState = {
      requisitionId: 'req-sub',
      status: 'Submitted',
      neededBy: '2026-08-20',
      linesComplete: false,
      dismissals: [],
    };
    const approvedReq: AlertState = {
      requisitionId: 'req-app',
      status: 'Approved',
      neededBy: '2026-08-22',
      linesComplete: false,
      dismissals: [],
    };
    const orderedReq: AlertState = {
      requisitionId: 'req-ord',
      status: 'Ordered',
      neededBy: '2026-08-25',
      linesComplete: false,
      dismissals: [],
    };

    expect(isAlertActiveForApprover(submittedReq, 'approver-1', '2026-08-30')).toBe(true);
    expect(isAlertActiveForApprover(approvedReq, 'approver-1', '2026-08-30')).toBe(true);
    expect(isAlertActiveForApprover(orderedReq, 'approver-1', '2026-08-30')).toBe(true);
  });

  it('does not trigger alerts for future needed_by date or Draft/Rejected/Received', () => {
    const draftReq: AlertState = {
      requisitionId: 'req-draft',
      status: 'Draft',
      neededBy: '2026-08-20',
      linesComplete: false,
      dismissals: [],
    };
    const futureSubmittedReq: AlertState = {
      requisitionId: 'req-future',
      status: 'Submitted',
      neededBy: '2026-09-20',
      linesComplete: false,
      dismissals: [],
    };
    const completedOrderedReq: AlertState = {
      requisitionId: 'req-done',
      status: 'Ordered',
      neededBy: '2026-08-20',
      linesComplete: true,
      dismissals: [],
    };

    expect(isAlertActiveForApprover(draftReq, 'approver-1', '2026-08-30')).toBe(false);
    expect(isAlertActiveForApprover(futureSubmittedReq, 'approver-1', '2026-08-30')).toBe(false);
    expect(isAlertActiveForApprover(completedOrderedReq, 'approver-1', '2026-08-30')).toBe(false);
  });

  it('hides alert when dismissed by approver for current needed_by date', () => {
    const state: AlertState = {
      requisitionId: 'req-1',
      status: 'Submitted',
      neededBy: '2026-08-20',
      linesComplete: false,
      dismissals: [{ approverId: 'approver-1', dismissedNeededBy: '2026-08-20' }],
    };

    expect(isAlertActiveForApprover(state, 'approver-1', '2026-08-30')).toBe(false);
    expect(isAlertActiveForApprover(state, 'approver-2', '2026-08-30')).toBe(true); // per-approver dismissal
  });

  it('re-activates alert when needed_by date changes and passes again for Submitted, Approved, and Ordered', () => {
    const state: AlertState = {
      requisitionId: 'req-1',
      status: 'Approved',
      neededBy: '2026-08-28', // date extended to 08-28, which has now also passed
      linesComplete: false,
      dismissals: [{ approverId: 'approver-1', dismissedNeededBy: '2026-08-20' }], // dismissed for old date
    };

    expect(isAlertActiveForApprover(state, 'approver-1', '2026-08-30')).toBe(true);
  });
});
