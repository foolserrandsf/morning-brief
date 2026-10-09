// Morning Brief sync — paste into the "Morning Brief Sync" Google Sheet:
// Extensions → Apps Script → replace everything → Deploy → New deployment →
// type "Web app", Execute as "Me", Who has access "Anyone" → Deploy.
// The app only ever sends ciphertext; this script never sees your quiz data in the clear.
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

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
