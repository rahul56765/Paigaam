'use strict';
const text = (id,label,value,maxLength=100,type='text') => ({id,type,label,default:value,maxLength});
const fields = [
  text('coverTitle','Cover title','Diwali',32),
  text('coverHint','Cover instruction','swipe up to light the diya',65),
  text('heading','Invitation heading',"You’re Invited",60),
  text('title','Golden celebration title','Diwali',48),
  text('subtitle','Script celebration title','party',40),
  text('tagline','Tagline','Bringing Hearts Together,\nOne Light at a Time',160,'textarea'),
  text('hostLine','Invitation host line','Hosted by the Deshpande Family',120),
  text('day','Day of the week','Saturday',30),
  text('date','Date number','17',12),
  text('month','Month','October',30),
  text('year','Year','2026',12),
  text('time','Time','7:30 PM\nonwards',60,'textarea'),
  text('address','Party address','123 Anywhere St., Any City,\nST 12345',220,'textarea'),
  {id:'familyPhoto',type:'image',label:'Family or host photo',alt:'Your family or hosts',hint:'Upload a JPG, PNG or WebP. Replace or remove whenever you like. Use the three sliders below to crop, zoom and move the photo in its gold frame.'},
  {id:'photoZoom',type:'number',label:'Photo zoom / crop',min:100,max:240,default:100,slider:true,unit:'%'},
  {id:'photoX',type:'number',label:'Photo position left / right',min:0,max:100,default:50,slider:true,unit:'%'},
  {id:'photoY',type:'number',label:'Photo position up / down',min:0,max:100,default:50,slider:true,unit:'%'},
  text('regards','Warm regards line','With warm regards',65),
  {...text('familyName','Family / host name','Deshpande Family',100),required:true},
  text('welcomeMessage','Welcome message','We are waiting for you…\nplease do come',220,'textarea'),
  text('thankYou','Thank you line','Thank you',60),
  {id:'mapsLink',type:'url',label:'Google Maps link (optional)',maxLength:1000,hint:'Paste a Google Maps location or share link. The map button is hidden if this is blank.'},
  {id:'musicUpload',type:'audio',label:'Upload your festive song',hint:'MP3, M4A, OGG or WAV, up to 15 MB. Begins after the first touch or tap on the cover; an upload takes priority over a link.'},
  {id:'musicLink',type:'url',label:'Or paste a direct audio / YouTube link',maxLength:500,hint:'HTTPS MP3, M4A, OGG or WAV file, or YouTube link. Spotify / Apple Music share links are not playable background audio. Some YouTube songs require a second tap or block embedding.'},
];
const demo=Object.fromEntries(fields.filter(f=>f.default!==undefined).map(f=>[f.id,f.default]));
module.exports={
  slug:'diwali-deep',family:'bfday',name:'Diwali Deep',category:'Diwali',price:0,currency:'INR',version:1,editable:true,backgroundMusic:false,displayField:'familyName',
  description:'Light a diya with your fingertip. Three emerald-green portrait cards, ornate gold arches, crimson curtains and a personal family welcome.',
  thumbnail_url:'/diwali-deep/thumbnail.svg',ogImage:'/diwali-deep/thumbnail.svg',fields,
  steps:[
    {title:'Cover & invitation',heading:'A little light, a warm invitation',intro:'Every word stays editable while the green, gold and crimson illustration remains intact.',fields:['coverTitle','coverHint','heading','title','subtitle','tagline','hostLine']},
    {title:'Party details',heading:'When and where',intro:'Use the separate day, date, month, year and time fields to match your celebration.',fields:['day','date','month','year','time','address']},
    {title:'Family welcome',heading:'A framed photograph and a personal note',intro:'Upload, replace or remove your photo. Zoom and move it within the gold frame; your live preview shows the crop.',fields:['familyPhoto','photoZoom','photoX','photoY','regards','familyName','welcomeMessage','thankYou','mapsLink']},
    {title:'Music',heading:'The sound of your celebration',intro:'Music is optional and starts only after a guest interacts. Uploaded audio is the most reliable option on phones.',fields:['musicUpload','musicLink']},
  ],
  create:{eyebrow:'Diwali Deep · Festive invitation',headline:'One little flame. A heartfelt welcome.',intro:'An illustrated Diwali invitation in three complete 9:16 cards. Swipe to light the diya, discover your party, and meet the family. Personalise the words, portrait, location and music.',noun:'Diwali invitation',designHeading:'Three luminous portrait cards',designIntro:'Original flat vector illustration, fitted in full on every screen without stretching or cropping.',scenes:['Light the diya inside an engraved golden arch','Your party beneath crimson curtains and hanging lamps','A gold-framed family portrait and warm welcome'],previewCta:'Swipe upward from the diya, or tap to light it.',previewHelp:'Use the arrows, page dots or a sideways swipe to explore.',resultLine:'Share one beautiful invitation link.'},
  demo,sections:['cover','invitation','welcome'],theme:{bg:'#385F50',ink:'#FFF9E9',accent:'#F9C447',soft:'#AD002C',motif:'flame',ampersand:false,serifCase:'title',layout:'story'},
};
