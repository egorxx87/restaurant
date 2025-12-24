/**
 * RESERVATIONS API (Manual + Quandoo_Import)
 * - Manual: SHEET_NAME (Аркуш1) — editable (add / updateRow)
 * - Quandoo: QUANDOO_SHEET_NAME (Quandoo_Import) — readonly
 *
 * Output: json { ok:true, data:[...combined...], meta:{manualCount,quandooCount,cancelledCount} }
 */
const SHEET_NAME = 'Аркуш1';
const QUANDOO_SHEET_NAME = 'Quandoo_Import';

const HEADER_ROW = 1;
const DATA_START_ROW = HEADER_ROW + 1;

const DATE_FMT = 'dd.MM.yyyy';
const TIME_FMT = 'HH:mm';

function doGet(e) {
  try {
    const action = e?.parameter?.action || 'todayWeek';

    if (action === 'ping') return json_({ ok: true, message: 'pong' });

    if (action === 'getAll') {
      return jsonCombined_({ manual: getAllManual_(), quandoo: getAllQuandoo_() });
    }

    if (action === 'getYesterday') {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const y = fmt_(d);
      return jsonCombined_({ manual: getByExactDateStrManual_(y), quandoo: getByExactDateStrQuandoo_(y) });
    }

    if (action === 'getByDate') {
      const dateStr = String(e?.parameter?.date || '').trim();
      if (!dateStr) return json_({ ok: false, error: 'Missing date (dd.MM.yyyy)' });
      return jsonCombined_({ manual: getByExactDateStrManual_(dateStr), quandoo: getByExactDateStrQuandoo_(dateStr) });
    }

    if (action === 'todayWeek') {
      const start = startOfDay_(new Date());
      const end = new Date(start);
      end.setDate(end.getDate() + 7);

      return jsonCombined_({
        manual: getByDateRangeManual_(start, end),
        quandoo: getByDateRangeQuandoo_(start, end)
      });
    }

    return json_({ ok: false, error: 'Unknown action' });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.stack ? err.stack : err) });
  }
}

function doPost(e) {
  try {
    const raw = (e && e.postData && e.postData.contents) ? e.postData.contents : "{}";
    const body = JSON.parse(raw);
    const action = body.action;

    if (action === 'add') {
      const obj = addReservation_(body.data || {});
      return json_({ ok: true, data: obj });
    }

    if (action === 'updateRow') {
      if (!body.row) return json_({ ok: false, error: 'Missing row' });
      const updated = updateRow_(Number(body.row), body.data || {});
      return json_({ ok: true, data: updated });
    }

    return json_({ ok: false, error: 'Unknown action' });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.stack ? err.stack : err) });
  }
}

/* ===== Manual read ===== */
function getAllManual_() {
  const sh = getManualSheet_();
  const lastRow = sh.getLastRow();
  if (lastRow < DATA_START_ROW) return [];

  const values = sh.getRange(DATA_START_ROW, 1, lastRow - DATA_START_ROW + 1, 11).getValues();
  return values
    .map((r, i) => rowToObjManual_(r, i + DATA_START_ROW))
    .filter(hasAnyMeaningfulDataManual_);
}

function getByExactDateStrManual_(dateStr) {
  return getAllManual_().filter(r => r.date === dateStr);
}

function getByDateRangeManual_(startDate, endDate) {
  const all = getAllManual_();
  return all.filter(r => {
    const d = parseDateToMidnight_(r.dateRaw);
    if (!d) return false;
    return d >= startDate && d <= endDate;
  });
}

/* ===== Quandoo read (readonly)
   Expected columns:
   A RES_ID | B DATE | C TIME | D GUESTS | E NAME | F PHONE | G EMAIL | H STATUS
*/
function getAllQuandoo_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(QUANDOO_SHEET_NAME);
  if (!sh) return [];

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];

  const values = sh.getRange(2, 1, lastRow - 1, 8).getValues();
  const out = [];

  for (let i = 0; i < values.length; i++) {
    const r = values[i];
    const resId = String(r[0] || '').trim();
    const dateStr = formatDateCell_(r[1]);
    const timeStr = formatTimeCell_(r[2]);
    const guests = r[3];

    const name = String(r[4] || '').trim();
    const phone = String(r[5] || '').trim();
    const email = String(r[6] || '').trim();
    const status = String(r[7] || '').trim();

    if (!(dateStr || timeStr || guests || name || phone || email || resId)) continue;

    const st = status.toLowerCase();
    const cancelled = (st === 'cancelled');

    out.push({
      row: null,
      readonly: true,
      source: 'quandoo',
      resId,
      confirmed: !cancelled,
      cancelled,
      status,
      date: dateStr,
      time: timeStr,
      guests,
      payment: '',
      price: '',
      menu: '',
      from: name || 'Quandoo',
      email,
      phone,
      menu2: '',
      dateRaw: r[1]
    });
  }

  return out;
}

