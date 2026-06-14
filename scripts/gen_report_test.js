require('dotenv').config();
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');

function post(pathname, body){
  return new Promise(res=>{
    const b = JSON.stringify(body);
    const r = http.request({hostname:'localhost',port:3000,path:pathname,method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(b)}}, re => {
      let d = '';
      re.on('data', c => d += c);
      re.on('end', () => {
        try{ res({status: re.statusCode, body: JSON.parse(d)}); }
        catch(e){ res({status: re.statusCode, body: d}); }
      });
    });
    r.on('error', e => { console.error('request error', e.message); res({status:0, body:{error:e.message}}); });
    r.write(b);
    r.end();
  });
}

(async ()=>{
  const s = await post('/api/sessao/iniciar',{name:'Teste PDF',email:'teste-pdf@zunisuprema.com.br'});
  console.log('session:', s.body.sessionId);

  const l = await post('/api/dev/liberar-sessao',{sessionId: s.body.sessionId});
  console.log('liberada:', l.body);

  const r = await post('/api/relatorio',{sessionId: s.body.sessionId});
  console.log('relatorio status:', r.status);
  console.log('relatorio body:', JSON.stringify(r.body).slice(0,1200));

  const p = path.join(os.tmpdir(), `relatorio-${s.body.sessionId}.pdf`);
  try{
    const st = fs.statSync(p);
    console.log('pdf_path:', p);
    console.log('pdf_size:', st.size);
  }catch(e){
    console.log('pdf not found at', p);
  }
})();
