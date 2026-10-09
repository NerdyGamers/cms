/* Public site renderer: reads content/*.json + content/pages/*.md and renders pages. */
(function () {
  'use strict';

  var app = document.getElementById('app');
  var navEl = document.getElementById('nav');
  var brandEl = document.getElementById('brand');
  var footerTag = document.getElementById('footer-tag');

  var config = { siteTitle: 'My Site', tagline: '' };
  var pages = [];

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fetchJSON(path) {
    return fetch(path, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' loading ' + path);
      return r.json();
    });
  }

  function fetchText(path) {
    return fetch(path, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' loading ' + path);
      return r.text();
    });
  }

  function publishedPages() {
    return pages
      .filter(function (p) { return !p.draft; })
      .sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
  }

  function renderNav() {
    navEl.innerHTML = publishedPages().map(function (p) {
      return '<a href="#/' + encodeURIComponent(p.slug) + '" data-slug="' +
        esc(p.slug) + '">' + esc(p.title) + '</a>';
    }).join('');
  }

  function setActiveNav(slug) {
    Array.prototype.forEach.call(navEl.querySelectorAll('a'), function (a) {
      a.classList.toggle('active', a.getAttribute('data-slug') === slug);
    });
  }

  function showError(msg) {
    app.innerHTML = '<article class="page"><h1>Not found</h1><p>' +
      esc(msg) + '</p><p><a href="#/">&larr; Home</a></p></article>';
  }

  function currentSlug() {
    var h = location.hash.replace(/^#\/?/, '').split('?')[0].split('/')[0];
    return decodeURIComponent(h || '');
  }

  function route() {
    var slug = currentSlug();
    var list = publishedPages();

    if (!slug) {
      var home = null;
      for (var i = 0; i < list.length; i++) {
        if (list[i].slug === 'home') { home = list[i]; break; }
      }
      home = home || list[0];
      if (!home) { showError('No pages published yet.'); return; }
      slug = home.slug;
    }

    var meta = null;
    for (var j = 0; j < list.length; j++) {
      if (list[j].slug === slug) { meta = list[j]; break; }
    }
    if (!meta) {
      document.title = 'Not found \u00b7 ' + config.siteTitle;
      showError('This page does not exist.');
      return;
    }

    setActiveNav(slug);
    app.innerHTML = '<p class="loading">Loading&hellip;</p>';

    fetchText('content/pages/' + slug + '.md').then(function (raw) {
      var parsed = Frontmatter.parse(raw);
      var html = marked.parse(parsed.body || '');
      app.innerHTML = '<article class="page">' + Sanitize.html(html) + '</article>';
      var title = parsed.data.title || meta.title;
      document.title = title + ' \u00b7 ' + config.siteTitle;
      window.scrollTo(0, 0);
    }).catch(function () {
      showError('Could not load this page.');
    });
  }

  function init() {
    Promise.all([fetchJSON('content/config.json'), fetchJSON('content/index.json')])
      .then(function (res) {
        config = res[0] || config;
        pages = (res[1] && res[1].pages) || [];
        brandEl.textContent = config.siteTitle || 'My Site';
        document.title = config.siteTitle || 'My Site';
        footerTag.textContent = config.tagline || '';
        renderNav();
        window.addEventListener('hashchange', route);
        route();
      })
      .catch(function (err) {
        app.innerHTML = '<article class="page"><h1>Site not configured</h1>' +
          '<p>Could not load site content (' + esc(err.message) + ').</p></article>';
      });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
