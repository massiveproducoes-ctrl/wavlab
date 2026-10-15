// @ts-nocheck
/* Wav Lab - pagina de licencas (licencas.js). Todo texto, preco e prazo vem de config.js */
(function () {
    'use strict';

    var CFG = window.WAVLAB;

    function $(id) { return document.getElementById(id); }

    function esc(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function brl(n) { return 'R$ ' + Number(n).toLocaleString('pt-BR'); }

    // ---------- cartoes das licencas ----------
    $('licGrid').innerHTML = (CFG.LICENSES || []).map(function (l) {
        return '' +
        '<article class="lic-card">' +
            '<div class="lic-head"><h4 class="lic-name">' + esc(l.name) + '</h4><span class="lic-price">' + brl(l.price) + '</span></div>' +
            '<p class="lic-desc">' + esc(l.desc) + '</p>' +
            '<ul class="lic-terms">' + (l.terms || []).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' +
        '</article>';
    }).join('');

    // ---------- regras gerais ("Proibido ..." recebe o X vermelho) ----------
    $('commonTerms').innerHTML = (CFG.COMMON_TERMS || []).map(function (t) {
        return '<li class="' + (/^proibido/i.test(t) ? 'no' : 'yes') + '">' + esc(t) + '</li>';
    }).join('');

    // ---------- numeros do config no texto ----------
    var slots = document.querySelectorAll('[data-cfg]');
    for (var i = 0; i < slots.length; i++) {
        var v = CFG[slots[i].getAttribute('data-cfg')];
        if (v != null) slots[i].textContent = v;
    }

    // ---------- credito pronto para copiar ----------
    var template = CFG.CREDIT_TEMPLATE || 'Prod. {produtor}';

    function creditLine() {
        var name = $('creditName').value.replace(/\s+/g, ' ').trim() || 'Nome do Produtor';
        return template.replace('{produtor}', function () { return name; });
    }

    function showCredit() { $('creditText').textContent = creditLine(); }
    $('creditName').addEventListener('input', showCredit);
    showCredit();

    var copyTimer = null;
    $('creditCopy').addEventListener('click', function () {
        var text = creditLine();
        function done() {
            $('creditCopyLabel').textContent = 'Copiado!';
            clearTimeout(copyTimer);
            copyTimer = setTimeout(function () { $('creditCopyLabel').textContent = 'Copiar'; }, 1800);
        }
        function fallback() {
            var ta = document.createElement('textarea');
            ta.value = text;
            ta.setAttribute('readonly', '');
            ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); done(); } catch (e) { /* sem permissao: o texto continua selecionavel na tela */ }
            document.body.removeChild(ta);
        }
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
        else fallback();
    });

    // ---------- WhatsApp ----------
    $('ctaWhats').href = 'https://wa.me/' + CFG.WHATSAPP + '?text=' + encodeURIComponent('Salve! Tenho uma dúvida sobre as licenças do Wav Lab.');
})();
