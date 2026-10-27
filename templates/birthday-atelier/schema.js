'use strict';
const {makeSchema,InputError}=require('../../lib/bfday/fields');
const {safeURL,spotifyURL}=require('./urls');
const base=makeSchema(require('./config'));
module.exports={...base,validate(data,opts={}){
 const clean=base.validate(data,opts),lenient=opts.mode==='lenient';
 if(clean.playlistUrl&&!spotifyURL(clean.playlistUrl)){if(!lenient)throw new InputError('atelier_spotify_url');clean.playlistUrl='';}
 for(const song of clean.songs){if(song.audio&&!safeURL(song.audio)){if(!lenient)throw new InputError('atelier_audio_url');song.audio='';}}
 return clean;
}};
