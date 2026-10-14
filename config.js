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

    // Precos iguais para todos no beta
    LICENSES: [
        { id: 'mp3',       name: 'MP3',       desc: 'Arquivo MP3 masterizado',       price: 100 },
        { id: 'wav',       name: 'WAV',       desc: 'Arquivo WAV em alta resolução', price: 180 },
        { id: 'stems',     name: 'Stems',     desc: 'Trackout completo (WAV + MP3)', price: 350 },
        { id: 'unlimited', name: 'Unlimited', desc: 'Stems + direitos ilimitados',   price: 950 }
    ]
};
