'use strict';
const base=require('../../lib/bfday/fields').makeSchema(require('./config'));
const {bgmParse}=require('../../lib/bfday/bgm');
function playableLink(value){
  if(!value||bgmParse(value))return true;
  try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&/\.(mp3|m4a|ogg|wav)$/i.test(u.pathname);}catch{return false;}
}
function mapsLink(value){
  if(!value)return true;
  try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)return false;
    return u.hostname==='maps.app.goo.gl'||(u.hostname==='goo.gl'&&u.pathname.startsWith('/maps'))||u.hostname==='maps.google.com'||(/^((www|maps)\.)?google\.(com|co\.in|co\.uk|com\.au|ca|de|fr|ae|co\.jp|com\.sg)$/.test(u.hostname)&&u.pathname.startsWith('/maps'));
  }catch{return false;}
}
function validate(data,opts={}){
  const clean=base.validate(data,opts),lenient=opts.mode==='lenient';
  for(const [key,check,code] of [['musicLink',playableLink,'invalid_music_link'],['mapsLink',mapsLink,'invalid_maps_link']]){
    if(!check(clean[key])){if(lenient)clean[key]='';else throw new base.InputError(code);}
  }
  return clean;
}
module.exports={...base,validate,playableLink,mapsLink};
