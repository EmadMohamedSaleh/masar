
import { simulate, buildInsights, findWarning, buildPlan, loanMonthlyPayment, dailyBalances } from './build/engine.js';
const profile = {
  startingBalance: 10000, monthlyIncome: 30000, payday: 1, safetyBuffer: 0,
  fixed: [
    { id: '1', name: 'Rent', amount: 10000, category: 'housing', dueDay: 3 },
    { id: '2', name: 'Phone loan', amount: 2000, category: 'loans', dueDay: 10 },
  ],
  variable: [
    { id: '3', name: 'Groceries', amount: 6000, category: 'food' },
    { id: '4', name: 'Dining out', amount: 13000, category: 'dining' },
  ],
  incoming: [{ id: '5', name: 'Bonus', amount: 20000, kind: 'once', inMonths: 3 }],
  updatedAt: new Date().toISOString(),
};
const pts = simulate(profile, 12);
const net = 30000 - 10000 - 2000 - 6000 - 13000; // -1000
const m3 = pts[3];
const expected3 = 10000 + net * 4 + 20000;
console.log('month3 close', Math.round(m3.closingBalance), 'expected', expected3, Math.abs(m3.closingBalance - expected3) < 400 ? 'OK' : 'FAIL');
const expected11 = 10000 + net*12 + 20000;
console.log('month11 close', Math.round(pts[11].closingBalance), 'expected', expected11, Math.abs(pts[11].closingBalance - expected11) < 900 ? 'OK' : 'FAIL');
const ins = buildInsights(profile);
console.log('net', ins.netMonthly, ins.netMonthly === net ? 'OK' : 'FAIL');
console.log('topShare', ins.topShare.category, ins.topShare.pctOfIncome.toFixed(1) + '%');
console.log('runoutDay', ins.runoutDay, 'tightWeek', ins.tightWeek);
console.log('firstDanger', ins.firstDanger ? ins.firstDanger.label : 'none');
const w = findWarning(profile, 90);
console.log('warning', w ? w.daysAhead + 'd short ' + Math.round(w.shortfall) : 'none');
if (w) { const plan = buildPlan(profile, w); console.log('plan items', plan.length); plan.forEach(p => console.log(' -', p.title, '+' + p.impact)); }
console.log('loan pmt 500k/28%/60mo:', Math.round(loanMonthlyPayment(500000, 28, 60)));
const richProfile = {...profile, monthlyIncome: 50000, variable: [{ id: '3', name: 'Groceries', amount: 6000, category: 'food' }]};
const w2 = findWarning(richProfile, 90);
console.log('healthy profile warning:', w2 === null ? 'none OK' : 'FAIL day ' + w2.daysAhead);
const daily = dailyBalances(profile, 90);
console.log('daily points', daily.length, daily.length === 90 ? 'OK' : 'FAIL');
const scen = simulate(profile, 60, { kind: 'invest', label: 'inv', monthlyAmount: 2000, annualReturnPct: 20 });
console.log('invest m59: cash', Math.round(scen[59].closingBalance), 'invested', Math.round(scen[59].invested), 'netWorth', Math.round(scen[59].netWorth));
