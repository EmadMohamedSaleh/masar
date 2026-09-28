
import { handleBenchmark } from '../functions/handler.mjs';

const rows = [
  { shares: { housing: 30, food: 25, dining: 10 } },
  { shares: { housing: 40, food: 20, dining: 14 } },
  { shares: { housing: 999, food: 20 } }, // invalid -> skipped
];
let upserts = [];
function fakeSupabase() {
  return {
    from() {
      const builder = {
        select: () => builder,
        eq: () => builder,
        order: () => builder,
        limit: async () => ({ data: rows, error: null }),
        upsert: async (row) => { upserts.push(row); return { error: null }; },
      };
      return builder;
    },
  };
}
const supabase = fakeSupabase();

// GET benchmark
let res = await handleBenchmark({ request: new Request('http://x/functions/v1/app?action=benchmark&band=10k-20k'), supabase });
console.log('benchmark:', res.status, JSON.stringify(await res.json()));

// invalid band
res = await handleBenchmark({ request: new Request('http://x/functions/v1/app?action=benchmark&band=zzz'), supabase });
console.log('bad band:', res.status);

// POST contribute valid
res = await handleBenchmark({ request: new Request('http://x/functions/v1/app?action=contribute', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ peerId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', band: '20k-40k', shares: { housing: 45.55, dining: 12 } }) }), supabase });
console.log('contribute:', res.status, JSON.stringify(await res.json()), 'stored:', JSON.stringify(upserts[0]));

// POST contribute invalid shares
res = await handleBenchmark({ request: new Request('http://x/functions/v1/app?action=contribute', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ peerId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', band: '20k-40k', shares: { housing: 500 } }) }), supabase });
console.log('bad shares:', res.status);

// POST contribute bad peer id
res = await handleBenchmark({ request: new Request('http://x/functions/v1/app?action=contribute', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ peerId: 'not-a-uuid', band: '20k-40k', shares: { housing: 30 } }) }), supabase });
console.log('bad peerId:', res.status);

// wrong method
res = await handleBenchmark({ request: new Request('http://x/functions/v1/app?action=benchmark&band=10k-20k', { method: 'POST' }), supabase });
console.log('wrong method:', res.status);

// unknown action
res = await handleBenchmark({ request: new Request('http://x/functions/v1/app?action=drop'), supabase });
console.log('unknown action:', res.status);

// GET on contribute action
res = await handleBenchmark({ request: new Request('http://x/functions/v1/app?action=contribute'), supabase });
console.log('GET contribute (no mutation):', res.status);
