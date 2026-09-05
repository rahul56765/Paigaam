'use strict';
class InputError extends Error { constructor(code='validation',status=400){super(code);this.code=code;this.status=status;} }
const fields={familyName:120,fatherName:120,motherName:120,familyMembers:600,customMessage:2000,venueName:160,address:500};
function validate(data){
  if(!data || typeof data!=='object' || Array.isArray(data))throw new InputError();
  if(!['en','hi','mr'].includes(data.language))throw new InputError();
  const clean={language:data.language,timezone:'Asia/Kolkata',templateVersion:1};
  for(const [key,max]of Object.entries(fields)){
    if(data[key]!=null && typeof data[key]!=='string')throw new InputError();
    const value=(data[key]||'').trim();
    if(value.length>max || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value))throw new InputError();
    if(['familyName','venueName','address'].includes(key)&&!value)throw new InputError();
    clean[key]=value;
  }
  if(!/^\d{4}-\d{2}-\d{2}$/.test(data.eventDate||''))throw new InputError();
  const dt=new Date(data.eventDate+'T12:00:00Z');
  if(!Number.isFinite(+dt)||dt.toISOString().slice(0,10)!==data.eventDate||+data.eventDate.slice(0,4)<2026||+data.eventDate.slice(0,4)>2100)throw new InputError();
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(data.eventTime||''))throw new InputError();
  if(data.timezone && data.timezone!=='Asia/Kolkata')throw new InputError();
  clean.eventDate=data.eventDate;clean.eventTime=data.eventTime;
  if(data.photos!=null && (!Array.isArray(data.photos)||data.photos.length>10))throw new InputError('limit');
  clean.photos=(data.photos||[]).map(p=>{
    if(!p||typeof p.url!=='string'||!/^\/ganapati\/uploads\/[a-f0-9]{48}\.webp$/.test(p.url)||typeof p.alt!=='string'||p.alt.length>200)throw new InputError();
    return {url:p.url,alt:p.alt.trim()};
  });
  if(new Set(clean.photos.map(p=>p.url)).size!==clean.photos.length)throw new InputError();
  return clean;
}
module.exports={validate,InputError};
