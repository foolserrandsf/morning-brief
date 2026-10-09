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

// Runs every 5 minutes: delivers notifications the morning writer left in "outbox"
// ([date, endpoint, body_b64, authorization, result]).
function sendOutbox() {
  var ss = SpreadsheetApp.getActive();
  var ob = ss.getSheetByName('outbox');
  if (!ob || !ob.getLastRow()) return;
  var rows = ob.getRange(1, 1, ob.getLastRow(), 5).getValues();
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (!r[1] || r[4]) continue;
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
