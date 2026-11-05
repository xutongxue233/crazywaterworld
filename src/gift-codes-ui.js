const giftLabels={queued:'待兑换',sending:'兑换中',success:'兑换成功',used:'已兑换',rejected:'服务器拒绝',unknown:'待确认',skipped:'未发送'};
let giftPage=1,giftRows=[];
function paintGiftPage(){
  const last=Math.max(1,Math.ceil(giftRows.length/10));
  giftPage=Math.min(last,Math.max(1,giftPage));
  $('gift-prev').disabled=giftPage===1;$('gift-next').disabled=giftPage===last;
  $('gift-page').textContent=giftPage+' / '+last+' 页';
  const body=$('gift-code-history'),visible=giftRows.slice((giftPage-1)*10,giftPage*10);
  const key=JSON.stringify([current,giftPage,visible]);
  if(body.pageKey===key)return;
  body.pageKey=key;clear(body);
  for(const r of visible){
    const tr=el('tr');
    for(const value of [r.code,giftLabels[r.status]||r.status,r.detail,when(r.at)])tr.append(el('td','',value));
    body.append(tr);
  }
}
$('gift-prev').onclick=()=>{giftPage--;paintGiftPage()};
$('gift-next').onclick=()=>{giftPage++;paintGiftPage()};
let giftTimer, giftVersion=0;
function giftAccountChanged(){
  ++giftVersion;clearTimeout(giftTimer);
  $('gift-code-input').value='';
  giftRows=[];giftPage=1;paintGiftPage();
  $('gift-code-state').textContent='';
  if(!$('tab-giftcodes').classList.contains('hidden'))void refreshGiftCodes();
}
async function refreshGiftCodes(){
  const version=++giftVersion,account=current;
  clearTimeout(giftTimer);
  if(!account){$('gift-code-start').disabled=true;$('gift-code-state').textContent='请先添加账号';return;}
  try{
    const data=await call('/api/gift-codes');
    if(account!==current||version!==giftVersion)return;
    $('gift-code-start').disabled=data.running;
    $('gift-code-state').textContent=data.running?'正在逐个兑换':data.rows.length?'共 '+data.rows.length+' 条记录':'暂无兑换记录';
    giftRows=data.rows;paintGiftPage();
    if(data.running&&!$('tab-giftcodes').classList.contains('hidden'))giftTimer=setTimeout(refreshGiftCodes,750);
  }catch(error){if(account===current&&version===giftVersion){$('gift-code-start').disabled=false;$('gift-code-state').textContent=error.message;}}
}
$('gift-code-start').onclick=async()=>{
  const input=$('gift-code-input').value.trim(),account=current;
  if(!input){$('gift-code-state').textContent='请先输入礼包码';return;}
  if(!account)return;
  ++giftVersion;clearTimeout(giftTimer);$('gift-code-start').disabled=true;
  try{
    await call('/api/gift-codes/redeem',{method:'POST',body:JSON.stringify({confirm:true,codes:input})});
    if(account!==current)return;
    if($('gift-code-input').value.trim()===input)$('gift-code-input').value='';
    await refreshGiftCodes();
  }catch(error){if(account===current){$('gift-code-state').textContent=error.message;$('gift-code-start').disabled=false;}}
};
