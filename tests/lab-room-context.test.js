import test from 'node:test';
import assert from 'node:assert/strict';
import {LabTutorial} from '../src/game/LabTutorial.js';
function fixture(){
 const lesson=['fan-switch','E','Включить вентилятор.',false];
 const game={state:'playing',visualTime:0,playerPosition:{},heldCube:null,firstLevel:{getContextLesson:()=>lesson}};
 return {game,lesson,tutorial:new LabTutorial(game)};
}
test('context prompt follows actual put-down priority without mutating the room lesson',()=>{
 const {game,lesson,tutorial}=fixture();
 assert.equal(tutorial.update().text,'Включить вентилятор.');
 game.heldCube={};assert.match(tutorial.update().text,/Поставить друга/);
 assert.equal(lesson[2],'Включить вентилятор.');
 game.heldCube=null;assert.equal(tutorial.update().text,'Включить вентилятор.');
});
test('context prompts disappear during pause and respect the saved tutorial toggle',()=>{
 const {game,tutorial}=fixture();
 game.state='paused';assert.equal(tutorial.update(),null);
 game.state='playing';tutorial.enabled=false;assert.equal(tutorial.update(),null);
 tutorial.enabled=true;game.externalBlocked=true;assert.equal(tutorial.update(),null);
});
