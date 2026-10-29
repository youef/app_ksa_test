const PREFERENCE_KEYS = {
  alerts: ['alerts','emergency'], urgent_alert: ['alerts','emergency'], emergency: ['alerts','emergency'],
  broadcast: ['broadcast'], event: ['events','community'], events: ['events','community'], event_reminder: ['events','community'],
  borrow: ['borrow'], review: ['reviews'], reviews: ['reviews'], answer: ['answers'], new_answer: ['answers'],
  follow: ['follows'], new_follower: ['follows'], story: ['stories'], story_reply: ['stories'], story_like: ['stories'],
};
function isDnd(profile,now = new Date()) {
  if(!profile?.dnd_enabled)return false;
  if(!profile.dnd_schedule||profile.dnd_schedule==='off')return true;
  const start=profile.dnd_schedule==='nightly'?'22:00':profile.dnd_start;
  const end=profile.dnd_schedule==='nightly'?'07:00':profile.dnd_end;
  const minutes=value=>/^\d{2}:\d{2}/.test(value||'')?Number(value.slice(0,2))*60+Number(value.slice(3,5)):null;
  const from=minutes(start),to=minutes(end);
  if(from===null||to===null)return true;
  const local=new Date(now.getTime()+3*3600000),current=local.getUTCHours()*60+local.getUTCMinutes();
  return from>to?current>=from||current<to:current>=from&&current<to;
}
function canReceivePush(profile,record,now = new Date()) {
  if(!profile||profile.is_banned||isDnd(profile,now))return false;
  const preferences=profile.notification_preferences||{};
  if(preferences.push===false || preferences.all===false)return false;
  const keys=PREFERENCE_KEYS[record.type]||['community'];
  if(keys.some(key=>preferences[key]===false))return false;
  if(record.data?.expires_at){const expiry=Date.parse(record.data.expires_at);if(!Number.isFinite(expiry)||expiry<=now.getTime())return false;}
  if(record.data?.conversation_id&&Array.isArray(profile.muted_conversations)&&profile.muted_conversations.includes(record.data.conversation_id))return false;
  return true;
}
function safeSubscription(value) {
  try {
    const sub=typeof value==='string'?JSON.parse(value):value;
    const url=new URL(sub.endpoint);
    const host=url.hostname.toLowerCase();
    const allowed=['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com','wns.windows.com','notify.windows.com'];
    if(url.protocol!=='https:'||url.username||url.password||!allowed.some(domain=>host===domain||host.endsWith('.'+domain)))return null;
    if(typeof sub.keys?.p256dh!=='string'||typeof sub.keys?.auth!=='string')return null;
    return sub;
  } catch{return null;}
}
module.exports={canReceivePush,isDnd,safeSubscription};
