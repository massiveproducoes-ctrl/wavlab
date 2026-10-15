// @ts-nocheck
/* Wav Lab - vitrine (app.js). Configuracao em config.js */
(function () {
    'use strict';

    var CFG = window.WAVLAB;
    var LICENSES = CFG.LICENSES;
    var PREVIEW_SECONDS = CFG.PREVIEW_SECONDS;
    var BEATS = [];
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

    function brl(n) { return 'R$ ' + Number(n).toLocaleString('pt-BR'); }

    function fmtTime(sec) {
        if (!isFinite(sec) || sec < 0) sec = 0;
        var m = Math.floor(sec / 60);
        var s = Math.floor(sec % 60);
        return m + ':' + (s < 10 ? '0' : '') + s;
    }

    function initials(text) {
        return String(text || '?').trim().split(/\s+/).map(function (w) { return w.charAt(0); }).join('').slice(0, 2).toUpperCase();
    }

    function safeColor(c) { return /^#[0-9a-fA-F]{3,8}$/.test(c || '') ? c : '#ff5500'; }

    function findBeat(id) {
        for (var i = 0; i < BEATS.length; i++) if (BEATS[i].id === id) return BEATS[i];
        return null;
    }

    function coverHTML(beat) {
        return (beat.cover ? '<img src="' + esc(beat.cover) + '" alt="" loading="lazy">' : '') +
            '<span>' + esc(initials(beat.title)) + '</span>';
    }

    var toastTimer = null;
    function toast(msg) {
        var t = $('toast');
        t.textContent = msg;
        t.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
    }

    var minPrice = Math.min.apply(null, LICENSES.map(function (l) { return l.price; }));

    // =========================================================
    // DADOS (Supabase)
    // =========================================================
    function normalize(r) {
        var p = r.producers || {};
        var g = r.genres || {};
        return {
            id: r.id,
            title: r.title,
            bpm: r.bpm,
            key: r.musical_key,
            tags: r.tags || [],
            note: r.note,
            cover: r.cover_url,
            audio: r.preview_url,
            producer: { id: p.id || 'wavlab', name: p.name || 'Wav Lab', handle: p.handle, photo: p.photo_url },
            genre: { id: g.id || 'outro', name: g.name || 'Outro', color: safeColor(g.color), sort: g.sort == null ? 100 : g.sort }
        };
    }

    function loadBeats() {
        showSkeleton();
        if (!window.supabase) { showError(); return; }
        if (!db) db = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY);

        db.from('beats')
            .select('id,title,bpm,musical_key,tags,note,cover_url,preview_url,created_at,producers(id,name,handle,photo_url),genres(id,name,color,sort)')
            .eq('published', true)
            .order('created_at', { ascending: false })
            .then(function (res) {
                if (res.error) throw res.error;
                BEATS = (res.data || []).map(normalize);
                renderBeats();
            })
            .catch(function () { showError(); });
    }

    // =========================================================
    // RENDER
    // =========================================================
    function showSkeleton() {
        $('beatsList').innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
    }

    function showError() {
        $('beatsList').innerHTML =
            '<div class="state-box"><strong>Não foi possível carregar os beats</strong>' +
            'Confira sua conexão e tente de novo.<br><button data-retry>Tentar de novo</button></div>';
    }

    // ---------- filtros ----------
    var filter = { genre: null, producer: null };

    function matchesFilter(b) {
        return (!filter.genre || b.genre.id === filter.genre) &&
               (!filter.producer || b.producer.id === filter.producer);
    }

    function renderFilters() {
        var genres = {}, producers = {}, gList = [], pList = [];

        BEATS.forEach(function (b) {
            if (!genres[b.genre.id]) { genres[b.genre.id] = { g: b.genre, n: 0 }; gList.push(genres[b.genre.id]); }
            genres[b.genre.id].n++;
            if (!producers[b.producer.id]) { producers[b.producer.id] = { p: b.producer, n: 0 }; pList.push(producers[b.producer.id]); }
            producers[b.producer.id].n++;
        });

        // produtores: so aparece se tiver mais de um com beats
        if (pList.length < 2) {
            $('producersWrap').hidden = true;
        } else {
            $('producersWrap').hidden = false;
            $('producersStrip').innerHTML = pList.map(function (x) {
                var on = filter.producer === x.p.id;
                var dim = filter.producer && !on;
                return '<button class="prod-item' + (on ? ' active' : '') + (dim ? ' dim' : '') + '" data-filter-producer="' + esc(x.p.id) + '">' +
                    '<span class="prod-avatar">' + (x.p.photo ? '<img src="' + esc(x.p.photo) + '" alt="" loading="lazy">' : esc(initials(x.p.name))) + '</span>' +
                    '<span class="prod-name">' + esc(x.p.name) + '</span>' +
                    '<span class="prod-count">' + x.n + ' beat' + (x.n === 1 ? '' : 's') + '</span>' +
                '</button>';
            }).join('');
        }

        // generos: so aparece se tiver mais de um
        if (gList.length < 2) {
            $('genreFilters').hidden = true;
        } else {
            gList.sort(function (a, b) { return a.g.sort - b.g.sort; });
            $('genreFilters').hidden = false;
            $('genreFilters').innerHTML =
                '<button class="chip chip-all' + (!filter.genre ? ' active' : '') + '" data-filter-genre="">Todos <span>' + BEATS.length + '</span></button>' +
                gList.map(function (x) {
                    return '<button class="chip' + (filter.genre === x.g.id ? ' active' : '') + '" style="--g:' + x.g.color + '" data-filter-genre="' + esc(x.g.id) + '">' +
                        esc(x.g.name) + ' <span>' + x.n + '</span></button>';
                }).join('');
        }
    }

    function renderBeats() {
        renderFilters();

        if (!BEATS.length) {
            $('beatsList').innerHTML =
                '<div class="state-box"><strong>Novos beats chegando</strong>' +
                'Ainda estamos preparando o catálogo. Volte em breve.</div>';
            return;
        }

        var list = BEATS.filter(matchesFilter);
        if (!list.length) {
            $('beatsList').innerHTML =
                '<div class="state-box"><strong>Nenhum beat com esse filtro</strong>' +
                'Tente outro gênero ou produtor.<br><button data-clear-filters>Limpar filtros</button></div>';
            return;
        }

        $('beatsList').innerHTML = list.map(function (b) {
            var tags = b.tags.map(function (t) { return '<span class="beat-tag">' + esc(t) + '</span>'; }).join('');
            var info = [];
            if (b.bpm) info.push(esc(b.bpm) + ' BPM');
            if (b.key) info.push(esc(b.key));
            var avatar = (b.producer.photo ? '<img src="' + esc(b.producer.photo) + '" alt="" loading="lazy">' : esc(initials(b.producer.name)));

            return '' +
            '<div class="beat-card" data-card="' + esc(b.id) + '">' +
                '<div class="beat-main-row">' +
                    '<div class="beat-cover" style="--g:' + b.genre.color + '">' + coverHTML(b) +
                        '<button class="play-btn" data-play="' + esc(b.id) + '" aria-label="Ouvir ' + esc(b.title) + '"><i class="fa-solid fa-play"></i></button>' +
                    '</div>' +
                    '<div class="beat-details">' +
                        '<div><span class="genre-pill" style="--g:' + b.genre.color + '">' + esc(b.genre.name) + '</span></div>' +
                        '<div class="beat-title">' + esc(b.title) + '</div>' +
                        '<div class="beat-producer"><span class="avatar">' + avatar + '</span><span class="producer-name">' + esc(b.producer.name) + '</span></div>' +
                        '<div class="beat-info">' + info.join(' &middot; ') + '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="beat-footer">' +
                    '<div class="beat-tags">' + tags + '</div>' +
                    '<button class="buy-btn" data-buy="' + esc(b.id) + '">Licenciar &middot; ' + brl(minPrice) + '</button>' +
                '</div>' +
                (b.note
                    ? '<details class="beat-dropdown"><summary><span>Sobre o beat (nota do autor)</span><i class="fa-solid fa-chevron-down"></i></summary>' +
                      '<div class="dropdown-body"><p class="author-note">"' + esc(b.note) + '"</p></div></details>'
                    : '') +
            '</div>';
        }).join('');

        // mantem o estado de "tocando" ao trocar de filtro
        if (playingId) syncIcons(audio.paused ? 'play' : 'pause');
    }

    // =========================================================
    // MODAL DE COMPRA
    // =========================================================
    var modal = $('purchaseModal');
    var currentBeat = null;
    var selectedLicense = LICENSES[0];

    function renderLicenses() {
        $('licenseOptions').innerHTML = LICENSES.map(function (lic) {
            var on = lic.id === selectedLicense.id;
            return '' +
            '<label class="license-option' + (on ? ' selected' : '') + '">' +
                '<div class="license-left">' +
                    '<input type="radio" name="license" value="' + lic.id + '"' + (on ? ' checked' : '') + '>' +
                    '<div class="license-info"><h5>' + esc(lic.name) + '</h5><p>' + esc(lic.desc) + '</p></div>' +
                '</div>' +
                '<span class="license-price">' + brl(lic.price) + '</span>' +
                '<ul class="license-terms">' + (lic.terms || []).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' +
            '</label>';
        }).join('');
    }

    function updateCheckoutLink() {
        if (!currentBeat) return;
        var msg = 'Salve! Quero comprar o beat *' + currentBeat.title + '* (prod. ' + currentBeat.producer.name +
            ') do Wav Lab na licença *' + selectedLicense.name + '* por *' + brl(selectedLicense.price) + '*. Como faço o Pix?';
        $('whatsappCheckoutBtn').href = 'https://wa.me/' + CFG.WHATSAPP + '?text=' + encodeURIComponent(msg);
    }

    function openModal(beatId) {
        currentBeat = findBeat(beatId);
        if (!currentBeat) return;
        selectedLicense = LICENSES[0];
        $('modalBeatTitle').textContent = currentBeat.title;
        $('licenseNotes').innerHTML = (CFG.COMMON_TERMS || []).map(function (t) {
            return '<li>' + esc(t.replace('nome do produtor', currentBeat.producer.name)) + '</li>';
        }).join('');
        renderLicenses();
        updateCheckoutLink();
        modal.classList.add('active');
        document.body.classList.add('modal-open');
    }

    function closeModal() {
        modal.classList.remove('active');
        document.body.classList.remove('modal-open');
    }

    $('licenseOptions').addEventListener('change', function (e) {
        for (var i = 0; i < LICENSES.length; i++) {
            if (LICENSES[i].id === e.target.value) selectedLicense = LICENSES[i];
        }
        renderLicenses();
        updateCheckoutLink();
    });

    // registra o pedido (lead) quando a pessoa toca em "Finalizar"
    $('whatsappCheckoutBtn').addEventListener('click', function () {
        if (!db || !currentBeat) return;
        try {
            db.from('orders').insert({
                beat_id: currentBeat.id,
                beat_title: currentBeat.title,
                license_id: selectedLicense.id,
                price: selectedLicense.price
            }).then(function () {}, function () {});
        } catch (err) { /* nunca atrapalha a compra */ }
    });

    // =========================================================
    // PLAYER (um so audio para a pagina toda)
    // =========================================================
    var audio = new Audio();
    audio.preload = 'none';
    var playingId = null;

    function previewLength() {
        var d = audio.duration;
        return (isFinite(d) && d > 0) ? Math.min(d, PREVIEW_SECONDS) : PREVIEW_SECONDS;
    }

    function setIcon(el, icon) {
        if (!el) return;
        var i = el.querySelector('i');
        if (i) i.className = 'fa-solid ' + icon;
    }

    function syncIcons(state) {
        var icon = state === 'pause' ? 'fa-pause' : state === 'loading' ? 'fa-spinner fa-spin' : 'fa-play';
        var btns = document.querySelectorAll('[data-play]');
        for (var i = 0; i < btns.length; i++) {
            setIcon(btns[i], btns[i].getAttribute('data-play') === playingId ? icon : 'fa-play');
        }
        var cards = document.querySelectorAll('[data-card]');
        for (var j = 0; j < cards.length; j++) {
            cards[j].classList.toggle('is-active', cards[j].getAttribute('data-card') === playingId);
        }
        setIcon($('mpPlay'), icon);
    }

    function showMiniPlayer(beat) {
        $('mpTitle').textContent = beat.title;
        $('mpCover').style.setProperty('--g', beat.genre.color);
        $('mpCover').innerHTML = coverHTML(beat);
        $('mpCurrent').textContent = '0:00';
        $('mpDuration').textContent = fmtTime(PREVIEW_SECONDS);
        $('mpFill').style.width = '0%';
        $('miniPlayer').classList.add('visible');
        $('miniPlayer').setAttribute('aria-hidden', 'false');
        document.body.classList.add('player-on');
    }

    function play(beatId) {
        var beat = findBeat(beatId);
        if (!beat) return;

        if (playingId === beatId) {
            if (audio.paused) {
                if (audio.currentTime >= previewLength()) audio.currentTime = 0;
                audio.play().catch(onError);
            } else {
                audio.pause();
            }
            return;
        }

        audio.pause();
        playingId = beatId;
        audio.src = beat.audio;
        audio.currentTime = 0;
        showMiniPlayer(beat);
        syncIcons('loading');
        audio.play().catch(onError);
    }

    function onError() {
        syncIcons('play');
        toast('Não foi possível carregar o áudio. Confira sua conexão.');
    }

    audio.addEventListener('playing', function () { syncIcons('pause'); });
    audio.addEventListener('waiting', function () { syncIcons('loading'); });
    audio.addEventListener('pause', function () { syncIcons('play'); });
    audio.addEventListener('error', function () { if (playingId) onError(); });

    audio.addEventListener('loadedmetadata', function () {
        $('mpDuration').textContent = fmtTime(previewLength());
    });

    audio.addEventListener('timeupdate', function () {
        var limit = previewLength();
        if (audio.currentTime >= limit) {
            audio.pause();
            audio.currentTime = 0;
            $('mpCurrent').textContent = '0:00';
            $('mpFill').style.width = '0%';
            toast('Fim do preview. Curtiu? Escolha sua licença.');
            return;
        }
        $('mpCurrent').textContent = fmtTime(audio.currentTime);
        $('mpFill').style.width = (audio.currentTime / limit * 100) + '%';
    });

    audio.addEventListener('ended', function () {
        audio.currentTime = 0;
        syncIcons('play');
    });

    $('mpProgress').addEventListener('click', function (e) {
        if (!playingId) return;
        var rect = this.getBoundingClientRect();
        var ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        audio.currentTime = ratio * previewLength();
    });

    $('mpPlay').addEventListener('click', function () {
        if (playingId) play(playingId);
    });

    // =========================================================
    // EVENTOS GERAIS
    // =========================================================
    document.addEventListener('click', function (e) {
        if (e.target.closest('[data-retry]')) { loadBeats(); return; }

        var fg = e.target.closest('[data-filter-genre]');
        if (fg) { filter.genre = fg.getAttribute('data-filter-genre') || null; renderBeats(); return; }

        var fp = e.target.closest('[data-filter-producer]');
        if (fp) {
            var pid = fp.getAttribute('data-filter-producer');
            filter.producer = (filter.producer === pid) ? null : pid;   // tocar de novo desmarca
            renderBeats();
            return;
        }

        if (e.target.closest('[data-clear-filters]')) { filter.genre = null; filter.producer = null; renderBeats(); return; }

        var buy = e.target.closest('[data-buy]');
        if (buy) { openModal(buy.getAttribute('data-buy')); return; }

        var p = e.target.closest('[data-play]');
        if (p) { play(p.getAttribute('data-play')); return; }

        if (e.target.closest('[data-close-modal]') || e.target === modal) closeModal();
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && modal.classList.contains('active')) closeModal();
    });

    loadBeats();
})();
