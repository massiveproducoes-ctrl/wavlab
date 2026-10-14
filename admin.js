// @ts-nocheck
/* Wav Lab - painel admin (admin.js). Configuracao em config.js */
(function () {
    'use strict';

    var CFG = window.WAVLAB;
    var MB = 1024 * 1024;
    var LIMIT_MASTER = 50 * MB;   // limite do plano gratis do Supabase
    var LIMIT_PREVIEW = 15 * MB;

    var state = { genres: [], producers: [], beats: [], files: {}, orders: [] };
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
    function toast(msg) {
        var t = $('toast');
        t.textContent = msg;
        t.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2800);
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
                        '<div class="item-sub"><span>' + esc(p.handle || 'sem @') + '</span><span>' + n + ' beat' + (n === 1 ? '' : 's') + '</span></div>' +
                    '</div>' +
                    '<label class="switch" title="Ativo"><input type="checkbox" data-toggle-producer="' + p.id + '"' + (p.active ? ' checked' : '') + '><span></span></label>' +
                '</div>' +
                '<div class="item-actions"><button class="btn small" data-act="edit-producer" data-id="' + p.id + '"><i class="fa-solid fa-pen"></i> Editar</button></div>' +
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
    // PRODUTOR (criar / editar)
    // =========================================================
    function openProducerForm(p) {
        editingProducer = p || null;
        $('producerModalTitle').textContent = p ? 'Editar produtor' : 'Novo produtor';
        $('pf_name').value = p ? p.name : '';
        $('pf_handle').value = p ? (p.handle || '') : '';
        $('pf_active').checked = p ? !!p.active : true;
        $('pf_photo').value = '';
        $('pf_photo_cur').textContent = p && p.photo_url ? 'Já tem foto. Escolha outra só se quiser trocar.' : '';
        setStatus('pf_status', '');
        openModal('producerModal');
    }

    $('producerForm').addEventListener('submit', async function (e) {
        e.preventDefault();
        var btn = $('pf_save');
        btn.disabled = true;
        try {
            var id = editingProducer ? editingProducer.id : uuid();
            var photo = editingProducer ? editingProducer.photo_url : null;
            var file = $('pf_photo').files[0];
            if (file) {
                setStatus('pf_status', 'Enviando foto...');
                var blob = await resizeToJpeg(file, 500);
                await upload('avatars', id + '/avatar.jpg', blob, 'image/jpeg');
                photo = publicUrl('avatars', id + '/avatar.jpg');
            }
            var handle = $('pf_handle').value.trim();
            if (handle && handle.charAt(0) !== '@') handle = '@' + handle;
            setStatus('pf_status', 'Salvando...');
            var r = await db.from('producers').upsert({
                id: id, name: $('pf_name').value.trim(), handle: handle || null,
                photo_url: photo, active: $('pf_active').checked
            });
            if (r.error) throw new Error(r.error.message);
            closeModals();
            toast('Produtor salvo.');
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
        openModal('beatModal');
    }

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

            var r1 = await db.from('beats').upsert({
                id: id,
                producer_id: $('bf_producer').value,
                genre_id: $('bf_genre').value,
                title: $('bf_title').value.trim(),
                bpm: isNaN(bpm) ? null : bpm,
                musical_key: $('bf_key').value.trim() || null,
                tags: tags,
                note: $('bf_note').value.trim() || null,
                cover_url: coverUrl,
                preview_url: prevUrl,
                published: $('bf_published').checked
            });
            if (r1.error) throw new Error(r1.error.message);

            var r2 = await db.from('beat_files').upsert({
                beat_id: id,
                mp3_path: paths.mp3_path, wav_path: paths.wav_path, stems_path: paths.stems_path,
                stems_link: $('bf_stemslink').value.trim() || null
            });
            if (r2.error) throw new Error(r2.error.message);

            closeModals();
            toast('Beat salvo.');
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
            ['beats', 'producers', 'orders'].forEach(function (n) { $('tab-' + n).hidden = (n !== tab.getAttribute('data-tab')); });
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
