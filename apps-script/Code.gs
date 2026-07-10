/*************************************************************
 * TeamPro 教練共同備課系統 —— 雲端同步後端 (Google Apps Script)
 * 資料存在「這個試算表」的 DB 分頁，每一筆一列。
 * 前端(index.html)透過 fetch 呼叫 /exec 做 push / pull / replaceAll。
 *
 * 部署步驟：
 *  1. 建一個新的 Google 試算表 → 擴充功能 → Apps Script。
 *  2. 把本檔內容整段貼進去，儲存。
 *  3. 右上「部署」→ 新增部署 → 類型選「網頁應用程式」。
 *  4. 執行身分：我(你自己)；誰可以存取：「任何人」。
 *  5. 部署 → 複製 /exec 網址。
 *  6. 把該網址貼進 index.html 最上面的 DEFAULT_SYNC_URL，或登入後在「設定」貼上。
 *  7. 之後每次改 Code.gs 都要「管理部署 → 編輯(鉛筆) → 版本選新版本 → 部署」，網址不變。
 *************************************************************/

function doGet(e){
  var a=(e && e.parameter && e.parameter.action)||'';
  if(a==='pull') return json(pull(getDB(), Number(e.parameter.since||0)));
  return json({ok:true, msg:'TeamPro sync alive', time:Date.now()});
}

function doPost(e){
  var lock=LockService.getScriptLock();
  lock.waitLock(30000);
  try{
    var req=JSON.parse(e.postData.contents);
    var sh=getDB();
    if(req.action==='push')       return json(push(sh, req.records||[]));
    if(req.action==='pull')       return json(pull(sh, Number(req.since||0)));
    if(req.action==='replaceAll') return json(replaceAll(sh, req.records||[]));
    return json({ok:false, error:'unknown action: '+req.action});
  }catch(err){
    return json({ok:false, error:String(err)});
  }finally{
    lock.releaseLock();
  }
}

/* ---- DB 分頁：key | store | id | json | srv | deleted ---- */
function getDB(){
  var ss=SpreadsheetApp.getActiveSpreadsheet();
  var sh=ss.getSheetByName('DB');
  if(!sh){
    sh=ss.insertSheet('DB');
    sh.appendRow(['key','store','id','json','srv','deleted']);
  }
  return sh;
}

/* 逐筆 upsert（一般存檔用） */
function push(sh, records){
  var data=sh.getDataRange().getValues();
  var idx={};                                  // key -> row number
  for(var i=1;i<data.length;i++) idx[data[i][0]]=i+1;
  var now=Date.now();
  var inserts=[];
  records.forEach(function(r){
    var key=r.store+'|'+r.id;
    var row=[key, r.store, r.id, r.json||'', now, r.deleted?1:0];
    if(idx[key]) sh.getRange(idx[key],1,1,6).setValues([row]);
    else inserts.push(row);
  });
  if(inserts.length) sh.getRange(sh.getLastRow()+1,1,inserts.length,6).setValues(inserts);
  return {ok:true, srv:now, count:records.length};
}

/* 拉取 srv > since 的變更 */
function pull(sh, since){
  var data=sh.getDataRange().getValues();
  var out=[], maxSrv=since;
  for(var i=1;i<data.length;i++){
    var srv=Number(data[i][4]);
    if(srv>since){
      out.push({store:data[i][1], id:String(data[i][2]), json:data[i][3], srv:srv, deleted:data[i][5]==1});
      if(srv>maxSrv) maxSrv=srv;
    }
  }
  return {ok:true, records:out, srv:Date.now(), maxSrv:maxSrv};
}

/* 全量覆蓋（主帳號第一次上傳 / 重置雲端用）：清空後整批寫入 */
function replaceAll(sh, records){
  var last=sh.getLastRow();
  if(last>1) sh.getRange(2,1,last-1,6).clearContent();
  var now=Date.now();
  var rows=records.map(function(r){ return [r.store+'|'+r.id, r.store, r.id, r.json||'', now, r.deleted?1:0]; });
  if(rows.length) sh.getRange(2,1,rows.length,6).setValues(rows);
  return {ok:true, srv:now, count:rows.length};
}

function json(o){
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
