// Morning Brief sync + notifications — lives in the "Morning Brief Sync" Google Sheet
// (Extensions → Apps Script). The app only ever sends ciphertext for quiz progress.
var TOKEN = '__SYNC_TOKEN__';
var CHUNK = 45000; // a Sheets cell holds 50,000 characters

function doGet(e) { return out_(handle_(e.parameter || {})); }
function doPost(e) {
  var p = {};
  try { p = JSON.parse(e.postData.contents); } catch (err) {}
  return out_(handle_(p));
}

function handle_(p) {
  if (p.token !== TOKEN) return { ok: false, error: 'bad token' };
  if (p.sub) return saveSub_(p.sub);
  if (p.remind) return remind_(p.remind);
  if (p.cancel) return cancel_(p.cancel, p.key);
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName('sync') || ss.insertSheet('sync');
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var meta = sh.getRange('D1:E1').getValues()[0];
    var rev = Number(meta[1]) || 0;
    if (p.blob) {
      if (p.base !== undefined && Number(p.base) !== rev) return { ok: false, conflict: true, rev: rev };
      var parts = [];
      for (var i = 0; i < p.blob.length; i += CHUNK) parts.push([p.blob.substr(i, CHUNK)]);
      sh.getRange('A:A').clearContent();
      sh.getRange(1, 1, parts.length, 1).setValues(parts);
      rev += 1;
      sh.getRange('D1:F1').setValues([['rev', rev, new Date()]]);
      return { ok: true, rev: rev };
    }
    var last = sh.getLastRow();
    var blob = last ? sh.getRange(1, 1, last, 1).getValues().map(function (r) { return r[0]; }).join('') : '';
    return { ok: true, rev: rev, blob: blob || null };
  } finally {
    lock.releaseLock();
  }
}

// A phone that turned on notifications: [endpoint, p256dh, auth, added]
function saveSub_(sub) {
  if (!sub || !sub.endpoint || !sub.keys) return { ok: false, error: 'bad subscription' };
  var sh = SpreadsheetApp.getActive().getSheetByName('push') || SpreadsheetApp.getActive().insertSheet('push');
  var rows = sh.getLastRow() ? sh.getRange(1, 1, sh.getLastRow(), 1).getValues() : [];
  for (var i = 0; i < rows.length; i++) if (rows[i][0] === sub.endpoint) return { ok: true, known: true };
  sh.appendRow([sub.endpoint, sub.keys.p256dh, sub.keys.auth, new Date()]);
  return { ok: true };
}

// "Remind me later": the morning writer leaves pre-encrypted reminders per phone, tagged
// hold:<date>:<key>:<n> (key = focus, in0, in1, …; older focus rows are hold:<date>:<n>).
// The app picks a time; this releases the next held one for that time (column F = send after,
// column G = key).
function holdKey_(tag, date) {
  var m = String(tag).match(/^hold:(\d{4}-\d{2}-\d{2}):(?:([a-z]+\d*):)?\d+$/);
  return m && m[1] === date ? (m[2] || 'focus') : null;
}
function remind_(o) {
  var ob = SpreadsheetApp.getActive().getSheetByName('outbox'), key = o.key || 'focus';
  if (!ob || !ob.getLastRow() || !o.date || !o.at) return { ok: true, reminded: 0 };
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var rows = ob.getRange(1, 1, ob.getLastRow(), 7).getValues(), done = {}, n = 0;
    cancelPending_(ob, rows, o.date, key);
    for (var i = 0; i < rows.length; i++) {
      if (holdKey_(rows[i][4], o.date) !== key || done[rows[i][1]]) continue;
      ob.getRange(i + 1, 5, 1, 3).setValues([['', o.at, key]]);
      done[rows[i][1]] = 1; n++;
    }
    return { ok: true, reminded: n };
  } finally { lock.releaseLock(); }
}
function cancel_(date, key) {
  var ob = SpreadsheetApp.getActive().getSheetByName('outbox');
  if (!ob || !ob.getLastRow()) return { ok: true, cancelled: 0 };
  var rows = ob.getRange(1, 1, ob.getLastRow(), 7).getValues();
  return { ok: true, cancelled: cancelPending_(ob, rows, date, key || 'focus') };
}
// a released reminder that hasn't gone out yet is cancelled (Done, unchecked, or a new time picked)
function cancelPending_(ob, rows, date, key) {
  var n = 0, now = new Date(), tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
  for (var i = 0; i < rows.length; i++) {
    var d = rows[i][0] instanceof Date ? Utilities.formatDate(rows[i][0], tz, 'yyyy-MM-dd') : String(rows[i][0]).slice(0, 10);
    if (d !== String(date) || (rows[i][6] || 'focus') !== key) continue;
    if (!rows[i][4] && rows[i][5] && new Date(rows[i][5]) > now) { ob.getRange(i + 1, 5).setValue('cancelled'); rows[i][4] = 'cancelled'; n++; }
  }
  return n;
}

