import {chromium} from 'playwright';
import fs from 'node:fs';
const out='docs/design-arena/2026-10-11';
const browser=await chromium.launch({headless:true});
const result=[];
for(const [variant,viewport] of [['desktop',{width:1280,height:900}],['mobile',{width:390,height:844}]]){
 const context=await browser.newContext({viewport});
 const page=await context.newPage();
 await page.route('**/api/**',r=>r.abort());
 await page.addInitScript(()=>{window.__E2E__=true;sessionStorage.setItem('__E2E__','true');sessionStorage.setItem('daily_greeting_seen_session','true');localStorage.setItem('daily_greeting_dismissed_day',new Date().toDateString());localStorage.setItem('hide_onboarding_guide','true');localStorage.setItem('pwa_prompt_dismissed','true');});
 try {
 await page.goto('http://127.0.0.1:5182');await page.waitForFunction(()=>window.useAppStore?.getState().hasHydrated===true);
 await page.evaluate(()=>{const st=window.useAppStore.getState();st.setToken('local_offline_token','local_guest_independent');st.addList({id:'independent_casa',name:'Casa revisión',color:'#34c759',listType:'routines'});st.addTask({id:'independent_t1',title:'Revisar filtro',categoryId:'independent_casa',status:'pending',duration:25,dueDate:new Date(Date.now()-86400000).toISOString(),timeOfDay:'morning',created_at:new Date().toISOString()});window.dispatchEvent(new CustomEvent('select-view',{detail:'list_independent_casa'}));});
 await page.waitForTimeout(500);await page.screenshot({path:out+'/independent-'+variant+'-list.png'});
 result.push({variant,surface:'list',h1:await page.locator('h1').allTextContents(),details:await page.locator('summary').allTextContents(),horizontalOverflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});
 const task=page.locator('[data-task-id="independent_t1"]').first();await task.locator('summary').click();await page.screenshot({path:out+'/independent-'+variant+'-task-details.png'});await task.getByRole('button',{name:'25 min',exact:true}).click();await page.waitForTimeout(300);
 if(await page.getByRole('dialog').count()){await page.screenshot({path:out+'/independent-'+variant+'-task.png'});result.push({variant,surface:'task',dialog:await page.getByRole('dialog').innerText()});await page.keyboard.press('Escape');}
 await page.evaluate(()=>window.dispatchEvent(new Event('open-manage-lists-modal')));await page.getByRole('dialog',{name:'Gestionar listas'}).waitFor();
 await page.screenshot({path:out+'/independent-'+variant+'-manage.png'});result.push({variant,surface:'manage',text:await page.getByRole('dialog',{name:'Gestionar listas'}).innerText()});
 const sheet=page.getByRole('dialog',{name:'Gestionar listas'});const options=sheet.locator('summary[aria-label="Opciones de Casa revisión"]');if(await options.count())await options.click();
 const edit=sheet.getByRole('button',{name:'Editar Casa revisión'});if(await edit.count()){await edit.click();await page.waitForTimeout(300);await page.screenshot({path:out+'/independent-'+variant+'-config.png'});result.push({variant,surface:'config',text:await page.getByRole('dialog').last().innerText()});}
 }catch(e){result.push({variant,error:String(e)});}
 await context.close();
}await browser.close();fs.writeFileSync(out+'/independent-observations.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));

