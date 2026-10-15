// @ts-nocheck
// Wav Lab - configuracao unica. Vitrine e admin leem daqui.
// A chave abaixo e PUBLICA (anon) e pode ficar no site.
// NUNCA coloque aqui a "secret key" nem a "service_role".
window.WAVLAB = {
    SUPABASE_URL: 'https://bgthmjchmssorcrirazs.supabase.co',
    SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJndGhtamNobXNzb3JjcmlyYXpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5MDEwNDMsImV4cCI6MjEwNzQ3NzA0M30.Kd5_c-qWdwLED8z7nDQ6LzUPPHux6FSYBL4sXZ3d7cg',

    // Numero que recebe todos os leads (so digitos, com 55 + DDD)
    WHATSAPP: '5591985447000',

    PREVIEW_SECONDS: 30,

    // Texto do topo da vitrine (o slogan ainda esta em definicao)
    HERO_TITLE: 'Beats com identidade.',
    HERO_SUB: 'Previews de 30s. Licencie direto e feche pelo WhatsApp.',

    // =====================================================================
    // LICENCAS - precos iguais para todos no beta.
    // ATENCAO: os limites de "terms" abaixo sao EXEMPLOS de mercado.
    // Combinem com os produtores (e, se possivel, com um advogado) antes
    // de divulgar, e ajuste aqui. O site mostra exatamente o que estiver escrito.
    // =====================================================================
    LICENSES: [
        {
            id: 'mp3', name: 'MP3', desc: 'Arquivo MP3 masterizado', price: 100,
            terms: [
                'Arquivo MP3 de alta qualidade',
                'Até 100 mil streams somados',
                '1 música gravada com o beat',
                '1 clipe de vídeo'
            ]
        },
        {
            id: 'wav', name: 'WAV', desc: 'Arquivo WAV em alta resolução', price: 180,
            terms: [
                'MP3 + WAV em alta resolução',
                'Até 500 mil streams somados',
                '1 música gravada com o beat',
                '1 clipe de vídeo'
            ]
        },
        {
            id: 'stems', name: 'Stems', desc: 'Trackout completo (WAV + MP3)', price: 350,
            terms: [
                'MP3 + WAV + stems separados para mixar',
                'Até 1 milhão de streams somados',
                '1 música gravada com o beat',
                'Até 2 clipes de vídeo'
            ]
        },
        {
            id: 'unlimited', name: 'Unlimited', desc: 'Stems + direitos ilimitados', price: 950,
            terms: [
                'Tudo da licença Stems',
                'Streams e clipes ilimitados',
                'Shows e uso comercial ilimitados',
                'Não exclusiva: o beat segue à venda'
            ]
        }
    ],

    // Regras que valem para todas as licencas
    COMMON_TERMS: [
        'Licença não exclusiva: o beat continua disponível para outros artistas.',
        'Crédito obrigatório nas plataformas: "Prod. nome do produtor".',
        'Proibido revender o beat ou registrá-lo no Content ID.'
    ]
};
