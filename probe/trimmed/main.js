import { dotnet } from './_framework/dotnet.js';

// ?cold: forget what the runtime cached for this origin and give every file a URL the browser
// has not seen, so that a repeat visit downloads and compiles everything again.
const cold = new URLSearchParams(location.search).has('cold');
const status = document.getElementById('status');

const mb = bytes => (bytes / 1e6).toFixed(2) + ' MB';
const row = (label, value) => {
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    const td = document.createElement('td');
    th.textContent = label;
    td.textContent = value;
    tr.append(th, td);
    return tr;
};

try {
    if (cold && globalThis.caches)
        for (const key of await caches.keys())
            if (key.startsWith('dotnet-resources')) await caches.delete(key);
    const stamp = Date.now().toString(36);
    const t0 = performance.now();
    const builder = cold
        ? dotnet.withResourceLoader((type, name, uri) => uri + (uri.includes('?') ? '&' : '?') + 'cold=' + stamp)
        : dotnet;
    const runtime = await builder.create();
    const exports = await runtime.getAssemblyExports(runtime.getConfig().mainAssemblyName);
    const t1 = performance.now();
    const firstInput = 'sin(x)^2 + cos(x)^2';
    const first = exports.Probe.Run(firstInput);
    const t2 = performance.now();
    const secondInput = '(x^2 - 1) / (x - 1)';
    const second = exports.Probe.Run(secondInput);
    const t3 = performance.now();

    const files = performance.getEntriesByType('resource').filter(r => r.name.includes('/_framework/'));
    const sum = key => files.reduce((total, r) => total + (r[key] || 0), 0);
    const cached = files.filter(r => r.transferSize === 0 && r.decodedBodySize > 0).length;
    const c = navigator.connection;
    const result = {
        variant: VARIANT,
        cold,
        files: files.length,
        fromCache: cached,
        transferredBytes: sum('transferSize'),
        decodedBytes: sum('decodedBodySize'),
        scriptStartMs: Math.round(t0),
        runtimeReadyMs: Math.round(t1 - t0),
        firstCallMs: Math.round(t2 - t1),
        secondCallMs: Math.round(t3 - t2),
        firstAnswerSinceNavigationMs: Math.round(t2),
        first: `${firstInput} -> ${first}`,
        second: `${secondInput} -> ${second}`,
        connection: c ? { effectiveType: c.effectiveType, downlinkMbps: c.downlink, rttMs: c.rtt } : null,
        userAgent: navigator.userAgent,
    };

    const table = document.getElementById('result');
    const call = VARIANT === 'base' ? 'returns its argument' : 'Simplify';
    table.append(
        row('Runtime files', `${files.length}` + (cached ? `, ${cached} from the browser's cache` : ', all downloaded')),
        row('Transferred', `${mb(result.transferredBytes)} (${mb(result.decodedBytes)} decoded)`),
        row('Page start to script', `${result.scriptStartMs} ms`),
        row('Runtime ready', `${result.runtimeReadyMs} ms`),
        row(`First call (${call})`, `${result.firstCallMs} ms: ${result.first}`),
        row('Second call', `${result.secondCallMs} ms: ${result.second}`),
        row('First answer, from navigation', `${result.firstAnswerSinceNavigationMs} ms`),
    );
    if (c) table.append(row('Connection, as the browser estimates it', `${c.effectiveType}, ${c.downlink} Mbit/s, ${c.rtt} ms round trip`));
    table.hidden = false;
    status.textContent = cold ? 'Cold run: every file downloaded again.' : (cached ? 'Repeat visit: some files came from the cache. Run it cold to measure a first visit.' : 'First visit.');
    const raw = document.getElementById('raw');
    raw.querySelector('pre').textContent = JSON.stringify(result, null, 2);
    raw.hidden = false;
} catch (e) {
    status.textContent = 'Failed: ' + e;
}
document.getElementById('again').hidden = false;
