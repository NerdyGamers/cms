/* CMS Admin backend: edits pages/settings/media by committing to the GitHub repo.
   Auth: a fine-grained personal access token (Contents: read & write),
   stored only in this browser's localStorage. */
(function () {
  'use strict';

  var LS_KEY = 'simplecms.settings.v1';
  var settings = loadSettings();
  var manifest = { pages: [] };
  var originalSlug = null; // slug of the page being edited; null = new page
  var previewTimer = null;

  /* ---------------- helpers ---------------- */

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function b64encode(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  function b64decode(b64) {
    return decodeURIComponent(escape(atob(b64.replace(/\s/g, ''))));
  }

  function slugify(s) {
    return String(s || '').toLowerCase().trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function loadSettings() {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) || null; }
    catch (e) { return null; }
  }

  function storeSettings(s) {
    settings = s;
    localStorage.setItem(LS_KEY, JSON.stringify({
      owner: s.owner, repo: s.repo, branch: s.branch, token: s.token
    }));
  }

  function status(msg, kind) {
    var el = $('status');
    el.textContent = msg;
    el.className = 'status' + (kind === 'ok' ? ' ok' : kind === 'err' ? ' err' : '');
    el.classList.remove('hidden');
    clearTimeout(status._t);
    status._t = setTimeout(function () { el.classList.add('hidden'); }, 8000);
  }

  function authHeaders() {
    return {
      'Accept': 'application/vnd.github+json',
      'Authorization': 'Bearer ' + settings.token,
      'X-GitHub-Api-Version': '2022-11-28'
    };
  }

  function api(path, method, body) {
    var opts = { method: method || 'GET', headers: authHeaders() };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    return fetch('https://api.github.com' + path, opts).then(function (r) {
      return r.text().then(function (t) {
        var data = t ? JSON.parse(t) : null;
        if (!r.ok) throw new Error((data && data.message) || ('GitHub API error ' + r.status));
        return data;
      });
    });
  }

  function repoBase() {
    return '/repos/' + settings.owner + '/' + settings.repo;
  }

  /* Returns {sha, text} or null when the file does not exist. */
  function getFile(path) {
    return fetch('https://api.github.com' + repoBase() + '/contents/' + path +
      '?ref=' + encodeURIComponent(settings.branch), { headers: authHeaders() })
      .then(function (r) {
        if (r.status === 404) return null;
        return r.text().then(function (t) {
          var data = JSON.parse(t);
          if (!r.ok) throw new Error(data.message || ('HTTP ' + r.status));
          if (!data || data.type !== 'file') throw new Error('Not a file: ' + path);
          return { sha: data.sha, text: b64decode(data.content || '') };
        });
      });
  }

  function putFile(path, text, sha, message) {
    var body = { message: message, content: b64encode(text), branch: settings.branch };
    if (sha) body.sha = sha;
    return api(repoBase() + '/contents/' + path, 'PUT', body);
  }

  function deleteFile(path, sha, message) {
    return api(repoBase() + '/contents/' + path, 'DELETE',
      { message: message, sha: sha, branch: settings.branch });
  }

  function sortedPages() {
    return manifest.pages.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
  }

  /* ---------------- screens & tabs ---------------- */

  function showSetup() {
    $('setup-screen').classList.remove('hidden');
    $('app-screen').classList.add('hidden');
  }

  function showApp() {
    $('setup-screen').classList.add('hidden');
    $('app-screen').classList.remove('hidden');
    $('view-site').href = 'https://' + settings.owner.toLowerCase() + '.github.io/' + settings.repo + '/';
    $('conn-info').textContent = settings.owner + '/' + settings.repo + ' @ ' + settings.branch;
  }

  function switchTab(name) {
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
      t.classList.toggle('active', t.getAttribute('data-tab') === name);
    });
    ['pages', 'media', 'settings'].forEach(function (t) {
      $('tab-' + t).classList.toggle('hidden', t !== name);
    });
    if (name === 'media') loadMedia();
    if (name === 'settings') loadConfigForm();
  }

  /* ---------------- setup ---------------- */

  function connect() {
    var s = {
      owner: $('s-owner').value.trim(),
      repo: $('s-repo').value.trim(),
      branch: $('s-branch').value.trim() || 'main',
      token: $('s-token').value.trim()
    };
    var errEl = $('setup-error');
    errEl.classList.add('hidden');
    if (!s.owner || !s.repo || !s.token) {
      errEl.textContent = 'Owner, repo and token are all required.';
      errEl.classList.remove('hidden');
      return;
    }
    var btn = $('connect-btn');
    btn.disabled = true;
    btn.textContent = 'Connecting…';

    var headers = {
      'Accept': 'application/vnd.github+json',
      'Authorization': 'Bearer ' + s.token,
      'X-GitHub-Api-Version': '2022-11-28'
    };
    fetch('https://api.github.com/repos/' + s.owner + '/' + s.repo, { headers: headers })
      .then(function (r) {
        return r.text().then(function (t) {
          var data = t ? JSON.parse(t) : null;
          if (r.status === 401) throw new Error('Token rejected. Check it is copied correctly and not expired.');
          if (r.status === 404) throw new Error('Repo not found. Check owner/name, and that the token can see it.');
          if (!r.ok) throw new Error((data && data.message) || ('HTTP ' + r.status));
          return data;
        });
      })
      .then(function () {
        storeSettings(s);
        showApp();
        return boot();
      })
      .catch(function (e) {
        errEl.textContent = e.message;
        errEl.classList.remove('hidden');
        btn.disabled = false;
        btn.textContent = 'Connect';
      });
  }

  /* ---------------- pages ---------------- */

  function loadManifest() {
    return getFile('content/index.json').then(function (f) {
      manifest = { pages: [] };
      if (f) {
        try { manifest = JSON.parse(f.text); } catch (e) { manifest = { pages: [] }; }
        if (!Array.isArray(manifest.pages)) manifest.pages = [];
      }
      renderPages();
    });
  }

  function saveManifest() {
    return getFile('content/index.json').then(function (f) {
      var text = JSON.stringify(manifest, null, 2) + '\n';
      return putFile('content/index.json', text, f ? f.sha : null, 'Update page index');
    });
  }

  function renderPages() {
    var tb = $('pages-tbody');
    var list = sortedPages();
    if (!list.length) {
      tb.innerHTML = '<tr><td colspan="5" class="muted">No pages yet. Create one!</td></tr>';
      return;
    }
    tb.innerHTML = list.map(function (p, i) {
      return '<tr>' +
        '<td>' + esc(p.title) + '</td>' +
        '<td><code>' + esc(p.slug) + '</code></td>' +
        '<td>' + (p.draft
          ? '<span class="badge draft">Draft</span>'
          : '<span class="badge pub">Published</span>') + '</td>' +
        '<td>' +
          '<button data-move="-1" data-slug="' + esc(p.slug) + '"' + (i === 0 ? ' disabled' : '') + '>&uarr;</button>' +
          '<button data-move="1" data-slug="' + esc(p.slug) + '"' + (i === list.length - 1 ? ' disabled' : '') + '>&darr;</button>' +
        '</td>' +
        '<td class="row-actions"><button data-edit="' + esc(p.slug) + '">Edit</button></td>' +
        '</tr>';
    }).join('');

    Array.prototype.forEach.call(tb.querySelectorAll('[data-edit]'), function (b) {
      b.addEventListener('click', function () { openEditor(b.getAttribute('data-edit')); });
    });
    Array.prototype.forEach.call(tb.querySelectorAll('[data-move]'), function (b) {
      b.addEventListener('click', function () {
        movePage(b.getAttribute('data-slug'), parseInt(b.getAttribute('data-move'), 10));
      });
    });
  }

  function movePage(slug, dir) {
    var list = sortedPages();
    var i = -1;
    for (var k = 0; k < list.length; k++) { if (list[k].slug === slug) { i = k; break; } }
    var j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    var tmp = list[i]; list[i] = list[j]; list[j] = tmp;
    list.forEach(function (p, idx) { p.order = idx; });
    manifest.pages = list;
    status('Reordering…');
    saveManifest().then(function () { status('Order saved.', 'ok'); renderPages(); })
      .catch(function (e) { status('Error: ' + e.message, 'err'); });
  }

  function openEditor(slug) {
    originalSlug = slug || null;
    $('pages-list').classList.add('hidden');
    $('editor').classList.remove('hidden');
    $('editor-heading').textContent = slug ? 'Edit page' : 'New page';
    $('delete-page-btn').classList.toggle('hidden', !slug);
    if (!slug) {
      $('f-title').value = '';
      $('f-slug').value = '';
      $('f-draft').checked = false;
      $('f-body').value = '';
      updatePreview();
      $('f-title').focus();
      return;
    }
    status('Loading page…');
    getFile('content/pages/' + slug + '.md').then(function (f) {
      if (!f) throw new Error('Page file not found.');
      var parsed = Frontmatter.parse(f.text);
      $('f-title').value = parsed.data.title || '';
      $('f-slug').value = parsed.data.slug || slug;
      $('f-draft').checked = !!parsed.data.draft;
      $('f-body').value = parsed.body || '';
      updatePreview();
      status('Page loaded.', 'ok');
    }).catch(function (e) { status('Error: ' + e.message, 'err'); });
  }

  function closeEditor() {
    $('editor').classList.add('hidden');
    $('pages-list').classList.remove('hidden');
    originalSlug = null;
  }

  function currentEditorSlug() {
    return slugify($('f-slug').value.trim() || $('f-title').value);
  }

  function savePage() {
    var title = $('f-title').value.trim();
    var slug = currentEditorSlug();
    if (!title) { status('Title is required.', 'err'); return; }
    if (!slug) { status('Slug is required.', 'err'); return; }
    var draft = $('f-draft').checked;
    var body = $('f-body').value;
    var now = new Date().toISOString();
    var md = Frontmatter.stringify({ title: title, slug: slug, draft: draft, updated: now }, body);
    var isNew = !originalSlug;
    var renamed = originalSlug && originalSlug !== slug;

    var btn = $('save-page-btn');
    btn.disabled = true;
    status('Saving…');

    var existingEntry = null;
    manifest.pages.forEach(function (p) { if (p.slug === slug) existingEntry = p; });

    getFile('content/pages/' + slug + '.md').then(function (existing) {
      if (existing && isNew && !renamed) throw new Error('A page with slug "' + slug + '" already exists.');
      return putFile('content/pages/' + slug + '.md', md, existing ? existing.sha : null,
        (isNew ? 'Add page: ' : 'Update page: ') + title);
    }).then(function (res) {
      var list = manifest.pages.filter(function (p) { return p.slug !== slug && p.slug !== originalSlug; });
      var order = existingEntry ? (existingEntry.order || 0)
        : list.reduce(function (m, p) { return Math.max(m, p.order || 0); }, -1) + 1;
      list.push({ slug: slug, title: title, draft: draft, order: order, updated: now });
      list.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
      list.forEach(function (p, idx) { p.order = idx; });
      manifest.pages = list;
      return saveManifest().then(function () { return res; });
    }).then(function (res) {
      if (renamed) {
        return getFile('content/pages/' + originalSlug + '.md').then(function (f) {
          if (f) return deleteFile('content/pages/' + originalSlug + '.md', f.sha, 'Rename page ' + originalSlug + ' to ' + slug);
        });
      }
    }).then(function () {
      btn.disabled = false;
      status('Saved. The public site updates once GitHub Pages rebuilds (usually under a minute).', 'ok');
      closeEditor();
      return loadManifest();
    }).catch(function (e) {
      btn.disabled = false;
      status('Error: ' + e.message, 'err');
    });
  }

  function deleteCurrentPage() {
    if (!originalSlug) return;
    if (!window.confirm('Delete page "' + originalSlug + '"? This cannot be undone (except via git history).')) return;
    status('Deleting…');
    getFile('content/pages/' + originalSlug + '.md').then(function (f) {
      if (!f) throw new Error('Page file not found.');
      return deleteFile('content/pages/' + originalSlug + '.md', f.sha, 'Delete page: ' + originalSlug);
    }).then(function () {
      manifest.pages = manifest.pages.filter(function (p) { return p.slug !== originalSlug; });
      manifest.pages.forEach(function (p, idx) { p.order = idx; });
      return saveManifest();
    }).then(function () {
      status('Page deleted.', 'ok');
      closeEditor();
      return loadManifest();
    }).catch(function (e) { status('Error: ' + e.message, 'err'); });
  }

  function updatePreview() {
    var raw = $('f-body').value || '';
    var html = marked.parse(raw);
    html = html.replace(/(src|href)="assets\//g, '$1="../assets/');
    $('f-preview').innerHTML = Sanitize.html(html);
  }

  /* ---------------- media ---------------- */

  function loadMedia() {
    var grid = $('media-grid');
    grid.innerHTML = '<p class="muted">Loading&hellip;</p>';
    api(repoBase() + '/contents/assets?ref=' + encodeURIComponent(settings.branch))
      .then(function (data) {
        var files = Array.isArray(data) ? data.filter(function (f) { return f.type === 'file'; }) : [];
        if (!files.length) { grid.innerHTML = '<p class="muted">No uploads yet.</p>'; return; }
        grid.innerHTML = '';
        files.forEach(function (f) {
          var div = document.createElement('div');
          div.className = 'media-item';
          var rawUrl = 'https://raw.githubusercontent.com/' + settings.owner + '/' +
            settings.repo + '/' + encodeURIComponent(settings.branch) + '/assets/' + encodeURIComponent(f.name);
          div.innerHTML = '<img loading="lazy" alt="">' +
            '<div class="meta"><span class="name"></span><button>Copy Markdown</button></div>';
          div.querySelector('img').src = rawUrl;
          div.querySelector('img').alt = f.name;
          div.querySelector('.name').textContent = f.name;
          div.querySelector('button').addEventListener('click', function () {
            var md = '![' + f.name + '](assets/' + f.name + ')';
            if (navigator.clipboard) navigator.clipboard.writeText(md);
            status('Markdown copied: ' + md, 'ok');
          });
          grid.appendChild(div);
        });
      })
      .catch(function (e) {
        if (/404/.test(e.message)) grid.innerHTML = '<p class="muted">No uploads yet.</p>';
        else grid.innerHTML = '<p class="error">Error: ' + esc(e.message) + '</p>';
      });
  }

  function uploadMedia(files) {
    var imgs = Array.prototype.filter.call(files, function (f) { return /^image\//.test(f.type); });
    if (!imgs.length) { status('No image files selected.', 'err'); return; }
    status('Uploading ' + imgs.length + ' file(s)…');
    var chain = Promise.resolve();
    imgs.forEach(function (file) {
      chain = chain.then(function () {
        if (file.size > 2 * 1024 * 1024) throw new Error(file.name + ' is over 2MB; keep uploads small.');
        return new Promise(function (resolve, reject) {
          var reader = new FileReader();
          reader.onload = function () {
            var b64 = String(reader.result).split(',')[1];
            var name = Date.now() + '-' + file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
            getFile('assets/' + name).then(function (existing) {
              return putFile('assets/' + name, b64, existing ? existing.sha : null, 'Upload image: ' + name);
            }).then(resolve, reject);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      });
    });
    chain.then(function () { status('Upload complete.', 'ok'); loadMedia(); })
      .catch(function (e) { status('Error: ' + e.message, 'err'); });
  }

  /* ---------------- site settings ---------------- */

  function loadConfigForm() {
    getFile('content/config.json').then(function (f) {
      if (!f) return;
      try {
        var cfg = JSON.parse(f.text);
        $('c-title').value = cfg.siteTitle || '';
        $('c-tagline').value = cfg.tagline || '';
      } catch (e) { /* ignore */ }
    }).catch(function () { /* ignore */ });
  }

  function saveConfig() {
    var cfg = { siteTitle: $('c-title').value.trim() || 'My Site', tagline: $('c-tagline').value.trim() || '' };
    status('Saving settings…');
    getFile('content/config.json').then(function (f) {
      return putFile('content/config.json', JSON.stringify(cfg, null, 2) + '\n',
        f ? f.sha : null, 'Update site settings');
    }).then(function () { status('Settings saved.', 'ok'); })
      .catch(function (e) { status('Error: ' + e.message, 'err'); });
  }

  /* ---------------- boot ---------------- */

  function boot() {
    return loadManifest().then(loadConfigForm).catch(function (e) {
      if (/401/.test(e.message)) {
        status('Token was rejected (401). Please reconnect.', 'err');
        showSetup();
      } else {
        status('Error: ' + e.message, 'err');
      }
    });
  }

  function init() {
    $('connect-btn').addEventListener('click', connect);
    if (!settings || !settings.token) { showSetup(); return; }
    // prefill setup form in case he needs to reconnect
    $('s-owner').value = settings.owner || 'NerdyGamers';
    $('s-repo').value = settings.repo || 'cms';
    $('s-branch').value = settings.branch || 'main';
    showApp();
    boot();

    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
      t.addEventListener('click', function () { switchTab(t.getAttribute('data-tab')); });
    });

    $('connect-btn').addEventListener('click', connect);
    $('new-page-btn').addEventListener('click', function () { openEditor(null); });
    $('editor-close').addEventListener('click', closeEditor);
    $('save-page-btn').addEventListener('click', savePage);
    $('delete-page-btn').addEventListener('click', deleteCurrentPage);
    $('save-config-btn').addEventListener('click', saveConfig);
    $('media-upload').addEventListener('change', function (e) {
      uploadMedia(e.target.files);
      e.target.value = '';
    });
    $('disconnect-btn').addEventListener('click', function () {
      if (window.confirm('Forget the saved token on this browser?')) {
        localStorage.removeItem(LS_KEY);
        location.reload();
      }
    });

    $('f-title').addEventListener('input', function () {
      if (!originalSlug && !$('f-slug').dataset.touched) $('f-slug').value = slugify($('f-title').value);
    });
    $('f-slug').addEventListener('input', function () { $('f-slug').dataset.touched = '1'; });
    $('f-body').addEventListener('input', function () {
      clearTimeout(previewTimer);
      previewTimer = setTimeout(updatePreview, 250);
    });
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && !$('editor').classList.contains('hidden')) {
        e.preventDefault();
        savePage();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
