/* Execute the choice paths compiled from StreetChoices.result_steps and scene gotos. */
(function(W){'use strict';
const data=()=>W.LUNA_DATA,plan=()=>data().newspaperRoutes;
const rows=key=>data().sharedStory['newspaper/'+key];
const lines=keys=>keys.flatMap(key=>data().sharedStory[key]);
function choiceView(){return {label:'대답하기',options:data().outsideChoices.filter(c=>c.parent_id===plan().parent&&Object.hasOwn(plan().routes,c.id)).map(c=>({id:c.id,label:c['text.ko']}))};}
function play(m,dialogue){return m.story.beginRows('street-newspaper',m.story.speech.target,dialogue,false,()=>W.LunaNewspaperProgress.complete(m));}
function choose(m,id){const keys=plan().routes[id];return Array.isArray(keys)&&play(m,lines(keys));}
function branch(m,custom){return play(m,[...custom,...lines(plan().join)]);}
W.LunaNewspaperDialogue={rows,choiceView,choose,branch};
})(window);
