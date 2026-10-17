// @ts-nocheck
/* Wav Lab - painel admin (admin.js). Configuracao em config.js */
(function () {
    'use strict';

    var CFG = window.WAVLAB;
    var MB = 1024 * 1024;
    var LIMIT_MASTER = 50 * MB;   // limite do plano gratis do Supabase
    var LIMIT_PREVIEW = 15 * MB;
    var TITLE_MAX = CFG.TITLE_MAX || 70;     // limite do titulo do beat (config.js)

    var state = { genres: [], producers: [], beats: [], files: {}, orders: [], waitlist: null, waitlistErr: '' };
    var editingBeat = null;
    var editingProducer = null;
    var deliveryBeat = null;
    var db = null;

    // =========================================================
    // HELPERS
    // =========================================================
    function $(id) { return document.getElementById(id); }

    function esc(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function initials(text) {
        return String(text || '?').trim().split(/\s+/).map(function (w) { return w.charAt(0); }).join('').slice(0, 2).toUpperCase();
    }

    function safeColor(c) { return /^#[0-9a-fA-F]{3,8}$/.test(c || '') ? c : '#ff5500'; }

    function uuid() {
        if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 3 | 8)).toString(16);
        });
    }

    function brl(n) { return 'R$ ' + Number(n).toLocaleString('pt-BR'); }

    function fileExt(file, fallback) {
        var m = /\.([a-z0-9]{1,5})$/i.exec(file.name || '');
        return m ? m[1].toLowerCase() : fallback;
    }

    var toastTimer = null;
    function toast(msg, ms) {
        var t = $('toast');
        t.textContent = msg;
        t.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { t.classList.remove('show'); }, ms || 2800);
    }

    function setStatus(id, msg, isErr) {
        var el = $(id);
        el.textContent = msg || '';
        el.classList.toggle('err', !!isErr);
    }

    function openModal(id) { $(id).classList.add('active'); document.body.classList.add('modal-open'); }
    function closeModals() {
        var all = document.querySelectorAll('.modal-overlay');
        for (var i = 0; i < all.length; i++) all[i].classList.remove('active');
        document.body.classList.remove('modal-open');
    }

    function findIn(list, id) {
        for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
        return null;
    }

    // recorta no centro, deixa quadrada e comprime (foto de celular vira ~150KB)
    function resizeToJpeg(file, size) {
        return new Promise(function (resolve, reject) {
            var url = URL.createObjectURL(file);
            var img = new Image();
            img.onload = function () {
                var s = Math.min(img.width, img.height);
                var out = Math.min(size, s);
                var c = document.createElement('canvas');
                c.width = out; c.height = out;
                c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, out, out);
                c.toBlob(function (blob) {
                    URL.revokeObjectURL(url);
                    blob ? resolve(blob) : reject(new Error('Não consegui processar a imagem.'));
                }, 'image/jpeg', 0.86);
            };
            img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Imagem inválida.')); };
            img.src = url;
        });
    }

    async function upload(bucket, path, body, contentType) {
        var r = await db.storage.from(bucket).upload(path, body, { upsert: true, contentType: contentType || undefined, cacheControl: '3600' });
        if (r.error) throw new Error('Falha no envio (' + bucket + '): ' + r.error.message);
        return path;
    }

    function publicUrl(bucket, path) {
        return db.storage.from(bucket).getPublicUrl(path).data.publicUrl + '?v=' + Date.now();
    }

    // =========================================================
    // LOGIN
    // =========================================================
    function showLogin() {
        $('appView').hidden = true;
        $('logoutBtn').hidden = true;
        $('loginView').hidden = false;
    }

    async function enterApp() {
        $('loginView').hidden = true;
        $('appView').hidden = false;
        $('logoutBtn').hidden = false;
        await loadAll();
    }

    $('loginForm').addEventListener('submit', async function (e) {
        e.preventDefault();
        var btn = $('loginBtn');
        btn.disabled = true; btn.textContent = 'Entrando...';
        var r = await db.auth.signInWithPassword({ email: $('loginEmail').value.trim(), password: $('loginPass').value });
        btn.disabled = false; btn.textContent = 'Entrar';
        if (r.error) { toast('E-mail ou senha incorretos.'); return; }
        $('loginPass').value = '';
        enterApp();
    });

    $('logoutBtn').addEventListener('click', async function () {
        await db.auth.signOut();
        showLogin();
    });

    // =========================================================
    // CARREGAR DADOS
    // =========================================================
    async function loadAll() {
        var res = await Promise.all([
            db.from('genres').select('*').order('sort'),
            db.from('producers').select('*').order('created_at'),
            db.from('beats').select('*').order('created_at', { ascending: false }),
            db.from('beat_files').select('*'),
            db.from('orders').select('*').order('created_at', { ascending: false }).limit(60)
        ]);
        for (var i = 0; i < res.length; i++) {
            if (res[i].error) { toast('Erro ao carregar: ' + res[i].error.message); return; }
        }
        state.genres = res[0].data;
        state.producers = res[1].data;
        state.beats = res[2].data;
        state.files = {};
        res[3].data.forEach(function (f) { state.files[f.beat_id] = f; });
        state.orders = res[4].data;
        renderAll();
        loadWaitlist();      // fora do Promise.all: se a migracao 04 nao foi aplicada, so essa aba avisa
        if (statsLoaded) loadStats();
    }

    function renderAll() { renderBeats(); renderProducers(); renderOrders(); }

    // =========================================================
    // LISTAS
    // =========================================================
    function genreOf(id) { return findIn(state.genres, id) || { name: 'Outro', color: '#71717a' }; }

    function renderBeats() {
        var box = $('beatsAdminList');
        if (!state.beats.length) {
            box.innerHTML = '<div class="empty">Nenhum beat ainda.<br>Cadastre o primeiro produtor e depois o primeiro beat.</div>';
            return;
        }
        box.innerHTML = state.beats.map(function (b) {
            var p = findIn(state.producers, b.producer_id) || { name: '?' };
            var g = genreOf(b.genre_id);
            var f = state.files[b.id] || {};
            var color = safeColor(g.color);
            return '' +
            '<div class="item">' +
                '<div class="item-top">' +
                    '<div class="thumb" style="--g:' + color + '">' + (b.cover_url ? '<img src="' + esc(b.cover_url) + '" alt="">' : '') + '<span>' + esc(initials(b.title)) + '</span></div>' +
                    '<div class="item-info">' +
                        '<div class="item-title">' + esc(b.title) + '</div>' +
                        '<div class="item-sub"><span class="genre-pill" style="--g:' + color + '">' + esc(g.name) + '</span><span>' + esc(p.name) + '</span></div>' +
                    '</div>' +
                    '<label class="switch" title="Publicado"><input type="checkbox" data-toggle-beat="' + b.id + '"' + (b.published ? ' checked' : '') + '><span></span></label>' +
                '</div>' +
                '<div class="badges">' +
                    '<span class="badge ' + (b.preview_url ? 'on' : '') + '">PREVIEW</span>' +
                    '<span class="badge ' + (f.mp3_path ? 'on' : '') + '">MP3</span>' +
                    '<span class="badge ' + (f.wav_path ? 'on' : '') + '">WAV</span>' +
                    '<span class="badge ' + ((f.stems_path || f.stems_link) ? 'on' : '') + '">STEMS</span>' +
                '</div>' +
                '<div class="item-actions">' +
                    '<button class="btn small" data-act="edit-beat" data-id="' + b.id + '"><i class="fa-solid fa-pen"></i> Editar</button>' +
                    '<button class="btn small" data-act="delivery" data-id="' + b.id + '"><i class="fa-solid fa-paper-plane"></i> Entrega</button>' +
                    '<button class="btn small ghost danger" data-act="delete-beat" data-id="' + b.id + '"><i class="fa-solid fa-trash"></i></button>' +
                '</div>' +
            '</div>';
        }).join('');
    }

    function renderProducers() {
        var box = $('producersAdminList');
        if (!state.producers.length) {
            box.innerHTML = '<div class="empty">Nenhum produtor ainda.<br>Comece por você, o Alexandre e o Gabriel.</div>';
            return;
        }
        box.innerHTML = state.producers.map(function (p) {
            var n = state.beats.filter(function (b) { return b.producer_id === p.id; }).length;
            return '' +
            '<div class="item">' +
                '<div class="item-top">' +
                    '<div class="thumb round">' + (p.photo_url ? '<img src="' + esc(p.photo_url) + '" alt="">' : '') + '<span>' + esc(initials(p.name)) + '</span></div>' +
                    '<div class="item-info">' +
                        '<div class="item-title">' + esc(p.name) + '</div>' +
                        '<div class="item-sub"><span>' + esc(p.handle || 'sem @') + '</span><span>' + n + ' beat' + (n === 1 ? '' : 's') + '</span>' + (p.slug ? '<span>' + esc(p.slug) + '</span>' : '') + '</div>' +
                    '</div>' +
                    '<label class="switch" title="Ativo"><input type="checkbox" data-toggle-producer="' + p.id + '"' + (p.active ? ' checked' : '') + '><span></span></label>' +
                '</div>' +
                '<div class="item-actions">' +
                    '<button class="btn small" data-act="edit-producer" data-id="' + p.id + '"><i class="fa-solid fa-pen"></i> Editar</button>' +
                    (p.slug ? '<a class="btn small ghost" href="produtor.html?p=' + encodeURIComponent(p.slug) + '" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i> Página</a>' : '') +
                '</div>' +
            '</div>';
        }).join('');
    }

    function renderOrders() {
        var box = $('ordersAdminList');
        if (!state.orders.length) {
            box.innerHTML = '<div class="empty">Nenhum pedido ainda.</div>';
            return;
        }
        box.innerHTML = state.orders.map(function (o) {
            var when = new Date(o.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
            var opts = ['lead', 'pago', 'entregue'].map(function (s) {
                return '<option value="' + s + '"' + (o.status === s ? ' selected' : '') + '>' + s + '</option>';
            }).join('');
            return '' +
            '<div class="item order">' +
                '<div class="item-top">' +
                    '<div class="item-info">' +
                        '<div class="item-title">' + esc(o.beat_title || 'Beat removido') + '</div>' +
                        '<div class="item-sub"><span>' + esc(String(o.license_id).toUpperCase()) + '</span><span class="order-price">' + (o.price != null ? brl(o.price) : '') + '</span><span>' + esc(when) + '</span></div>' +
                    '</div>' +
                    '<select data-order-status="' + o.id + '">' + opts + '</select>' +
                '</div>' +
            '</div>';
        }).join('');
    }

    // =========================================================
    // LISTA DE ESPERA ("Quero ser avisado")
    // =========================================================
    function fmtPhone(d) {
        d = String(d || '');
        var m = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(d);
        return m ? '+55 ' + m[1] + ' ' + m[2] + '-' + m[3] : '+' + d;
    }

    function fmtWhen(iso) { return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); }

    async function loadWaitlist() {
        var r = await db.from('waitlist').select('*').order('created_at', { ascending: false }).limit(500);
        state.waitlist = r.error ? null : r.data;
        state.waitlistErr = r.error ? r.error.message : '';
        renderWaitlist();
    }

    function renderWaitlist() {
        var box = $('waitlistAdminList');
        $('waitCopy').hidden = true;
        if (state.waitlistErr) {
            $('waitCount').textContent = '';
            box.innerHTML = '<div class="empty">Não foi possível ler a lista.<br>Rode o SQL <b>migracao_04</b> no Supabase.<br><small>' + esc(state.waitlistErr) + '</small></div>';
            return;
        }
        var list = state.waitlist || [];
        $('waitCount').textContent = list.length + (list.length === 1 ? ' pessoa' : ' pessoas');
        if (!list.length) { box.innerHTML = '<div class="empty">Ninguém na lista ainda.</div>'; return; }
        $('waitCopy').hidden = false;
        box.innerHTML = list.map(function (w) {
            return '' +
            '<div class="item">' +
                '<div class="item-top">' +
                    '<div class="item-info">' +
                        '<div class="item-title">' + esc(w.name) + '</div>' +
                        '<div class="item-sub"><span>' + esc(fmtPhone(w.whatsapp)) + '</span><span>' + esc(fmtWhen(w.created_at)) + '</span></div>' +
                    '</div>' +
                '</div>' +
                '<div class="item-actions">' +
                    '<a class="btn small" href="https://wa.me/' + esc(w.whatsapp) + '" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a>' +
                    '<button class="btn small ghost danger" data-act="delete-wait" data-id="' + esc(w.id) + '" aria-label="Remover da lista"><i class="fa-solid fa-trash"></i></button>' +
                '</div>' +
            '</div>';
        }).join('');
    }

    async function deleteWait(id) {
        var w = findIn(state.waitlist || [], Number(id));
        if (!w || !confirm('Remover ' + w.name + ' da lista de espera?')) return;
        var r = await db.from('waitlist').delete().eq('id', w.id);
        if (r.error) { toast('Erro: ' + r.error.message); return; }
        toast('Removido da lista.');
        loadWaitlist();
    }

    $('waitCopy').addEventListener('click', async function () {
        var text = (state.waitlist || []).map(function (w) { return w.name + ' - ' + fmtPhone(w.whatsapp); }).join('\n');
        var done = false;
        try { await navigator.clipboard.writeText(text); done = true; } catch (e) { /* tenta o plano B */ }
        if (!done) {
            var ta = document.createElement('textarea');
            ta.value = text;
            ta.setAttribute('readonly', '');
            ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
            document.body.appendChild(ta);
            ta.select();
            try { done = document.execCommand('copy'); } catch (e) { /* sem permissao */ }
            document.body.removeChild(ta);
        }
        toast(done ? 'Lista copiada.' : 'Não foi possível copiar.');
    });

    // =========================================================
    // RESUMO DOS ULTIMOS 30 DIAS (eventos)
    // =========================================================
    var statsLoaded = false;
    var STATS_DAYS = 30;

    function nfmt(n) { return Number(n || 0).toLocaleString('pt-BR'); }

    // os ultimos N dias (hoje no horario de Sao Paulo, o mesmo usado pelo SQL), do mais antigo ao mais novo
    function lastDays(n) {
        var today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
        var p = today.split('-');
        var base = Date.UTC(+p[0], +p[1] - 1, +p[2]);
        var out = [];
        for (var i = n - 1; i >= 0; i--) out.push(new Date(base - i * 86400000).toISOString().slice(0, 10));
        return out;
    }

    function dayLabel(iso) { return iso.slice(8, 10) + '/' + iso.slice(5, 7); }

    function licenseName(id) {
        var l = findIn(CFG.LICENSES || [], id);
        return l ? l.name : String(id).toUpperCase();
    }

    function beatTitle(id) {
        var b = findIn(state.beats, id);
        return b ? b.title : 'Beat removido';
    }

    // barras horizontais de uma serie so (um tom, valor na ponta)
    function barList(rows, labelOf) {
        var max = rows.reduce(function (m, r) { return Math.max(m, r.n); }, 1);
        return '<ul class="rank">' + rows.map(function (r) {
            return '<li><span class="rank-label">' + esc(labelOf(r)) + '</span>' +
                '<span class="rank-track"><span class="rank-fill" style="width:' + Math.max(2, Math.round(r.n / max * 100)) + '%"></span></span>' +
                '<span class="rank-val">' + nfmt(r.n) + '</span></li>';
        }).join('') + '</ul>';
    }

    function renderStats(s) {
        var t = s.totals || {};
        var days = lastDays(s.days || STATS_DAYS);
        var byDay = {};
        (s.daily || []).forEach(function (d) { byDay[d.day] = d; });
        var series = days.map(function (d) { return { day: d, play: (byDay[d] || {}).play || 0, lic: (byDay[d] || {}).license_click || 0, chk: (byDay[d] || {}).checkout || 0 }; });
        var maxPlay = series.reduce(function (m, x) { return Math.max(m, x.play); }, 0);
        var total = (t.play || 0) + (t.license_click || 0) + (t.checkout || 0) + (t.search_empty || 0);

        $('statsTitle').textContent = 'Últimos ' + (s.days || STATS_DAYS) + ' dias';

        if (!total) {
            $('statsBody').innerHTML = '<div class="empty">Ainda não há eventos neste período.<br>Eles aparecem aqui conforme o pessoal usa a vitrine.</div>';
            return;
        }

        var rate = t.license_click ? Math.round((t.checkout || 0) / t.license_click * 100) : null;
        var html = '';

        html += '<div class="kpis">' +
            '<div class="kpi"><div class="kpi-label">Plays</div><div class="kpi-val">' + nfmt(t.play) + '</div></div>' +
            '<div class="kpi"><div class="kpi-label">Cliques em Licenciar</div><div class="kpi-val">' + nfmt(t.license_click) + '</div></div>' +
            '<div class="kpi"><div class="kpi-label">Finalizar (WhatsApp)</div><div class="kpi-val">' + nfmt(t.checkout) + '</div></div>' +
            '<div class="kpi"><div class="kpi-label">Buscas sem resultado</div><div class="kpi-val">' + nfmt(t.search_empty) + '</div></div>' +
        '</div>';
        if (rate !== null) html += '<p class="hint">De cada 100 cliques em Licenciar, <b>' + rate + '</b> chegaram ao Finalizar.</p>';

        // plays por dia (uma serie, uma cor)
        html += '<div class="stat-card"><div class="stat-title">Plays por dia</div>' +
            '<div class="col-chart" id="colChart" role="img" aria-label="Plays por dia nos últimos ' + days.length + ' dias. Veja a tabela logo abaixo.">' +
                '<span class="col-max">' + nfmt(maxPlay) + '</span>' +
                series.map(function (x, i) {
                    var h = maxPlay ? Math.max(x.play ? 4 : 0, Math.round(x.play / maxPlay * 100)) : 0;
                    return '<div class="col" data-i="' + i + '"><div class="col-fill" style="height:' + h + '%"></div></div>';
                }).join('') +
                '<div class="col-tip" id="colTip" hidden></div>' +
            '</div>' +
            '<div class="col-axis"><span>' + dayLabel(days[0]) + '</span><span>' + dayLabel(days[days.length - 1]) + '</span></div>' +
            '<details class="table-view"><summary>Ver em tabela</summary><div class="table-scroll"><table>' +
                '<thead><tr><th>Dia</th><th>Plays</th><th>Licenciar</th><th>Finalizar</th></tr></thead><tbody>' +
                series.slice().reverse().map(function (x) { return '<tr><td>' + dayLabel(x.day) + '</td><td>' + x.play + '</td><td>' + x.lic + '</td><td>' + x.chk + '</td></tr>'; }).join('') +
            '</tbody></table></div></details></div>';

        if ((s.top_beats || []).length) {
            html += '<div class="stat-card"><div class="stat-title">Beats mais ativos</div><div class="table-scroll"><table>' +
                '<thead><tr><th>Beat</th><th>Plays</th><th>Licenciar</th><th>Finalizar</th></tr></thead><tbody>' +
                s.top_beats.map(function (b) { return '<tr><td class="td-title">' + esc(beatTitle(b.beat_id)) + '</td><td>' + nfmt(b.plays) + '</td><td>' + nfmt(b.license_clicks) + '</td><td>' + nfmt(b.checkouts) + '</td></tr>'; }).join('') +
            '</tbody></table></div></div>';
        }

        if ((s.licenses || []).length) {
            html += '<div class="stat-card"><div class="stat-title">Licenças em Finalizar</div>' +
                barList(s.licenses, function (r) { return licenseName(r.license_id); }) + '</div>';
        }

        if ((s.empty_terms || []).length) {
            html += '<div class="stat-card"><div class="stat-title">Buscas sem resultado</div>' +
                barList(s.empty_terms, function (r) { return r.term; }) +
                '<p class="hint">É o que o pessoal procurou e não achou. Boas ideias de beat.</p></div>';
        }

        html += '<p class="hint">Contagem de ações, não de pessoas: a vitrine não usa cookies nem guarda identificador de quem visita.</p>';
        $('statsBody').innerHTML = html;
        $('statsBody')._series = series;
    }

    async function loadStats() {
        statsLoaded = true;
        var box = $('statsBody');
        box.classList.add('loading');
        var r = await db.rpc('events_summary', { days: STATS_DAYS });
        box.classList.remove('loading');
        if (r.error || !r.data) {
            box.innerHTML = '<div class="empty">Não foi possível carregar o resumo.<br>Rode o SQL <b>migracao_04</b> no Supabase.<br><small>' + esc(r.error ? r.error.message : '') + '</small></div>';
            return;
        }
        renderStats(r.data);
    }

    $('statsReload').addEventListener('click', loadStats);

    // dica ao passar/tocar numa coluna do grafico
    function showTip(e) {
        var col = e.target.closest && e.target.closest('.col');
        var tip = $('colTip');
        if (!tip) return;
        if (!col) { tip.hidden = true; return; }
        var x = $('statsBody')._series[+col.getAttribute('data-i')];
        tip.textContent = dayLabel(x.day) + ': ' + x.play + (x.play === 1 ? ' play' : ' plays');
        tip.hidden = false;
        var chart = $('colChart'), cr = col.getBoundingClientRect(), pr = chart.getBoundingClientRect();
        var left = cr.left - pr.left + cr.width / 2;
        tip.style.left = Math.max(40, Math.min(pr.width - 40, left)) + 'px';
    }
    $('statsBody').addEventListener('pointerover', showTip);
    $('statsBody').addEventListener('pointerdown', showTip);
    $('statsBody').addEventListener('pointerleave', function () { var tip = $('colTip'); if (tip) tip.hidden = true; });

    // =========================================================
    // PRODUTOR (criar / editar)
    // =========================================================
    var slugTouched = false;

    // "Alexandre Cunha" vira "alexandre-cunha"
    function slugify(s) {
        return norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30).replace(/-+$/, '');
    }

    // aceita "@user", "user" ou o link do perfil; devolve "@user" ('' se vazio)
    function cleanHandle(v) {
        v = String(v || '').trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/[\/?#].*$/, '').replace(/^@+/, '');
        return v ? '@' + v : '';
    }

    function slugProblem(slug, selfId) {
        if (!slug) return '';
        if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return 'Use só letras minúsculas, números e hífen (sem espaço nem acento).';
        if ((CFG.RESERVED_SLUGS || []).indexOf(slug) > -1) return '"' + slug + '" já é uma página do site. Escolha outro endereço.';
        for (var i = 0; i < state.producers.length; i++) {
            if (state.producers[i].slug === slug && state.producers[i].id !== selfId) return 'Esse endereço já é de ' + state.producers[i].name + '.';
        }
        return '';
    }

    function siteBase() { return location.origin + location.pathname.replace(/[^\/]*$/, ''); }

    function updateSlugHint() {
        var slug = $('pf_slug').value.trim().toLowerCase();
        var hint = $('pf_slug_hint');
        var problem = slugProblem(slug, editingProducer ? editingProducer.id : null);
        if (problem) { hint.className = 'hint warn'; hint.textContent = problem; }
        else if (slug) { hint.className = 'hint ok'; hint.textContent = 'Link da página: ' + siteBase() + 'produtor.html?p=' + slug + ' (funciona assim que o produtor for salvo, sem criar pasta).'; }
        else { hint.className = 'hint'; hint.textContent = 'Deixe vazio para o produtor ficar sem página e sem link na vitrine.'; }
    }

    $('pf_slug').addEventListener('input', function () { slugTouched = true; updateSlugHint(); });
    $('pf_name').addEventListener('input', function () {
        if (slugTouched) return;
        $('pf_slug').value = slugify(this.value);
        updateSlugHint();
    });

    function openProducerForm(p) {
        editingProducer = p || null;
        slugTouched = !!(p && p.slug);
        $('producerModalTitle').textContent = p ? 'Editar produtor' : 'Novo produtor';
        $('pf_name').value = p ? p.name : '';
        $('pf_handle').value = p ? (p.handle || '') : '';
        $('pf_slug').value = p ? (p.slug || '') : '';
        $('pf_bio').value = p ? (p.bio || '') : '';
        $('pf_spotify').value = p ? (p.spotify_url || '') : '';
        $('pf_active').checked = p ? !!p.active : true;
        $('pf_photo').value = '';
        $('pf_photo_cur').textContent = p && p.photo_url ? 'Já tem foto. Escolha outra só se quiser trocar.' : '';
        setStatus('pf_status', '');
        updateSlugHint();
        openModal('producerModal');
    }

    $('producerForm').addEventListener('submit', async function (e) {
        e.preventDefault();
        var btn = $('pf_save');
        btn.disabled = true;
        try {
            var id = editingProducer ? editingProducer.id : uuid();
            var photo = editingProducer ? editingProducer.photo_url : null;

            // confere tudo antes de enviar qualquer arquivo
            var handle = cleanHandle($('pf_handle').value);
            if (handle && !/^@[A-Za-z0-9._]{1,30}$/.test(handle)) throw new Error('O @ do Instagram só pode ter letras, números, ponto e sublinhado.');
            var slug = $('pf_slug').value.trim().toLowerCase();
            var problem = slugProblem(slug, id);
            if (problem) throw new Error(problem);
            var bio = $('pf_bio').value.replace(/\s+/g, ' ').trim();
            if (bio.length > 280) throw new Error('A bio passa de 280 caracteres (' + bio.length + ').');
            var spotify = $('pf_spotify').value.trim();
            if (spotify && !/^https:\/\/(open\.)?spotify\.com\//i.test(spotify)) throw new Error('O link do Spotify deve começar com https://open.spotify.com/');

            var file = $('pf_photo').files[0];
            if (file) {
                setStatus('pf_status', 'Enviando foto...');
                var blob = await resizeToJpeg(file, 500);
                await upload('avatars', id + '/avatar.jpg', blob, 'image/jpeg');
                photo = publicUrl('avatars', id + '/avatar.jpg');
            }
            setStatus('pf_status', 'Salvando...');
            var row = {
                id: id, name: $('pf_name').value.trim(), handle: handle || null,
                photo_url: photo, active: $('pf_active').checked
            };
            var r = await db.from('producers').upsert(Object.assign({}, row, { slug: slug || null, bio: bio || null, spotify_url: spotify || null }));
            var extrasSkipped = false;
            if (r.error && /duplicate|unique/i.test(r.error.message || '')) throw new Error('Esse endereço já é de outro produtor.');
            if (r.error && /could not find|does not exist/i.test(r.error.message || '') && /slug|bio|spotify_url/.test(r.error.message || '')) {
                // banco ainda sem a migracao 03: salva o resto e avisa
                extrasSkipped = true;
                r = await db.from('producers').upsert(row);
            }
            if (r.error) throw new Error(r.error.message);

            var msg = 'Produtor salvo.';
            if (extrasSkipped) msg = 'Produtor salvo, mas endereço, bio e Spotify não foram gravados: rode o SQL migracao_03 no Supabase.';
            closeModals();
            toast(msg, msg.length > 20 ? 6000 : 2800);
            await loadAll();
        } catch (err) {
            setStatus('pf_status', err.message, true);
        }
        btn.disabled = false;
    });

    // =========================================================
    // BEAT (criar / editar)
    // =========================================================
    function fillSelects() {
        $('bf_producer').innerHTML = '<option value="">Escolha...</option>' + state.producers.map(function (p) {
            return '<option value="' + p.id + '">' + esc(p.name) + '</option>';
        }).join('');
        $('bf_genre').innerHTML = '<option value="">Escolha...</option>' + state.genres.map(function (g) {
            return '<option value="' + esc(g.id) + '">' + esc(g.name) + '</option>';
        }).join('');
    }

    function curHint(id, text) { $(id).textContent = text || ''; }

    function openBeatForm(b) {
        if (!state.producers.length) { toast('Cadastre um produtor primeiro.'); return; }
        editingBeat = b || null;
        var f = b ? (state.files[b.id] || {}) : {};
        fillSelects();
        $('beatModalTitle').textContent = b ? 'Editar beat' : 'Novo beat';
        $('bf_title').value = b ? b.title : '';
        $('bf_producer').value = b ? b.producer_id : '';
        $('bf_genre').value = b ? b.genre_id : '';
        $('bf_bpm').value = b && b.bpm ? b.bpm : '';
        $('bf_key').value = b ? (b.musical_key || '') : '';
        $('bf_tags').value = b ? (b.tags || []).join(', ') : '';
        $('bf_types').value = b ? (b.type_artists || []).join(', ') : '';
        $('bf_note').value = b ? (b.note || '') : '';
        $('bf_published').checked = b ? !!b.published : false;
        $('bf_stemslink').value = f.stems_link || '';
        ['bf_cover', 'bf_preview', 'bf_mp3', 'bf_wav', 'bf_stems'].forEach(function (id) { $(id).value = ''; });
        curHint('bf_cover_cur', b && b.cover_url ? 'Já tem capa. Escolha outra só se quiser trocar.' : '');
        curHint('bf_preview_hint', b && b.preview_url ? 'Já tem preview. Escolha outro só se quiser trocar.' : '');
        curHint('bf_mp3_cur', f.mp3_path ? 'Já enviado.' : '');
        curHint('bf_wav_cur', f.wav_path ? 'Já enviado.' : '');
        curHint('bf_stems_cur', f.stems_path ? 'Já enviado.' : '');
        $('bf_preview_hint').className = 'hint';
        setStatus('bf_status', '');
        updateTitleHint();
        openModal('beatModal');
    }

    // ---------- titulo bom para busca (SEO) ----------
    function norm(s) {
        s = String(s == null ? '' : s).toLowerCase();
        try { s = s.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) { /* navegador antigo */ }
        return s;
    }

    function parseList(str, max) {
        return String(str || '').split(',').map(function (t) { return t.trim(); }).filter(Boolean).slice(0, max);
    }

    var titleSuggestion = '';

    $('bf_title').maxLength = TITLE_MAX;
    $('titleMaxGuide').textContent = TITLE_MAX;

    function updateTitleHint() {
        var len = $('bf_title').value.length;
        var counter = $('bf_title_count');
        counter.textContent = len + '/' + TITLE_MAX;
        counter.className = 'char-count' + (len > TITLE_MAX ? ' over' : len >= TITLE_MAX - 10 ? ' warn' : '');

        var title = $('bf_title').value.trim();
        var types = parseList($('bf_types').value, 5);
        var hint = $('bf_title_hint'), btn = $('bf_title_use');
        var hasType = /type\s*beat/i.test(title);
        var nt = norm(title);
        var cites = types.some(function (x) { return nt.indexOf(norm(x)) > -1; });
        var problems = [];

        titleSuggestion = '';
        btn.hidden = true;

        if (!title) {
            hint.className = 'hint';
            hint.textContent = 'Formato: Artista Type Beat - "Nome do beat". Ex.: Drake Type Beat - "Midnight Vibes".';
            return;
        }
        if (!hasType) problems.push('Falta "Type Beat" no título (é o que o artista digita na busca).');
        if (hasType && types.length && !cites) problems.push('O título não cita nenhum artista do campo "Type de".');
        if (title.length > TITLE_MAX) problems.push('Tem ' + title.length + ' caracteres; o limite é ' + TITLE_MAX + '. Encurte para poder salvar.');

        if (!problems.length) {
            hint.className = 'hint ok';
            hint.textContent = 'Ótimo para busca (' + title.length + ' caracteres).';
        } else {
            hint.className = 'hint warn';
            hint.textContent = problems.join(' ');
        }

        if (!hasType && types.length) {
            var s = types.slice(0, 2).join(' x ') + ' Type Beat - "' + title + '"';
            if (s.length <= TITLE_MAX) {
                titleSuggestion = s;
                btn.textContent = 'Usar: ' + s;
                btn.hidden = false;
            } else {
                hint.textContent += ' A sugestão com "Type Beat" passaria de ' + TITLE_MAX + ' caracteres (' + s.length + '): encurte o nome do beat.';
            }
        }
    }

    $('bf_title').addEventListener('input', updateTitleHint);
    $('bf_types').addEventListener('input', updateTitleHint);
    $('bf_title_use').addEventListener('click', function () {
        if (titleSuggestion) { $('bf_title').value = titleSuggestion; updateTitleHint(); }
    });

    // avisa se o preview nao tem ~30s
    $('bf_preview').addEventListener('change', function () {
        var file = this.files[0];
        var hint = $('bf_preview_hint');
        hint.className = 'hint';
        if (!file) return;
        var a = new Audio();
        var url = URL.createObjectURL(file);
        a.preload = 'metadata';
        a.onloadedmetadata = function () {
            var d = Math.round(a.duration);
            if (d > 45) { hint.textContent = 'Esse arquivo tem ' + d + 's. O preview deve ter ~30s e com a tag de voz.'; hint.className = 'hint warn'; }
            else { hint.textContent = d + 's. Confirme que tem a tag de voz.'; hint.className = 'hint ok'; }
            URL.revokeObjectURL(url);
        };
        a.onerror = function () { URL.revokeObjectURL(url); };
        a.src = url;
    });

    $('beatForm').addEventListener('submit', async function (e) {
        e.preventDefault();
        var btn = $('bf_save');
        var coverF = $('bf_cover').files[0], prevF = $('bf_preview').files[0];
        var mp3F = $('bf_mp3').files[0], wavF = $('bf_wav').files[0], stemsF = $('bf_stems').files[0];

        var titleLen = $('bf_title').value.trim().length;
        if (titleLen > TITLE_MAX) { setStatus('bf_status', 'O título tem ' + titleLen + ' caracteres; o limite é ' + TITLE_MAX + '. Encurte para salvar.', true); $('bf_title').focus(); return; }
        if (!editingBeat && !prevF) { setStatus('bf_status', 'Falta o preview de 30s com tag.', true); return; }
        if (prevF && prevF.size > LIMIT_PREVIEW) { setStatus('bf_status', 'Preview acima de 15MB. Exporte em MP3 128-192kbps.', true); return; }
        var big = [mp3F, wavF, stemsF].filter(function (x) { return x && x.size > LIMIT_MASTER; })[0];
        if (big) { setStatus('bf_status', '"' + big.name + '" passa de 50MB. Suba no Drive e cole o link em "link dos stems".', true); return; }

        btn.disabled = true;
        try {
            var id = editingBeat ? editingBeat.id : uuid();
            var old = editingBeat ? (state.files[id] || {}) : {};
            var coverUrl = editingBeat ? editingBeat.cover_url : null;
            var prevUrl = editingBeat ? editingBeat.preview_url : null;
            var paths = { mp3_path: old.mp3_path || null, wav_path: old.wav_path || null, stems_path: old.stems_path || null };

            if (coverF) {
                setStatus('bf_status', 'Enviando capa...');
                await upload('covers', id + '/cover.jpg', await resizeToJpeg(coverF, 1000), 'image/jpeg');
                coverUrl = publicUrl('covers', id + '/cover.jpg');
            }
            if (prevF) {
                setStatus('bf_status', 'Enviando preview...');
                var pe = fileExt(prevF, 'mp3');
                await upload('previews', id + '/preview.' + pe, prevF, prevF.type);
                prevUrl = publicUrl('previews', id + '/preview.' + pe);
            }
            if (mp3F) { setStatus('bf_status', 'Enviando MP3 master...'); paths.mp3_path = await upload('masters', id + '/master.' + fileExt(mp3F, 'mp3'), mp3F, mp3F.type); }
            if (wavF) { setStatus('bf_status', 'Enviando WAV master...'); paths.wav_path = await upload('masters', id + '/master.' + fileExt(wavF, 'wav'), wavF, wavF.type); }
            if (stemsF) { setStatus('bf_status', 'Enviando stems...'); paths.stems_path = await upload('masters', id + '/stems.' + fileExt(stemsF, 'zip'), stemsF, stemsF.type); }

            setStatus('bf_status', 'Salvando...');
            var tags = $('bf_tags').value.split(',').map(function (t) { return t.trim().toLowerCase(); }).filter(Boolean).slice(0, 6);
            var bpm = parseInt($('bf_bpm').value, 10);

            var row = {
                id: id,
                producer_id: $('bf_producer').value,
                genre_id: $('bf_genre').value,
                title: $('bf_title').value.trim(),
                bpm: isNaN(bpm) ? null : bpm,
                musical_key: $('bf_key').value.trim() || null,
                tags: tags,
                type_artists: parseList($('bf_types').value, 5),
                note: $('bf_note').value.trim() || null,
                cover_url: coverUrl,
                preview_url: prevUrl,
                published: $('bf_published').checked
            };
            var r1 = await db.from('beats').upsert(row);
            var typesSkipped = false;
            if (r1.error && /type_artists/.test(r1.error.message || '')) {
                // banco ainda sem a migracao 02: salva o resto e avisa
                delete row.type_artists;
                typesSkipped = true;
                r1 = await db.from('beats').upsert(row);
            }
            if (r1.error && /beats_title_len/.test(r1.error.message || '')) throw new Error('O título passa de ' + TITLE_MAX + ' caracteres. Encurte para salvar.');
            if (r1.error) throw new Error(r1.error.message);

            var r2 = await db.from('beat_files').upsert({
                beat_id: id,
                mp3_path: paths.mp3_path, wav_path: paths.wav_path, stems_path: paths.stems_path,
                stems_link: $('bf_stemslink').value.trim() || null
            });
            if (r2.error) throw new Error(r2.error.message);

            closeModals();
            toast(typesSkipped ? 'Beat salvo, mas o "Type de" não foi gravado: rode o SQL migracao_02 no Supabase.' : 'Beat salvo.');
            await loadAll();
        } catch (err) {
            setStatus('bf_status', err.message, true);
        }
        btn.disabled = false;
    });

    async function deleteBeat(b) {
        if (!confirm('Excluir "' + b.title + '" e todos os arquivos dele? Não dá para desfazer.')) return;
        try {
            var buckets = ['covers', 'previews', 'masters'];
            for (var i = 0; i < buckets.length; i++) {
                var l = await db.storage.from(buckets[i]).list(b.id);
                if (l.data && l.data.length) {
                    await db.storage.from(buckets[i]).remove(l.data.map(function (x) { return b.id + '/' + x.name; }));
                }
            }
            var r = await db.from('beats').delete().eq('id', b.id);
            if (r.error) throw new Error(r.error.message);
            toast('Beat excluído.');
            await loadAll();
        } catch (err) { toast('Erro: ' + err.message); }
    }

    // =========================================================
    // ENTREGA (links temporarios das masters)
    // =========================================================
    function openDelivery(b) {
        deliveryBeat = b;
        $('dl_title').textContent = 'Entrega: ' + b.title;
        $('dl_license').innerHTML = CFG.LICENSES.map(function (l) {
            return '<option value="' + l.id + '">' + esc(l.name) + ' (' + brl(l.price) + ')</option>';
        }).join('');
        $('dl_message').hidden = true;
        $('dl_copy').hidden = true;
        setStatus('dl_status', '');
        openModal('deliveryModal');
    }

    $('dl_generate').addEventListener('click', async function () {
        var b = deliveryBeat;
        var f = state.files[b.id] || {};
        var lic = $('dl_license').value;
        var want = lic === 'mp3' ? ['mp3'] : lic === 'wav' ? ['mp3', 'wav'] : ['mp3', 'wav', 'stems'];
        var labels = { mp3: 'MP3', wav: 'WAV', stems: 'Stems' };
        var lines = [], missing = [];
        var btn = $('dl_generate');
        btn.disabled = true;
        setStatus('dl_status', 'Gerando links...');
        try {
            for (var i = 0; i < want.length; i++) {
                var k = want[i];
                var path = f[k + '_path'];
                if (path) {
                    var r = await db.storage.from('masters').createSignedUrl(path, 7 * 24 * 3600);
                    if (r.error) throw new Error(r.error.message);
                    lines.push(labels[k] + ': ' + r.data.signedUrl);
                } else if (k === 'stems' && f.stems_link) {
                    lines.push('Stems: ' + f.stems_link);
                } else {
                    missing.push(labels[k]);
                }
            }
            if (!lines.length) throw new Error('Esse beat não tem nenhum arquivo master enviado.');
            var licName = findIn(CFG.LICENSES, lic).name;
            $('dl_message').value =
                'Pagamento confirmado! Seguem seus arquivos de *' + b.title + '* (licença ' + licName + '):\n\n' +
                lines.join('\n\n') + '\n\nOs links valem por 7 dias, baixe e guarde. Qualquer coisa é só chamar!';
            $('dl_message').hidden = false;
            $('dl_copy').hidden = false;
            setStatus('dl_status', missing.length ? 'Atenção: faltam arquivos de ' + missing.join(', ') + ' neste beat.' : 'Pronto. Copie e cole no WhatsApp do cliente.', missing.length > 0);
        } catch (err) {
            setStatus('dl_status', err.message, true);
        }
        btn.disabled = false;
    });

    $('dl_copy').addEventListener('click', async function () {
        var ta = $('dl_message');
        try { await navigator.clipboard.writeText(ta.value); toast('Mensagem copiada.'); }
        catch (e) { ta.select(); document.execCommand('copy'); toast('Mensagem copiada.'); }
    });

    // =========================================================
    // EVENTOS
    // =========================================================
    document.addEventListener('click', function (e) {
        var tab = e.target.closest('[data-tab]');
        if (tab) {
            var tabs = document.querySelectorAll('.tab');
            for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle('active', tabs[i] === tab);
            var name = tab.getAttribute('data-tab');
            ['beats', 'producers', 'orders', 'waitlist', 'stats'].forEach(function (n) { $('tab-' + n).hidden = (n !== name); });
            if (name === 'stats' && !statsLoaded) loadStats();
            tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });     // a barra de abas rola ate a aba escolhida
            return;
        }

        if (e.target.closest('[data-close]') || (e.target.classList && e.target.classList.contains('modal-overlay'))) { closeModals(); return; }

        var act = e.target.closest('[data-act]');
        if (!act) return;
        var a = act.getAttribute('data-act');
        var id = act.getAttribute('data-id');
        if (a === 'new-beat') openBeatForm(null);
        else if (a === 'new-producer') openProducerForm(null);
        else if (a === 'edit-beat') openBeatForm(findIn(state.beats, id));
        else if (a === 'edit-producer') openProducerForm(findIn(state.producers, id));
        else if (a === 'delivery') openDelivery(findIn(state.beats, id));
        else if (a === 'delete-beat') deleteBeat(findIn(state.beats, id));
        else if (a === 'delete-wait') deleteWait(id);
    });

    document.addEventListener('change', async function (e) {
        var t = e.target;
        var bid = t.getAttribute && t.getAttribute('data-toggle-beat');
        var pid = t.getAttribute && t.getAttribute('data-toggle-producer');
        var oid = t.getAttribute && t.getAttribute('data-order-status');
        var r;
        if (bid) {
            r = await db.from('beats').update({ published: t.checked }).eq('id', bid);
            if (r.error) { t.checked = !t.checked; toast('Erro: ' + r.error.message); }
            else { findIn(state.beats, bid).published = t.checked; toast(t.checked ? 'Beat publicado.' : 'Beat oculto.'); }
        } else if (pid) {
            r = await db.from('producers').update({ active: t.checked }).eq('id', pid);
            if (r.error) { t.checked = !t.checked; toast('Erro: ' + r.error.message); }
            else { findIn(state.producers, pid).active = t.checked; toast(t.checked ? 'Produtor ativo.' : 'Produtor oculto.'); }
        } else if (oid) {
            r = await db.from('orders').update({ status: t.value }).eq('id', oid);
            toast(r.error ? 'Erro: ' + r.error.message : 'Status atualizado.');
        }
    });

    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModals(); });

    // =========================================================
    // START
    // =========================================================
    async function init() {
        if (!window.supabase) { showLogin(); toast('Sem conexão com o servidor. Recarregue a página.'); return; }
        db = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY);
        var s = await db.auth.getSession();
        if (s.data && s.data.session) enterApp(); else showLogin();
    }
    init();
})();
