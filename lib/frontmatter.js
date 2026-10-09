/* Tiny frontmatter parse/stringify, shared by the public site and the admin backend. */
var Frontmatter = (function () {
  'use strict';

  function parse(raw) {
    var m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw || '');
    if (!m) return { data: {}, body: raw || '' };
    var data = {};
    m[1].split(/\r?\n/).forEach(function (line) {
      var i = line.indexOf(':');
      if (i > 0) {
        var k = line.slice(0, i).trim();
        var v = line.slice(i + 1).trim();
        if (v === 'true') v = true;
        else if (v === 'false') v = false;
        else if (/^-?\d+$/.test(v)) v = parseInt(v, 10);
        else v = v.replace(/^["']|["']$/g, '');
        data[k] = v;
      }
    });
    return { data: data, body: m[2] };
  }

  function stringify(data, body) {
    var lines = ['---'];
    Object.keys(data).forEach(function (k) {
      var v = data[k];
      if (typeof v === 'string' && /[:#\n]/.test(v)) v = JSON.stringify(v);
      lines.push(k + ': ' + v);
    });
    lines.push('---', '');
    return lines.join('\n') + (body || '');
  }

  return { parse: parse, stringify: stringify };
})();
