/* Persistent NPC state and the one-time transaction, independent of dialogue playback. */
(function(W){'use strict';
const progress=()=>W.barGame.progress;
const flags=()=>progress().flags;
function sync(){const p=progress(),carry=W.lunaCampaign?.session?.carry;if(carry)Object.assign(carry,{flags:{...p.flags},inventory:{...p.inventory}});W.barGame.changed();}

function entry(){return flags().newspaper_conversation_done?'repeat':flags().newspaper_gear_received?'finish':'intro';}
function complete(m){flags().newspaper_conversation_done=true;flags().newspaper_completed_flow=m.config.flow;sync();m.updateNear();}

function grantGear(m){
 if(flags().newspaper_gear_received)return false;
 const p=progress();p.inventory||={};p.inventory.gear_part=(Number(p.inventory.gear_part)||0)+1;
 flags().newspaper_gear_received=true;sync();
 W.outsidePlaytest?.notifyItem?.(m,'gear_part');
 W.barGame.log('newspaper_gear_received',{day:m.config.day,flow:m.config.flow,item:'gear_part'});return true;
}
function available(flow){return !flags().newspaper_conversation_done||flags().newspaper_completed_flow===flow;}
W.LunaNewspaperProgress={entry,complete,grantGear,available};
})(window);
