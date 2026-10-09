/* Minimal HTML sanitizer for rendered markdown.
   This is a single-author CMS, so the main risk is pasted third-party snippets. */
var Sanitize = (function () {
  'use strict';

  function cleanUrl(url) {
    if (url == null) return '#';
    var u = String(url).trim();
    if (/^(https?:|mailto:|#)/i.test(u)) return u;
    if (/^[a-z0-9\-_./][a-z0-9\-_./?#=&%]*$/i.test(u) && u.indexOf(':') === -1) return u; // relative
    return '#';
  }

  function html(dirty) {
    var tpl = document.createElement('template');
    tpl.innerHTML = dirty;
    var els = tpl.content.querySelectorAll('*');
    Array.prototype.forEach.call(els, function (el) {
      if (/^(script|iframe|object|embed|form|style|link|meta|base)$/i.test(el.tagName)) {
        el.parentNode.removeChild(el);
        return;
      }
      Array.prototype.slice.call(el.attributes).forEach(function (attr) {
        var n = attr.name.toLowerCase();
        if (n.indexOf('on') === 0) {
          el.removeAttribute(attr.name);
        } else if (n === 'href' || n === 'src' || n === 'srcset' || n === 'style' ||
                   n === 'action' || n === 'formaction' || n === 'xlink:href') {
          if (n === 'href' || n === 'src') {
            el.setAttribute(attr.name, cleanUrl(attr.value));
          } else {
            el.removeAttribute(attr.name);
          }
        }
      });
      if (/^a$/i.test(el.tagName) && /^https?:/i.test(el.getAttribute('href') || '')) {
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener');
      }
    });
    return tpl.innerHTML;
  }

  return { html: html };
})();