// Runs every 5 minutes: delivers notifications the morning writer left in "outbox"
// ([date, endpoint, body_b64, authorization, result, send_after]).
function sendOutbox() {
  var ss = SpreadsheetApp.getActive();
  var ob = ss.getSheetByName('outbox');
  if (!ob || !ob.getLastRow()) return;
  var rows = ob.getRange(1, 1, ob.getLastRow(), 6).getValues(), now = new Date();
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (!r[1] || r[4]) continue;
    if (r[5] && new Date(r[5]) > now) continue;
    var res = UrlFetchApp.fetch(r[1], {
      method: 'post', contentType: 'application/octet-stream', muteHttpExceptions: true,
      payload: Utilities.base64Decode(r[2]),
      headers: { 'Authorization': r[3], 'Content-Encoding': 'aes128gcm', 'TTL': '43200', 'Urgency': 'high' }
    });
    var code = res.getResponseCode();
    ob.getRange(i + 1, 5).setValue(code + ' ' + new Date().toISOString());
    if (code === 404 || code === 410) dropSub_(r[1]); // phone unsubscribed
  }
}

function dropSub_(endpoint) {
  var sh = SpreadsheetApp.getActive().getSheetByName('push');
  if (!sh || !sh.getLastRow()) return;
  var rows = sh.getRange(1, 1, sh.getLastRow(), 1).getValues();
  for (var i = rows.length - 1; i >= 0; i--) if (rows[i][0] === endpoint) sh.deleteRow(i + 1);
}

