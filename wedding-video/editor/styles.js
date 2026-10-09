// Editor styles (injected once). Paigaam palette: maroon #8F1018 on warm cream.
const css = `
.wv{display:grid;grid-template-columns:minmax(0,1fr) 420px;gap:28px;max-width:1280px;margin:0 auto;padding:20px 18px 80px;color:#3d1b20;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
.wv h1{font-family:Georgia,serif;font-weight:400;color:#8F1018;margin:.2em 0 .1em;font-size:2rem}
.top p{margin:0 0 12px;color:#6b4a4f}
.errs{background:#fff1f1;border:1px solid #f0c2c2;color:#8F1018;border-radius:10px;padding:10px 26px;margin:8px 0}
.sec{background:#fffaf4;border:1px solid #efdccd;border-radius:14px;margin:12px 0;overflow:hidden}
.sec>summary{cursor:pointer;padding:14px 18px;font-weight:600;color:#8F1018;list-style:none}
.sec>summary::-webkit-details-marker{display:none}
.sec>summary:after{content:'+';float:right;font-weight:400}
.sec[open]>summary:after{content:'–'}
.secb{padding:0 18px 16px}
.f{display:flex;flex-direction:column;gap:5px;margin:10px 0;flex:1;min-width:0}
.fl{font-size:.82rem;font-weight:600;color:#6b3b42;letter-spacing:.02em}
.fh{font-size:.76rem;color:#8a6d70}
.wv input:not([type=checkbox]):not([type=range]),.wv textarea,.wv select{width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #e3cbbd;border-radius:10px;background:#fff;font:inherit;color:inherit}
.wv textarea{resize:vertical}
.wv input:focus,.wv textarea:focus,.wv select:focus{outline:2px solid #e07a8f55;border-color:#e07a8f}
.row{display:flex;gap:12px;flex-wrap:wrap}
.row.tight{gap:8px;align-items:center;flex-wrap:nowrap;margin:6px 0}
.card{border:1px solid #efdccd;background:#fff;border-radius:12px;padding:10px 14px;margin:10px 0}
.cardh{display:flex;justify-content:space-between;align-items:center;color:#8F1018}
.ib{border:1px solid #e3cbbd;background:#fff;border-radius:8px;width:32px;height:32px;margin-left:6px;cursor:pointer;color:#8F1018}
.ib:disabled{opacity:.35;cursor:default}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:10px 16px;border-radius:999px;border:1px solid #8F1018;background:#8F1018;color:#fff;cursor:pointer;font:inherit;font-weight:600}
.btn.ghost{background:#fff;color:#8F1018}
.btn:disabled{opacity:.5;cursor:default}
.link{background:none;border:0;color:#8F1018;cursor:pointer;padding:6px 0;font:inherit;font-weight:600}
.chip{border:1px solid #e3cbbd;background:#fff;border-radius:999px;padding:6px 12px;margin:3px;cursor:pointer;font:inherit;font-size:.85rem;color:#6b3b42}
.chip:hover{border-color:#8F1018;color:#8F1018}
.add{margin-top:10px;display:flex;flex-wrap:wrap;align-items:center;gap:2px}
.add>span{font-weight:600;margin-right:6px;color:#6b3b42}
.seg{display:inline-flex;border:1px solid #e3cbbd;border-radius:999px;overflow:hidden}
.seg button{border:0;background:#fff;padding:9px 16px;cursor:pointer;font:inherit}
.seg button.on{background:#8F1018;color:#fff}
.checks{display:flex;gap:18px}
.checkline{display:flex;gap:8px;align-items:center;margin-top:12px}
.sub{margin:12px 0}
.note{font-size:.86rem;color:#6b4a4f;background:#fff4e8;border-radius:10px;padding:10px 12px}
.media{display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap;margin:8px 0}
.thumbs{display:flex;gap:8px}
.thumbs figure{margin:0;width:84px}
.thumbs img,.thumbs video{width:84px;height:150px;object-fit:cover;border-radius:8px;background:#eee;display:block}
.thumbs figcaption{font-size:.72rem;text-align:center;color:#8a6d70}
.mbtns{display:flex;gap:8px;flex-wrap:wrap}
.busy{color:#8F1018;font-weight:600}
.err{color:#b3261e}
.preview{position:sticky;top:12px;align-self:start}
.pv{max-width:420px}
.meta{display:flex;justify-content:space-between;font-size:.8rem;color:#8a6d70;margin:8px 2px}
.jumps{display:flex;flex-wrap:wrap;margin:6px 0 10px}
.actions{display:grid;gap:10px}
.ract{display:flex;gap:12px;align-items:center}
.ract .btn{flex:1}
.share{font-size:.85rem;word-break:break-all}
.toast{position:fixed;bottom:18px;right:18px;max-width:380px;background:#3d1b20;color:#fff;padding:12px 16px;border-radius:12px;cursor:pointer;z-index:50}
.loading{padding:80px;text-align:center;font-family:Georgia,serif;color:#8F1018}
@media (max-width:980px){.wv{grid-template-columns:1fr}.preview{position:static;order:-1}.pv{max-width:340px;margin:0 auto}}
`;
const el = document.createElement('style');
el.textContent = css;
document.head.appendChild(el);
