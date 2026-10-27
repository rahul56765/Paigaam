'use strict';
const {makeSchema,InputError}=require('../../lib/bfday/fields');
const AUDIO=/^\/bfday\/uploads\/[a-f0-9]{48}\.(?:mp3|wav)$/;
function music(value){if(!value)return '';if(AUDIO.test(value))return value;try{const u=new URL(value);if(u.protocol==='https:'&&!u.username&&!u.password)return u.href;}catch{}return '';}
function spotify(value){try{const u=new URL(value);if(u.protocol!=='https:'||u.hostname!=='open.spotify.com'||u.username||u.password)return '';const match=u.pathname.match(/^\/(?:intl-[a-z]{2}\/)?(?:embed\/)?track\/([A-Za-z0-9]{22})\/?$/);return match?'https://open.spotify.com/track/'+match[1]:'';}catch{return '';}}
const base=makeSchema(require('./config'));
module.exports={...base,validate(data,opts={}){const d=base.validate(data,opts);if(d.spotifyUrl&&!spotify(d.spotifyUrl)&&opts.mode!=='lenient')throw new InputError('love_spotify_url');if(d.songUrl&&!music(d.songUrl)){if(opts.mode!=='lenient')throw new InputError('love_audio_url');d.songUrl='';}return d;},music,spotify,AUDIO};