function getByExactDateStrQuandoo_(dateStr) {
  return getAllQuandoo_().filter(r => r.date === dateStr);
}

function getByDateRangeQuandoo_(startDate, endDate) {
  const all = getAllQuandoo_();
  return all.filter(r => {
    const d = parseDateToMidnight_(r.dateRaw);
    if (!d) return false;
    return d >= startDate && d <= endDate;
  });
}

/* ===== Manual write ===== */
function addReservation_(data) {
  const sh = getManualSheet_();

  const rowArr = [
    !!data.confirmed,
    data.date || '',
    data.time || '',
    data.guests || '',
    data.payment || '',
    data.price || '',
    data.menu || '',
    data.from || '',
    data.email || '',
    data.phone || '',
    data.menu2 || ''
  ];

  sh.appendRow(rowArr);
  const rowNumber = sh.getLastRow();

  return rowToObjManual_(rowArr, rowNumber);
}

function updateRow_(rowNumber, patch) {
  const sh = getManualSheet_();
  if (rowNumber < DATA_START_ROW || rowNumber > sh.getLastRow()) throw new Error('Row out of range');

  const range = sh.getRange(rowNumber, 1, 1, 11);
  const row = range.getValues()[0];

  if ('confirmed' in patch) row[0] = !!patch.confirmed;
  if ('date' in patch) row[1] = patch.date ?? '';
  if ('time' in patch) row[2] = patch.time ?? '';
  if ('guests' in patch) row[3] = patch.guests ?? '';
  if ('payment' in patch) row[4] = patch.payment ?? '';
  if ('price' in patch) row[5] = patch.price ?? '';
  if ('menu' in patch) row[6] = patch.menu ?? '';
  if ('from' in patch) row[7] = patch.from ?? '';
  if ('email' in patch) row[8] = patch.email ?? '';
  if ('phone' in patch) row[9] = patch.phone ?? '';
  if ('menu2' in patch) row[10] = patch.menu2 ?? '';

  range.setValues([row]);
  return rowToObjManual_(row, rowNumber);
}

/* ===== Helpers ===== */
function getManualSheet_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  if (!sh) throw new Error('Sheet not found: ' + SHEET_NAME);
  return sh;
}

function rowToObjManual_(r, rowNumber) {
  return {
    row: rowNumber,
    readonly: false,
    source: 'manual',
    confirmed: !!r[0],
    cancelled: false,
    status: '',
    date: formatDateCell_(r[1]),
    time: formatTimeCell_(r[2]),
    guests: r[3],
    payment: r[4],
    price: r[5],
    menu: r[6],
    from: r[7],
    email: r[8],
    phone: r[9],
    menu2: r[10],
    dateRaw: r[1]
  };
}

function hasAnyMeaningfulDataManual_(item) {
  return Boolean(item.date || item.time || item.guests || item.payment || item.price || item.menu || item.from || item.email || item.phone || item.menu2);
}

function formatDateCell_(v) {
  if (!v) return '';
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v)) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), DATE_FMT);
  }
  return String(v).trim();
}

function formatTimeCell_(v) {
  if (!v) return '';
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v)) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), TIME_FMT);
  }
  return String(v).trim();
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonCombined_({ manual, quandoo }) {
  const m = Array.isArray(manual) ? manual : [];
  const q = Array.isArray(quandoo) ? quandoo : [];

  const cancelledCount = q.filter(x => x && x.cancelled).length;
  const combined = sortReservations_([].concat(m, q));

  return json_({
    ok: true,
    data: combined,
    meta: {
      manualCount: m.length,
      quandooCount: q.length - cancelledCount, // active only
      cancelledCount
    }
  });
}

function fmt_(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone(), DATE_FMT);
}

function startOfDay_(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
}

function parseDateToMidnight_(raw) {
  if (!raw) return null;

  if (Object.prototype.toString.call(raw) === '[object Date]' && !isNaN(raw)) {
    return startOfDay_(raw);
  }

  const s = String(raw).trim();
  const m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;

  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 0, 0, 0);
}

function sortReservations_(arr) {
  return [...arr].sort((a, b) => {
    const da = parseDateToMidnight_(a?.dateRaw);
    const db = parseDateToMidnight_(b?.dateRaw);
    if (da && db) {
      const diff = da - db;
      if (diff !== 0) return diff;
    } else if (da && !db) return -1;
    else if (!da && db) return 1;

    return timeToMinutes_(a?.time) - timeToMinutes_(b?.time);
  });
}

function timeToMinutes_(t) {
  if (!t) return 999999;
  const s = String(t).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return 999999;
  return Number(m[1]) * 60 + Number(m[2]);
}