// ---------- Upserve: nightly product mix + regulars ----------
// Upserve emails the Daily Product Mix CSV and Daily Checks CSV every morning. Every 15 minutes this
// looks for new ones in Gmail, works out the night's numbers (tips by shift too) and keeps a regulars
// ledger by first name only, in this private sheet, then writes one JSON summary per night to the "upserve" tab
// for the Morning Brief writer to read.
function importUpserve() {
  var ss = SpreadsheetApp.getActive();
  var up = ss.getSheetByName('upserve') || ss.insertSheet('upserve');
  up.getRange('A:A').setNumberFormat('@');
  var done = {};
  var empty = {};
  if (up.getLastRow()) up.getRange(1, 1, up.getLastRow(), 2).getDisplayValues().forEach(function (r, i) {
    var o = {}; try { o = JSON.parse(r[1]); } catch (e) {}
    if (o.checks) done[r[0]] = 1; else empty[r[0]] = i + 1;
  });
  var files = {};
  GmailApp.search('from:support@upserve.com newer_than:6d has:attachment', 0, 40).forEach(function (t) {
    t.getMessages().forEach(function (m) {
      m.getAttachments().forEach(function (a) {
        var n = a.getName(), kind = /^pmix-report/.test(n) ? 'pmix' : /^checks-report/.test(n) ? 'checks' : /^payments-report/.test(n) ? 'pay' : null;
        var md = n.match(/--(\d{4}-\d{2}-\d{2})-to-(\d{4}-\d{2}-\d{2})/);
        if (!kind || !md || md[1] !== md[2]) return;
        (files[md[1]] = files[md[1]] || {})[kind] = csvText_(a);
      });
    });
  });
  Object.keys(files).sort().forEach(function (d) {
    var f = files[d];
    if (done[d] || !f.pmix || !f.checks) return;
    // give the Payments report (card matching) until 6:10 a.m. the next morning, so the 6:30 brief always has the night
    if (!f.pay && Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), "yyyy-MM-dd'T'HH:mm") < addDays_(d, 1) + 'T06:10') return;
    var day = upserveDay_(ss, up, d, f.pmix, f.checks, f.pay);
    if (!day.checks) { Logger.log('No checks read for ' + d + ' - run debugUpserve'); return; }
    if (empty[d]) up.getRange(empty[d], 1, 1, 2).setValues([[d, JSON.stringify(day)]]);
    else up.appendRow([d, JSON.stringify(day)]);
    done[d] = 1;
  });
}
function addDays_(d, n) { var t = new Date(d + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }
function num_(x) { var v = parseFloat(String(x).replace(/[$,]/g, '')); return isNaN(v) ? 0 : v; }
function r2_(x) { return Math.round(x * 100) / 100; }
function parseCsv_(t) {
  t = String(t || '').replace(/^\uFEFF/, '').replace(/\u0000/g, '');
  var rows = [], row = [], f = '', q = false;
  for (var i = 0; i < t.length; i++) {
    var c = t.charAt(i);
    if (q) {
      if (c === '"') { if (t.charAt(i + 1) === '"') { f += '"'; i++; } else q = false; }
      else f += c;
    } else if (c === '"' && f === '') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t.charAt(i + 1) === '\n') i++;
      row.push(f); rows.push(row); row = []; f = '';
    } else f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows;
}
function table_(csv) {
  var rows = parseCsv_(csv), h = 0;
  while (h < rows.length && !(rows[h].length >= 5 && /^(Type|#|Status)$/.test(String(rows[h][0]).trim()))) h++;
  if (h >= rows.length) { h = 0; while (h < rows.length && rows[h].length < 5) h++; }
  var head = rows[h] || [], out = [];
  for (var i = h + 1; i < rows.length; i++) {
    if (rows[i].length < 5) continue;
    var o = {}; head.forEach(function (k, j) { o[String(k).trim()] = String(rows[i][j] == null ? '' : rows[i][j]).trim(); }); out.push(o);
  }
  return out;
}
function csvText_(a) {
  var s = a.getDataAsString('UTF-8');
  if (s.indexOf('\u0000') >= 0) s = a.getDataAsString('UTF-16');
  return s;
}
// Run this from the editor if the upserve tab shows zeros: it logs what the script sees.
function debugUpserve() {
  GmailApp.search('from:support@upserve.com newer_than:3d has:attachment', 0, 10).forEach(function (t) {
    t.getMessages().forEach(function (m) {
      m.getAttachments().forEach(function (a) {
        var s = csvText_(a), rows = table_(s);
        Logger.log(a.getName() + ' | ' + a.getContentType() + ' | ' + s.length + ' chars | ' + rows.length + ' rows | columns: ' + (rows[0] ? Object.keys(rows[0]).slice(0, 8).join(', ') : 'none'));
      });
    });
  });
}
function guestName_(raw, num) {
  // "LAST, FIRST" -> "First L."; a single name typed on a tab -> "First". Only a last INITIAL is kept, never the last name.
  raw = String(raw || '').trim();
  if (!raw || raw === String(num).trim() || !/[A-Za-z]/.test(raw)) return null;
  var last = '', first = raw;
  if (raw.indexOf(',') > 0) { last = raw.slice(0, raw.indexOf(',')); first = raw.slice(raw.indexOf(',') + 1); }
  var w = String(first || '').trim().split(/\s+/).filter(function (x) { return !/^(mr|mrs|ms|miss|dr|mx)\.?$/i.test(x); });
  first = w[0] || '';
  if (!/[A-Za-z]{2}/.test(first)) return null;
  var li = last.replace(/[^A-Za-z]/g, '').charAt(0).toUpperCase();
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() + (li ? ' ' + li + '.' : '');
}
// Shift schedule (same as the "Shift schedule" tab of Fool's Errand Sales): check time → shift.
function shiftOf_(d, when) {
  var m = String(when).match(/(\d{1,2}):(\d{2})\s*([ap]m)/i), wd = new Date(d + 'T12:00:00Z').getUTCDay();
  var h = m ? (+m[1] % 12) + (m[3].toLowerCase() === 'pm' ? 12 : 0) + (+m[2]) / 60 : 20;
  if (h < 6) h += 24;                                   // after midnight counts as the last shift
  if (wd === 0 || wd === 1) return 'All day';
  if (wd === 2) return h < 18 ? 'AM' : 'PM';
  if (wd === 3 || wd === 4) return h < 17 ? 'AM' : 'PM';
  if (wd === 5) return h < 17 ? 'AM' : h < 18 ? 'PM (one bartender)' : 'PM (both bartenders)';
  return h < 18 ? 'AM only' : h < 20.5 ? 'Overlap (both)' : 'PM only';
}
// ---- card matching (Upserve Payments report): only the card brand + last 4 digits are ever kept ----
function pad2_(x) { return ('0' + x).slice(-2); }
function payRows_(csv) {
  if (!csv) return [];
  return table_(csv).filter(function (r) {
    return /^(Captured|Paid)$/i.test(r['Status'] || '') && /^[A-Za-z]+ \d{4}$/.test(r['Tender Account'] || '');
  }).map(function (r) {
    var m = String(r['Trading Day']).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    return { date: m ? m[3] + '-' + pad2_(m[1]) + '-' + pad2_(m[2]) : '', no: String(r['Check No.']).trim(), card: String(r['Tender Account']).toUpperCase(), amount: num_(r['Payment']), tip: num_(r['Tip']) };
  });
}
function loadCards_(ss) {
  var cs = ss.getSheetByName('cards') || ss.insertSheet('cards'), C = {};
  if (cs.getLastRow()) cs.getRange(1, 1, cs.getLastRow(), 2).getValues().forEach(function (r) { if (r[0]) C[r[0]] = JSON.parse(r[1] || '{}'); });
  return { sheet: cs, C: C };
}
function saveCards_(k) {
  var keys = Object.keys(k.C).sort();
  k.sheet.clearContents();
  if (keys.length) k.sheet.getRange(1, 1, keys.length, 2).setValues(keys.map(function (c) { return [c, JSON.stringify(k.C[c])]; }));
}
function addCard_(C, card, name) { var o = C[card] = C[card] || {}; o[name] = (o[name] || 0) + 1; }
// The guest a card belongs to: the name on at least 80% of that card's named checks, else nobody (shared or colliding cards).
function cardOwner_(o) {
  if (!o) return null;
  var tot = 0, best = null;
  Object.keys(o).forEach(function (n) { tot += o[n]; if (!best || o[n] > o[best]) best = n; });
  return best && o[best] / tot >= 0.8 ? best : null;
}
// Names checks: the name typed on the check, or (if none) the owner of a card that paid it.
function nameChecks_(checks, pays, C) {
  var byNo = {};
  pays.forEach(function (p) { (byNo[p.date + '|' + p.no] = byNo[p.date + '|' + p.no] || []).push(p.card); });
  checks.forEach(function (c) {
    c.name = guestName_(c.raw, c.no);
    if (c.name) (byNo[c.date + '|' + c.no] || []).forEach(function (card) { addCard_(C, card, c.name); });
  });
  var matched = 0;
  checks.forEach(function (c) {
    if (c.name) return;
    var cards = byNo[c.date + '|' + c.no] || [];
    for (var i = 0; i < cards.length; i++) { var o = cardOwner_(C[cards[i]]); if (o) { c.name = o; c.byCard = true; matched++; break; } }
  });
  return matched;
}
// ---- card visit history (brand + last 4 only) and the patterns the brief reports ----
function loadCardVisits_(ss) {
  var sh = ss.getSheetByName('cardvisits') || ss.insertSheet('cardvisits'), V = {};
  if (sh.getLastRow()) sh.getRange(1, 1, sh.getLastRow(), 2).getValues().forEach(function (r) { if (r[0]) V[r[0]] = JSON.parse(r[1] || '[]'); });
  return { sheet: sh, V: V };
}
function saveCardVisits_(k) {
  var keys = Object.keys(k.V).filter(function (c) { return k.V[c].length; }).sort();
  k.sheet.clearContents();
  if (keys.length) k.sheet.getRange(1, 1, keys.length, 2).setValues(keys.map(function (c) { return [c, JSON.stringify(k.V[c])]; }));
}
// pays for whole nights: replaces any earlier entries for those dates, so re-running never double counts
function addCardVisits_(V, pays) {
  var dates = {}, agg = {};
  pays.forEach(function (p) {
    dates[p.date] = 1;
    var key = p.card + '|' + p.date, a = agg[key] = agg[key] || [p.date, 0, 0, 0];
    a[1] = r2_(a[1] + p.amount); a[2] = r2_(a[2] + (p.tip || 0)); a[3]++;
  });
  Object.keys(V).forEach(function (c) { V[c] = V[c].filter(function (x) { return !dates[x[0]]; }); });
  Object.keys(agg).forEach(function (key) { var c = key.split('|')[0]; (V[c] = V[c] || []).push(agg[key]); });
  Object.keys(V).forEach(function (c) { V[c].sort(function (a, b) { return a[0] < b[0] ? -1 : 1; }); });
}
function patterns_(V, d) {
  var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], cards = Object.keys(V);
  var first = cards.reduce(function (m, c) { return V[c].length && V[c][0][0] < m ? V[c][0][0] : m; }, d);
  function win(a, b) {
    var o = { from: a, to: b, payments: 0, cards: 0, spend: 0, tips: 0, by_weekday: {} };
    cards.forEach(function (c) {
      var hit = false;
      V[c].forEach(function (x) {
        if (x[0] < a || x[0] > b) return;
        hit = true; o.payments += x[3]; o.spend += x[1]; o.tips += x[2];
        var k = DOW[new Date(x[0] + 'T12:00:00Z').getUTCDay()]; o.by_weekday[k] = r2_((o.by_weekday[k] || 0) + x[1]);
      });
      if (hit) o.cards++;
    });
    o.spend = r2_(o.spend); o.tips = r2_(o.tips);
    o.per_payment = o.payments ? r2_(o.spend / o.payments) : 0;
    o.tip_pct = o.spend ? Math.round(o.tips / o.spend * 1000) / 10 : 0;
    return o;
  }
  function regulars(end) {
    var s = addDays_(end, -90), R = {};
    cards.forEach(function (c) { if (V[c].filter(function (x) { return x[0] > s && x[0] <= end; }).length >= 4) R[c] = 1; });
    return R;
  }
  function lapsed(end) {
    if (addDays_(end, -120) < first) return null;                       // not enough history
    var R = regulars(addDays_(end, -30)), gone = Object.keys(R).filter(function (c) {
      return !V[c].some(function (x) { return x[0] > addDays_(end, -20) && x[0] <= end; });
    });
    var a = addDays_(end, -55), b = addDays_(end, -28), sp = 0;
    gone.forEach(function (c) { V[c].forEach(function (x) { if (x[0] >= a && x[0] <= b) sp += x[1]; }); });
    return { regulars_30_days_ago: Object.keys(R).length, not_back_in_20_days: gone.length, their_spend_in_prior28: r2_(sp) };
  }
  var last = win(addDays_(d, -27), d), prior = win(addDays_(d, -55), addDays_(d, -28));
  function yearBack(n) {                                   // the same two 4-week windows n years earlier (52-week steps keep weekdays aligned)
    var e = addDays_(d, -364 * n);
    return addDays_(e, -55) >= first ? { last28: win(addDays_(e, -27), e), prior28: win(addDays_(e, -55), addDays_(e, -28)) } : null;
  }
  var ly = addDays_(d, -364) >= addDays_(first, 27) ? win(addDays_(d, -364 - 27), addDays_(d, -364)) : null;
  var Rn = regulars(d), regSpend = 0;
  cards.forEach(function (c) { if (Rn[c]) V[c].forEach(function (x) { if (x[0] >= last.from && x[0] <= d) regSpend += x[1]; }); });
  var months = {};
  cards.forEach(function (c) {
    var prev = null;
    V[c].forEach(function (x) {
      var m = x[0].slice(0, 7), isNew = !prev || prev < addDays_(x[0], -180);
      if (m + '-01' >= addDays_(first, 180)) { var o = months[m] = months[m] || { new_cards: 0, returning_cards: 0, _s: {} };
        if (!o._s[c]) { o._s[c] = 1; if (isNew) o.new_cards++; else o.returning_cards++; } }
      prev = x[0];
    });
  });
  Object.keys(months).forEach(function (m) { delete months[m]._s; });
  return {
    date: d, history_from: first, note: 'card payments only (cash not included); a card = one guest',
    last28: last, prior28: prior, last_year28: ly, same_weeks_1_year_ago: yearBack(1), same_weeks_2_years_ago: yearBack(2),
    regular_cards_now: Object.keys(Rn).length, regular_share_of_spend_last28_pct: last.spend ? Math.round(regSpend / last.spend * 100) : 0,
    lapsed_regulars: lapsed(d), lapsed_regulars_last_year: lapsed(addDays_(d, -364)),
    new_vs_returning_cards_by_month: months
  };
}
function savePatterns_(ss, p) {
  var sh = ss.getSheetByName('patterns') || ss.insertSheet('patterns');
  sh.clearContents(); sh.getRange(1, 1, 1, 2).setValues([[p.date, JSON.stringify(p)]]);
}
function upserveDay_(ss, up, d, pmixCsv, checksCsv, payCsv) {
  // product mix
  var items = [], cats = [];
  table_(pmixCsv).forEach(function (r) {
    if (r['Type'] === 'Item') items.push({ name: r['Name'], cat: r['Category Name'], sold: num_(r['Sold']), net: r2_(num_(r['Net'])) });
    if (r['Type'] === 'Category' && !/ Total$/.test(r['Name']) && r['Name'] !== 'Fees') cats.push({ name: r['Name'], sold: num_(r['Sold']), net: r2_(num_(r['Net'])) });
  });
  var catSum = cats.reduce(function (a, c) { return a + c.net; }, 0) || 1;
  cats.forEach(function (c) { c.pct = Math.round(c.net / catSum * 100); });
  cats.sort(function (a, b) { return b.net - a.net; });
  items.sort(function (a, b) { return b.net - a.net; });
  // checks
  var checks = table_(checksCsv).filter(function (r) { return r['#']; }), net = 0, tips = 0, n = 0, tonight = {}, shifts = {}, order = [];
  var K = loadCards_(ss), list = checks.map(function (r) { return { date: d, no: String(r['#']).trim(), raw: r['Name'] }; });
  var cardMatched = nameChecks_(list, payRows_(payCsv).map(function (p) { p.date = d; return p; }), K.C);
  if (payCsv) {
    saveCards_(K);
    var CV = loadCardVisits_(ss);
    addCardVisits_(CV.V, payRows_(payCsv).map(function (p) { p.date = d; return p; }));
    saveCardVisits_(CV);
    savePatterns_(ss, patterns_(CV.V, d));
  }
  checks.forEach(function (r, ci) {
    n++; net += num_(r['Net Sales']); tips += num_(r['Tips']);
    var sh = shiftOf_(d, r['Date']), x = shifts[sh];
    if (!x) { x = shifts[sh] = { shift: sh, tips: 0, checks: 0, sales: 0 }; order.push(sh); }
    x.tips += num_(r['Tips']); x.checks++; x.sales += num_(r['Net Sales']);
    var nm = list[ci].name;
    if (!nm) return;
    var k = nm.toUpperCase(), g = tonight[k] = tonight[k] || { name: nm, spend: 0, checks: 0, time: '' };
    g.spend += num_(r['Bill Total']); g.checks++; g.time = String(r['Date']).replace(/^\S+\s+/, '');
  });
  // regulars ledger: key | name | visits JSON [[date, spend], ...]
  var gs = ss.getSheetByName('guests') || ss.insertSheet('guests'), G = {};
  if (gs.getLastRow()) gs.getRange(1, 1, gs.getLastRow(), 3).getValues().forEach(function (r) { if (r[0]) G[r[0]] = { name: r[1], v: JSON.parse(r[2] || '[]') }; });
  Object.keys(G).forEach(function (k) { G[k].v = G[k].v.filter(function (x) { return x[0] !== d && x[0] >= addDays_(d, -1200); }); });
  Object.keys(tonight).forEach(function (k) { var g = G[k] = G[k] || { name: tonight[k].name, v: [] }; g.v.push([d, r2_(tonight[k].spend)]); g.v.sort(); });
  var keys = Object.keys(G).filter(function (k) { return G[k].v.length; });
  gs.clearContents();
  if (keys.length) gs.getRange(1, 1, keys.length, 3).setValues(keys.map(function (k) { return [k, G[k].name, JSON.stringify(G[k].v)]; }));
  var since = function (g, days) { var c = addDays_(d, -days); return g.v.filter(function (x) { return x[0] > c && x[0] <= d; }); };
  var sum = function (v) { return r2_(v.reduce(function (a, x) { return a + x[1]; }, 0)); };
  var regulars = [], newcomers = 0;
  Object.keys(tonight).forEach(function (k) {
    var g = G[k], all = g.v.filter(function (x) { return x[0] <= d; }), v90 = since(g, 90), prev = all.filter(function (x) { return x[0] < d; }).pop();
    if (all.length < 2) { newcomers++; return; }
    regulars.push({ name: g.name, tonight: r2_(tonight[k].spend), visits: all.length, visits_90d: v90.length, spend_90d: sum(v90),
      avg_ticket: r2_(sum(all) / all.length), last_before: prev ? prev[0] : '', milestone: [3, 5, 10, 25, 50, 100].indexOf(all.length) >= 0 ? all.length : null });
  });
  regulars.sort(function (a, b) { return b.visits_90d - a.visits_90d || b.spend_90d - a.spend_90d; });
  var lapsed = keys.map(function (k) { var g = G[k], v90 = since(g, 90), last = g.v[g.v.length - 1][0]; return { name: g.name, visits_90d: v90.length, last: last, spend_90d: sum(v90) }; })
    .filter(function (x) { return x.visits_90d >= 3 && x.last <= addDays_(d, -14) && x.last >= addDays_(d, -45); })
    .sort(function (a, b) { return b.visits_90d - a.visits_90d; }).slice(0, 6);
  var top30 = keys.map(function (k) { var v = since(G[k], 30); return { name: G[k].name, spend_30d: sum(v), visits_30d: v.length }; })
    .filter(function (x) { return x.visits_30d; }).sort(function (a, b) { return b.spend_30d - a.spend_30d; }).slice(0, 5);
  var lw = null, wk = addDays_(d, -7);
  if (up.getLastRow()) up.getRange(1, 1, up.getLastRow(), 2).getDisplayValues().forEach(function (r) { if (r[0] === wk) { try { lw = JSON.parse(r[1]).net; } catch (e) {} } });
  return {
    date: d, net: r2_(net), checks: n, named_checks: Object.keys(tonight).length, card_matched: cardMatched, cards_used: !!payCsv, tips: r2_(tips), avg_check: n ? r2_(net / n) : 0,
    tips_by_shift: ['AM', 'AM only', 'PM (one bartender)', 'PM (both bartenders)', 'Overlap (both)', 'PM', 'PM only', 'All day']
      .filter(function (k) { return shifts[k]; }).map(function (k) { var x = shifts[k]; return { shift: k, tips: r2_(x.tips), checks: x.checks, sales: r2_(x.sales), tip_pct: x.sales ? Math.round(x.tips / x.sales * 1000) / 10 : 0 }; }),
    last_week_net: lw, vs_last_week_pct: lw ? Math.round((net - lw) / lw * 1000) / 10 : null,
    top_items: items.slice(0, 12), categories: cats,
    regulars: regulars.slice(0, 15), newcomers: newcomers, lapsed: lapsed, top_spenders_30d: top30,
    ledger_since: keys.reduce(function (a, k) { return G[k].v[0][0] < a ? G[k].v[0][0] : a; }, d), guests_tracked: keys.length
  };
}

// Run once from the editor (select "setup" → Run) to start the 5-minute delivery check and the
// 15-minute Upserve import. It asks for Gmail (read) and Sheets permission the first time.
// One-time history load: put Upserve "Checks" and "Payments" report CSVs (any date range, e.g. one per month) in the Drive
// folder "Morning Brief - Upserve checks history", then run this. It rebuilds the guest history from those files.
function backfillGuests() {
  var name = 'Morning Brief - Upserve checks history', it = DriveApp.getFoldersByName(name);
  var folder = it.hasNext() ? it.next() : DriveApp.createFolder(name);
  var files = folder.getFiles(), G = {}, nFiles = 0, nChecks = 0, last = '', first = '9999', list = [], pays = [];
  while (files.hasNext()) {
    var f = files.next();
    if (!/\.csv$/i.test(f.getName())) continue;
    nFiles++;
    var text = f.getBlob().getDataAsString('UTF-8');
    if (/^\uFEFF?Payments Report/.test(text)) { pays = pays.concat(payRows_(text)); continue; }
    table_(text).forEach(function (r) {
      if (!r['#']) return;
      var m = String(r['Date']).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*([ap]m)/i);
      if (!m) return;
      nChecks++;
      var d = m[3] + '-' + ('0' + m[1]).slice(-2) + '-' + ('0' + m[2]).slice(-2);
      var h = (+m[4] % 12) + (m[6].toLowerCase() === 'pm' ? 12 : 0);
      if (h < 6) d = addDays_(d, -1);                       // after midnight belongs to the night before
      if (d > last) last = d;
      if (d < first) first = d;
      list.push({ date: d, no: String(r['#']).trim(), raw: r['Name'], spend: num_(r['Bill Total']) });
    });
  }
  var ssB = SpreadsheetApp.getActive(), K = { sheet: ssB.getSheetByName('cards') || ssB.insertSheet('cards'), C: {} };
  var matched = nameChecks_(list, pays, K.C);
  if (pays.length) {
    saveCards_(K);
    var CV = { sheet: ssB.getSheetByName('cardvisits') || ssB.insertSheet('cardvisits'), V: {} };
    addCardVisits_(CV.V, pays);
    saveCardVisits_(CV);
  }
  list.forEach(function (c) {
    if (!c.name) return;
    var k = c.name.toUpperCase(), g = G[k] = G[k] || { name: c.name, v: {} };
    g.v[c.date] = r2_((g.v[c.date] || 0) + c.spend);
  });
  // months with a Payments report but no Checks report: a payment by a known card still counts as that guest's visit
  var haveCheck = {}, orphanVisits = 0;
  list.forEach(function (c) { haveCheck[c.date + '|' + c.no] = 1; });
  pays.forEach(function (p) {
    if (haveCheck[p.date + '|' + p.no]) return;
    var o = cardOwner_(K.C[p.card]);
    if (!o) return;
    var k = o.toUpperCase(), g = G[k] = G[k] || { name: o, v: {} };
    if (g.v[p.date] == null) orphanVisits++;
    g.v[p.date] = r2_((g.v[p.date] || 0) + p.amount);
    if (p.date < first) first = p.date;
  });
  if (!nFiles) { Logger.log('Put the Checks CSVs in this Drive folder, then run backfillGuests again: ' + folder.getUrl()); return; }
  var ss = SpreadsheetApp.getActive(), gs = ss.getSheetByName('guests') || ss.insertSheet('guests');
  var keys = Object.keys(G).sort();
  gs.clearContents();
  if (keys.length) gs.getRange(1, 1, keys.length, 3).setValues(keys.map(function (k) {
    var v = Object.keys(G[k].v).sort().map(function (d) { return [d, G[k].v[d]]; });
    return [k, G[k].name, JSON.stringify(v)];
  }));
  if (pays.length) savePatterns_(ssB, patterns_(CV.V, last));
  Logger.log('Loaded ' + nChecks + ' checks and ' + pays.length + ' card payments from ' + nFiles + ' files: ' + keys.length + ' guests, ' + matched + ' unnamed checks matched by card, ' + orphanVisits + ' earlier visits found by card, from ' + first + ' through ' + last + '.');
}
function setup() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (['sendOutbox', 'importUpserve'].indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sendOutbox').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('importUpserve').timeBased().everyMinutes(5).create();
  importUpserve();
}

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
