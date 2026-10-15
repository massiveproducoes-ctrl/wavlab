// @ts-nocheck
/* Wav Lab - pecas comuns das paginas (Quem somos + links do rodape). Configuracao em config.js */
(function () {
    'use strict';

    var CFG = window.WAVLAB || {};
    var ROOT = document.body.getAttribute('data-root') || '';     // paginas dentro de pastas (/slug/) usam "../"

    function esc(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // Quem somos
    var about = document.getElementById('about');
    if (about && CFG.ABOUT_TEXT) {
        about.innerHTML =
            '<div class="about-card">' +
                '<h3 class="section-label">' + esc(CFG.ABOUT_TITLE || 'Quem somos') + '</h3>' +
                '<p>' + esc(CFG.ABOUT_TEXT) + '</p>' +
            '</div>';
        about.hidden = false;
    }

    // Links do rodape
    var footer = document.getElementById('siteFooter');
    if (footer) {
        var links = [];
        if (footer.getAttribute('data-page') !== 'licencas') {
            links.push('<a href="' + ROOT + 'licencas.html"><i class="fa-solid fa-file-contract" aria-hidden="true"></i> Entenda as licenças</a>');
        }
        if (/^https:\/\//.test(CFG.INSTAGRAM || '')) {
            links.push('<a href="' + esc(CFG.INSTAGRAM) + '" target="_blank" rel="noopener"><i class="fa-brands fa-instagram" aria-hidden="true"></i> Instagram</a>');
        }
        if (/^\d{10,15}$/.test(CFG.WHATSAPP || '')) {
            links.push('<a href="https://wa.me/' + esc(CFG.WHATSAPP) + '" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp" aria-hidden="true"></i> WhatsApp</a>');
        }
        if (links.length) footer.insertAdjacentHTML('afterbegin', '<nav class="footer-links" aria-label="Links do site">' + links.join('') + '</nav>');
    }
})();
