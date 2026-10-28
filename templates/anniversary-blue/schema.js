'use strict';
const {makeSchema,InputError}=require('../../lib/bfday/fields');
const AUDIO=/^\/bfday\/uploads\/[a-f0-9]{48}\.(?:mp3|wav)$/;
function music(value){if(!value)return '';if(AUDIO.test(value))return value;try{const u=new URL(value),h=u.hostname.toLowerCase();const webpage=h==='youtu.be'||h==='youtube.com'||h.endsWith('.youtube.com')||h==='open.spotify.com'||h==='soundcloud.com'||h.endsWith('.soundcloud.com')||h==='music.apple.com';return u.protocol==='https:'&&!u.username&&!u.password&&!webpage?u.href:'';}catch{return '';}}
function spotify(value){try{const u=new URL(value);if(u.protocol!=='https:'||u.hostname!=='open.spotify.com'||u.username||u.password)return null;const m=u.pathname.match(/^\/(?:intl-[a-z]{2}\/)?(?:embed\/)?(track|album|playlist)\/([A-Za-z0-9]{22})\/?$/);return m?{url:`https://open.spotify.com/${m[1]}/${m[2]}`,embed:`https://open.spotify.com/embed/${m[1]}/${m[2]}`} : null;}catch{return null;}}
const base=makeSchema(require('./config'));
module.exports={...base,AUDIO,music,spotify,validate(data,opts={}){const d=base.validate(data,opts);for(const [key,valid,code] of [['songUrl',music,'anniversary_audio_url'],['spotifyUrl',spotify,'anniversary_spotify_url']])if(d[key]&&!valid(d[key])){if(opts.mode!=='lenient')throw new InputError(code);d[key]='';}return d;}};
