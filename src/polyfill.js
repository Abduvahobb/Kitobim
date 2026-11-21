// Eski Android WebView'lar (Chrome 71–92) uchun yetishmaydigan funksiyalar.
// pdf.js 3.11 ularni ishlatadi; ularsiz eski telefonlarda kitob umuman ochilmaydi ("S.at is not a function").
// Bu fayl ham ilovaga, ham pdf.js ishchi fayliga (tools/worker.mjs) qo'shiladi.
(function () {
  var def = function (o, k, v) {
    if (o && typeof o[k] !== 'function') Object.defineProperty(o, k, { value: v, writable: true, configurable: true });
  };
  var at = function (n) {
    var len = this.length; n = Math.trunc(n) || 0; if (n < 0) n += len;
    return n < 0 || n >= len ? undefined : this[n];
  };
  var findLast = function (f, t) { for (var i = this.length - 1; i >= 0; i--) if (f.call(t, this[i], i, this)) return this[i]; return undefined; };
  var findLastIndex = function (f, t) { for (var i = this.length - 1; i >= 0; i--) if (f.call(t, this[i], i, this)) return i; return -1; };
  var TA = Object.getPrototypeOf(Int8Array.prototype);
  [Array.prototype, TA].forEach(function (p) {
    def(p, 'at', at); def(p, 'findLast', findLast); def(p, 'findLastIndex', findLastIndex);
    def(p, 'toSorted', function (c) { return Array.prototype.slice.call(this).sort(c); });
  });
  def(String.prototype, 'at', function (n) { var v = at.call(String(this), n); return v; });
  def(String.prototype, 'replaceAll', function (s, r) {
    var str = String(this);
    if (s instanceof RegExp) {
      if (!s.global) throw new TypeError('replaceAll must be called with a global RegExp');
      return str.replace(s, r);
    }
    s = String(s);
    if (s === '') return str.split('').join(typeof r === 'function' ? '' : String(r));
    var out = '', i = 0, j;
    while ((j = str.indexOf(s, i)) !== -1) {
      out += str.slice(i, j) + (typeof r === 'function' ? r(s, j, str) : String(r).replace(/\$\$/g, '$').replace(/\$&/g, s));
      i = j + s.length;
    }
    return out + str.slice(i);
  });
  def(Object, 'hasOwn', function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); });
  var g = typeof globalThis !== 'undefined' ? globalThis : self;
  if (typeof g.structuredClone !== 'function') {
    g.structuredClone = function clone(v, seen) {
      seen = seen || new Map();
      if (v === null || typeof v !== 'object') return v;
      if (seen.has(v)) return seen.get(v);
      var r;
      if (v instanceof Date) r = new Date(v.getTime());
      else if (v instanceof RegExp) r = new RegExp(v.source, v.flags);
      else if (v instanceof ArrayBuffer) r = v.slice(0);
      else if (ArrayBuffer.isView(v)) r = new v.constructor(v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength));
      else if (v instanceof Map) { r = new Map(); seen.set(v, r); v.forEach(function (x, k) { r.set(clone(k, seen), clone(x, seen)); }); return r; }
      else if (v instanceof Set) { r = new Set(); seen.set(v, r); v.forEach(function (x) { r.add(clone(x, seen)); }); return r; }
      else if (Array.isArray(v)) { r = []; seen.set(v, r); for (var i = 0; i < v.length; i++) r[i] = clone(v[i], seen); return r; }
      else { r = {}; seen.set(v, r); Object.keys(v).forEach(function (k) { r[k] = clone(v[k], seen); }); return r; }
      seen.set(v, r); return r;
    };
  }
})();
