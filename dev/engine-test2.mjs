
import { findWarning, buildPlan, buildInsights } from './build/engine.js';
const profile = {
  startingBalance: 2000, monthlyIncome: 20000, payday: 25, safetyBuffer: 500,
  fixed: [
    { id: '1', name: 'Rent', amount: 9000, category: 'housing', dueDay: 5 },
    { id: '2', name: 'Gym', amount: 500, category: 'subscriptions', dueDay: 8 },
  ],
  variable: [
    { id: '3', name: 'Groceries', amount: 5000, category: 'food' },
    { id: '4', name: 'Dining out', amount: 7000, category: 'dining' },
  ],
  incoming: [{ id: '5', name: 'Freelance gig', amount: 4000, kind: 'once', inMonths: 1 }],
  updatedAt: new Date().toISOString(),
};
const w = findWarning(profile, 90);
console.log('warning:', w ? 'in ' + w.daysAhead + ' days (' + w.date.toDateString() + ') short ' + Math.round(w.shortfall) : 'NONE');
if (w) console.log('cause:', w.cause);
const plan = w ? buildPlan(profile, w) : [];
plan.forEach(p => console.log(' *', p.title, '(+' + p.impact + ')'));
const ins = buildInsights(profile);
console.log('runoutDay:', ins.runoutDay, '| tightWeek:', ins.tightWeek, '| net:', ins.netMonthly, '| firstDanger:', ins.firstDanger && ins.firstDanger.label);
