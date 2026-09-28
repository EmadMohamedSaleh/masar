import { CATEGORY_LABELS } from "./types.js";
const DAYS_IN_MONTH = 30;
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function monthLabel(d) {
    return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}
function startOfMonth(offset) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + offset, 1);
}
export function loanMonthlyPayment(principal, annualRatePct, months) {
    if (months <= 0)
        return 0;
    const i = annualRatePct / 100 / 12;
    if (i === 0)
        return principal / months;
    return (principal * i) / (1 - Math.pow(1 + i, -months));
}
function scenarioEffects(profile, scenario) {
    const base = {
        incomeFor: () => profile.monthlyIncome,
        extraOutFor: () => 0,
        oneOffFor: () => 0,
        investMonthly: 0,
        monthlyReturn: 0,
    };
    if (!scenario)
        return base;
    if (scenario.kind === "loan") {
        const payment = loanMonthlyPayment(scenario.amount, scenario.annualRatePct, scenario.months);
        const s = scenario;
        return {
            ...base,
            extraOutFor: (index) => index >= s.startInMonths && index < s.startInMonths + s.months ? payment : 0,
            oneOffFor: (index) => (index === s.startInMonths ? -s.downPayment : 0),
        };
    }
    if (scenario.kind === "income-stop") {
        const s = scenario;
        return {
            ...base,
            incomeFor: (index) => index >= s.startInMonths && index < s.startInMonths + s.stopMonths ? 0 : profile.monthlyIncome,
            extraOutFor: (index) => index >= s.startInMonths && index < s.startInMonths + s.stopMonths ? s.extraMonthlyCost : 0,
            oneOffFor: (index) => (index === s.startInMonths ? s.severance : 0),
        };
    }
    // invest
    return {
        ...base,
        investMonthly: scenario.monthlyAmount,
        monthlyReturn: scenario.annualReturnPct / 100 / 12,
    };
}
function incomingFor(profile, index) {
    let total = 0;
    for (const fund of profile.incoming) {
        if (fund.kind === "once") {
            if (index === fund.inMonths)
                total += fund.amount;
        }
        else if (index >= fund.inMonths && (index - fund.inMonths) % 12 === 0) {
            total += fund.amount;
        }
    }
    return total;
}
function dayEvents(profile, effects, index, day) {
    let flow = 0;
    if (day === profile.payday)
        flow += effects.incomeFor(index);
    for (const f of profile.fixed)
        if (f.dueDay === day)
            flow -= f.amount;
    if (day === 1) {
        flow += effects.oneOffFor(index);
        flow -= effects.extraOutFor(index);
        flow -= effects.investMonthly;
        flow += incomingFor(profile, index);
    }
    return flow;
}
export function simulate(profile, months, scenario = null) {
    const effects = scenarioEffects(profile, scenario);
    const variableDaily = profile.variable.reduce((s, v) => s + v.amount, 0) / DAYS_IN_MONTH;
    const points = [];
    let balance = profile.startingBalance;
    let invested = 0;
    for (let index = 0; index < months; index++) {
        const date = startOfMonth(index);
        const opening = balance;
        let min = balance;
        let income = 0;
        let expenses = 0;
        for (let day = 1; day <= DAYS_IN_MONTH; day++) {
            const flow = dayEvents(profile, effects, index, day);
            if (flow > 0)
                income += flow;
            else
                expenses += -flow;
            balance += flow;
            balance -= variableDaily;
            expenses += variableDaily;
            min = Math.min(min, balance);
        }
        invested += effects.investMonthly; // contribution was deducted from cash on day 1
        invested *= 1 + effects.monthlyReturn;
        points.push({
            index,
            label: monthLabel(date),
            year: date.getFullYear(),
            month: date.getMonth(),
            income,
            expenses,
            openingBalance: opening,
            closingBalance: balance,
            minBalance: min,
            invested,
            netWorth: balance + invested,
            danger: min < profile.safetyBuffer,
        });
    }
    return points;
}
export function dailyBalances(profile, days, scenario = null) {
    const effects = scenarioEffects(profile, scenario);
    const variableDaily = profile.variable.reduce((s, v) => s + v.amount, 0) / DAYS_IN_MONTH;
    const out = [];
    let balance = profile.startingBalance;
    const today = new Date();
    for (let d = 0; d < days; d++) {
        const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + d);
        const monthIndex = (date.getFullYear() - today.getFullYear()) * 12 + (date.getMonth() - today.getMonth());
        const dayOfMonth = date.getDate();
        balance += dayEvents(profile, effects, monthIndex, dayOfMonth);
        balance -= variableDaily;
        out.push({ date, balance });
    }
    return out;
}
export function buildInsights(profile, horizonMonths = 60) {
    const totalFixed = profile.fixed.reduce((s, f) => s + f.amount, 0);
    const totalVariable = profile.variable.reduce((s, v) => s + v.amount, 0);
    const totalOut = totalFixed + totalVariable;
    const netMonthly = profile.monthlyIncome - totalOut;
    const income = Math.max(profile.monthlyIncome, 1);
    const byCategory = new Map();
    for (const f of profile.fixed)
        byCategory.set(f.category, (byCategory.get(f.category) ?? 0) + f.amount);
    for (const v of profile.variable)
        byCategory.set(v.category, (byCategory.get(v.category) ?? 0) + v.amount);
    const shares = [...byCategory.entries()]
        .map(([category, amount]) => ({ category, amount, pctOfIncome: (amount / income) * 100 }))
        .sort((a, b) => b.amount - a.amount);
    const points = simulate(profile, horizonMonths);
    const firstDanger = points.find((p) => p.danger) ?? null;
    // typical month runout: simulate a single representative month from average opening balance
    const daily = typicalMonthDaily(profile);
    let runoutDay = null;
    for (let i = 0; i < daily.length; i++) {
        if (daily[i] < profile.safetyBuffer) {
            runoutDay = i + 1;
            break;
        }
    }
    // weekly buckets of the typical month
    const weeklyMin = [0, 1, 2, 3].map((w) => Math.min(...daily.slice(w * 7, w * 7 + 7)));
    let tightWeek = null;
    if (netMonthly < 0 || runoutDay !== null) {
        tightWeek = weeklyMin.indexOf(Math.min(...weeklyMin)) + 1;
    }
    return {
        totalFixed,
        totalVariable,
        totalOut,
        netMonthly,
        savingsRatePct: (netMonthly / income) * 100,
        shares,
        topShare: shares[0] ?? null,
        runoutDay,
        runwayMonths: firstDanger ? firstDanger.index : null,
        firstDanger,
        tightWeek,
        weeklyMin,
    };
}
function typicalMonthDaily(profile) {
    const variableDaily = profile.variable.reduce((s, v) => s + v.amount, 0) / DAYS_IN_MONTH;
    // representative opening balance: current balance adjusted to start of a fresh month
    let balance = profile.startingBalance;
    const out = [];
    for (let day = 1; day <= 28; day++) {
        if (day === profile.payday)
            balance += profile.monthlyIncome;
        for (const f of profile.fixed)
            if (f.dueDay === day)
                balance -= f.amount;
        balance -= variableDaily;
        out.push(balance);
    }
    return out;
}
export function findWarning(profile, withinDays = 90) {
    const daily = dailyBalances(profile, withinDays);
    for (let i = 0; i < daily.length; i++) {
        if (daily[i].balance < profile.safetyBuffer) {
            // find the bill that day or the nearest upcoming fixed expense causing it
            const date = daily[i].date;
            const upcoming = profile.fixed
                .filter((f) => f.dueDay >= date.getDate() || f.amount > 0)
                .sort((a, b) => b.amount - a.amount)[0];
            const shortfall = profile.safetyBuffer - daily[i].balance;
            const cause = upcoming
                ? `Upcoming ${upcoming.name} (${formatEGP(upcoming.amount)}) plus your daily spending outpace your income.`
                : `Your daily spending outpaces your income before the next payday.`;
            return { daysAhead: i + 1, date, shortfall, cause };
        }
    }
    return null;
}
export function buildPlan(profile, warning) {
    const suggestions = [];
    const insights = buildInsights(profile);
    // 1. cut variable spending
    const variableTotal = insights.totalVariable;
    if (variableTotal > 0) {
        const cutPct = Math.min(100, Math.ceil((warning.shortfall / Math.max(variableTotal, 1)) * 100));
        suggestions.push({
            title: `Trim variable spending by ${cutPct}% this month`,
            detail: `Focus on ${CATEGORY_LABELS[insights.shares.find((s) => ["food", "dining", "transport", "other"].includes(s.category))?.category ?? "other"]} — it is your largest flexible category.`,
            impact: Math.round((variableTotal * cutPct) / 100),
        });
    }
    // 2. postpone a fixed expense
    const postponable = [...profile.fixed]
        .filter((f) => f.category !== "housing")
        .sort((a, b) => b.amount - a.amount)[0];
    if (postponable) {
        suggestions.push({
            title: `Postpone ${postponable.name}`,
            detail: `If it can wait until after the crunch, moving this bill clears the largest part of the gap.`,
            impact: Math.round(postponable.amount),
        });
    }
    // 3. incoming funds
    const soon = profile.incoming
        .filter((f) => f.kind === "once" && f.inMonths <= Math.ceil(warning.daysAhead / 30))
        .sort((a, b) => a.inMonths - b.inMonths)[0];
    if (soon) {
        suggestions.push({
            title: `Pull ${soon.name} forward`,
            detail: `You have ${formatEGP(soon.amount)} expected soon. Receiving it before day ${warning.daysAhead} covers the gap.`,
            impact: Math.round(soon.amount),
        });
    }
    // 4. buffer suggestion
    if (insights.netMonthly > 0 && warning.shortfall > 0) {
        const monthsToCover = warning.shortfall / insights.netMonthly;
        suggestions.push({
            title: `Ride it out with your surplus`,
            detail: `Your monthly surplus of ${formatEGP(insights.netMonthly)} covers the ${formatEGP(warning.shortfall)} gap in about ${monthsToCover.toFixed(1)} months if nothing else changes.`,
            impact: Math.round(insights.netMonthly),
        });
    }
    return suggestions.sort((a, b) => b.impact - a.impact).slice(0, 4);
}
export function incomeBand(monthlyIncome) {
    if (monthlyIncome < 10000)
        return "under-10k";
    if (monthlyIncome < 20000)
        return "10k-20k";
    if (monthlyIncome < 40000)
        return "20k-40k";
    if (monthlyIncome < 80000)
        return "40k-80k";
    return "80k-plus";
}
export const INCOME_BANDS = ["under-10k", "10k-20k", "20k-40k", "40k-80k", "80k-plus"];
export function categorySharesForComparison(insights) {
    const out = {};
    for (const s of insights.shares)
        out[s.category] = Math.round(s.pctOfIncome * 10) / 10;
    return out;
}
let _fmt = null;
export function formatEGP(value, compact = false) {
    const v = Math.round(value);
    if (compact && Math.abs(v) >= 10000) {
        return `${(v / 1000).toFixed(Math.abs(v) >= 100000 ? 0 : 1)}k EGP`;
    }
    if (!_fmt)
        _fmt = new Intl.NumberFormat("en-EG", { maximumFractionDigits: 0 });
    return `${_fmt.format(v)} EGP`;
}
export function formatNumber(value) {
    if (!_fmt)
        _fmt = new Intl.NumberFormat("en-EG", { maximumFractionDigits: 0 });
    return _fmt.format(Math.round(value));
}
export function ordinalDay(day) {
    const s = ["th", "st", "nd", "rd"];
    const v = day % 100;
    return day + (s[(v - 20) % 10] || s[v] || s[0]);
}
