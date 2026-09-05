'use strict';
// Versioned, reusable template manifest. Assets are application-controlled, never customer URLs.
module.exports = {
  slug: 'ganapati-aagman', name: 'Ganapati Aagman', category: 'Festival', price: 0, currency: 'INR',
  description: 'A blessing unfolds. A little paper boat carries your invitation home to Bappa — a cinematic, scroll-led Ganapati invitation in English, Hindi or Marathi.',
  thumbnail_url: '/ganapati/media/formation-end.jpg',
  version: 1, languages: ['en','hi','mr'], editable: true,
  fields: [
    {id:'familyName',label:'Family / host name',type:'text',required:true,group:'people'},
    {id:'fatherName',label:"Father’s name",type:'text',group:'people'},
    {id:'motherName',label:"Mother’s name",type:'text',group:'people'},
    {id:'familyMembers',label:'Family members / hosts',type:'textarea',group:'people'},
    {id:'customMessage',label:'Your message',type:'textarea',group:'message'},
    {id:'eventDate',label:'Aagman date',type:'date',required:true,group:'occasion'},
    {id:'eventTime',label:'Time',type:'time',required:true,group:'occasion'},
    {id:'venueName',label:'Venue',type:'text',required:true,group:'occasion'},
    {id:'address',label:'Address',type:'textarea',required:true,group:'occasion'}
  ],
  sections:['intro','formation','letter','journey','invitation','family','event','gallery','venue','closing'],
  theme:{bg:'#f5efdf',ink:'#3b2e26',accent:'#a95220',soft:'#e9dfc9',motif:'dove',layout:'cinematic'},
  assets:{formation:'/ganapati/media/formation.mp4',journey:'/ganapati/media/journey.mp4',music:'/ganapati/media/music.mp3'},
  // Festival dates, not muhurat times. Overrides are preserved by the customer form.
  festivalDates:{2026:'2026-09-14',2027:'2027-09-04',2028:'2028-08-23'},
  dateSource:'https://www.drikpanchang.com/festivals/ganesh-chaturthi/ganesh-chaturthi-date-time.html'
};
