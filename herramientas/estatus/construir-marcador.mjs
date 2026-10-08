// Genera marcador.txt: el texto que se pega como "dirección" de un marcador en Chrome del celular.
// Uso: node herramientas/estatus/construir-marcador.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const aqui = path.dirname(fileURLToPath(import.meta.url));
const core = fs.readFileSync(path.join(aqui, 'extension', 'captura-core.js'), 'utf8');

const programa = `(function(){
${core}
var K='rgo_estatus_cfg',cfg={};
try{cfg=JSON.parse(localStorage.getItem(K)||'{}')}catch(e){}
if(!cfg.url||!cfg.key||/^\\s*(config|configurar)\\s*$/i.test(location.hash.slice(1))){
  var u=prompt('Dirección del servidor RGO (https://...)',cfg.url||'');if(!u)return;
  var k=prompt('Llave de captura (rgo_...)',cfg.key||'');if(!k)return;
  cfg={url:u.trim().replace(/\\/$/,''),key:k.trim()};localStorage.setItem(K,JSON.stringify(cfg));
}
var filas=window.RGOCaptura.capturar(document);
if(!filas.length){alert('No encontré órdenes en esta pantalla. Abre el resultado de la búsqueda (o el detalle de la orden) y vuelve a tocar el marcador.');return;}
fetch(cfg.url+'/api/estatus/ingesta/captura',{method:'POST',headers:{'Content-Type':'application/json','X-Integracion-Key':cfg.key},body:JSON.stringify({fuente:document.title||'',filas:filas})})
.then(function(r){return r.json().then(function(j){return{ok:r.ok,j:j}})})
.then(function(x){alert(x.ok?('Listo: '+x.j.nuevas+' nuevas, '+x.j.actualizadas+' actualizadas ('+x.j.conCambio+' con cambio).'):('Error: '+(x.j.error||'')))})
.catch(function(){var t=JSON.stringify({fuente:document.title||'',filas:filas});try{navigator.clipboard.writeText(t);alert('El portal bloqueó el envio directo. Copie los datos: pegalos en RGO > Estatus > Pegar captura.')}catch(e){alert('El portal bloqueó el envío directo.')}});
})();`;

fs.writeFileSync(path.join(aqui, 'marcador.txt'), 'javascript:' + encodeURIComponent(programa).replace(/'/g, '%27'));
console.log('marcador.txt generado (' + programa.length + ' caracteres)');
