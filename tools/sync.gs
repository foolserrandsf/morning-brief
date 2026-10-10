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

// Run once from the editor (select "setup" → Run) to start the 5-minute delivery check.
function setup() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sendOutbox') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sendOutbox').timeBased().everyMinutes(5).create();
}

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
