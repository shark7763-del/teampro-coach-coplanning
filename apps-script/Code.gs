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

/* ---- DB 分頁：key | store | id | json | srv | deleted | rev | updated_by | updated_at ---- */
function getDB(){
  var ss=SpreadsheetApp.getActiveSpreadsheet();
  var sh=ss.getSheetByName('DB');
  if(!sh){
    sh=ss.insertSheet('DB');
    sh.appendRow(['key','store','id','json','srv','deleted','rev','updated_by','updated_at']);
  }else{
    ensureColumns(sh);
  }
  return sh;
}

function ensureColumns(sh){
  var head=sh.getRange(1,1,1,Math.max(sh.getLastColumn(),9)).getValues()[0];
  var want=['key','store','id','json','srv','deleted','rev','updated_by','updated_at'];
  var changed=false;
  for(var i=0;i<want.length;i++){if(head[i]!==want[i]){head[i]=want[i];changed=true;}}
  if(changed)sh.getRange(1,1,1,want.length).setValues([head.slice(0,want.length)]);
  var req=SpreadsheetApp.getActiveSpreadsheet().getSheetByName('REQUEST_LOG');
  if(!req){
    req=SpreadsheetApp.getActiveSpreadsheet().insertSheet('REQUEST_LOG');
    req.appendRow(['request_id','key','srv','status']);
  }
}

function requestLog(){
  var ss=SpreadsheetApp.getActiveSpreadsheet();
  var sh=ss.getSheetByName('REQUEST_LOG');
  if(!sh){sh=ss.insertSheet('REQUEST_LOG');sh.appendRow(['request_id','key','srv','status']);}
  return sh;
}

function readRequestIds(){
  var sh=requestLog(),data=sh.getDataRange().getValues(),out={};
  for(var i=1;i<data.length;i++)out[String(data[i][0])]={key:data[i][1],srv:data[i][2],status:data[i][3]};
  return out;
}

function parseJsonSafe(s){
  try{return s?JSON.parse(s):null;}catch(e){return null;}
}

/* 逐筆 upsert（一般存檔用，支援 request_id 去重與 base_rev 衝突偵測） */
function push(sh, records){
  var data=sh.getDataRange().getValues();
  var idx={};                                  // key -> row number
  for(var i=1;i<data.length;i++) idx[data[i][0]]=i+1;
  var done=readRequestIds();
  var now=Date.now();
  var inserts=[],results=[],logRows=[];
  records.forEach(function(r){
    var requestId=String(r.request_id||'');
    var key=r.store+'|'+r.id;
    if(requestId && done[requestId]){
      results.push({ok:true,duplicate:true,request_id:requestId,key:key,srv:done[requestId].srv});
      return;
    }
    var current=null,currentRev=0,rowNo=idx[key]||0;
    if(rowNo){
      var rowData=data[rowNo-1];
      current=parseJsonSafe(rowData[3]);
      currentRev=Number(rowData[6]||((current&&current._rev)||0)||0);
    }
    var baseRev=Number(r.base_rev||0);
    if(rowNo && !r.deleted && currentRev!==baseRev){
      results.push({ok:false,status:409,conflict:true,request_id:requestId,key:key,remote:current,remote_rev:currentRev,error:'conflict'});
      return;
    }
    if(rowNo && r.deleted && currentRev!==baseRev){
      results.push({ok:false,status:409,conflict:true,request_id:requestId,key:key,remote:current,remote_rev:currentRev,error:'conflict'});
      return;
    }
    var obj=parseJsonSafe(r.json);
    var rev=r.deleted?currentRev:Number((obj&&obj._rev)||currentRev+1||1);
    var updatedBy=obj&&obj.updated_by?JSON.stringify(obj.updated_by):JSON.stringify(r.updated_by||null);
    var updatedAt=(obj&&obj.updated_at)||r.client_updated_at||now;
    var row=[key, r.store, r.id, r.json||'', now, r.deleted?1:0, rev, updatedBy, updatedAt];
    if(rowNo) sh.getRange(rowNo,1,1,9).setValues([row]);
    else inserts.push(row);
    if(requestId)logRows.push([requestId,key,now,'ok']);
    results.push({ok:true,request_id:requestId,key:key,srv:now,rev:rev});
  });
  if(inserts.length) sh.getRange(sh.getLastRow()+1,1,inserts.length,9).setValues(inserts);
  if(logRows.length){var log=requestLog();log.getRange(log.getLastRow()+1,1,logRows.length,4).setValues(logRows);}
  return {ok:true, srv:now, count:records.length, results:results};
}

/* 拉取 srv > since 的變更 */
function pull(sh, since){
  var data=sh.getDataRange().getValues();
  var out=[], maxSrv=since;
  for(var i=1;i<data.length;i++){
    var srv=Number(data[i][4]);
    if(srv>since){
      out.push({store:data[i][1], id:String(data[i][2]), json:data[i][3], srv:srv, deleted:data[i][5]==1, rev:Number(data[i][6]||0), updated_by:data[i][7], updated_at:data[i][8]});
      if(srv>maxSrv) maxSrv=srv;
    }
  }
  return {ok:true, records:out, srv:Date.now(), maxSrv:maxSrv};
}

/* 全量覆蓋（主帳號第一次上傳 / 重置雲端用）：清空後整批寫入 */
function replaceAll(sh, records){
  var last=sh.getLastRow();
  if(last>1) sh.getRange(2,1,last-1,9).clearContent();
  var now=Date.now();
  var rows=records.map(function(r){
    var obj=parseJsonSafe(r.json),rev=Number((obj&&obj._rev)||0),updatedBy=obj&&obj.updated_by?JSON.stringify(obj.updated_by):'',updatedAt=(obj&&obj.updated_at)||now;
    return [r.store+'|'+r.id, r.store, r.id, r.json||'', now, r.deleted?1:0, rev, updatedBy, updatedAt];
  });
  if(rows.length) sh.getRange(2,1,rows.length,9).setValues(rows);
  return {ok:true, srv:now, count:rows.length};
}

function json(o){
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
