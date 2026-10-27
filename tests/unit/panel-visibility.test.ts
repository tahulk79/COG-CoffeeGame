import { expect, it } from 'vitest';
import { setShown } from '../../src/ui/components/panelVisibility';
function container(parent:any=null):any {
  const c:any={visible:true,input:{enabled:true},parentContainer:parent,list:[],setVisible(on:boolean){this.visible=on;return this;}};
  parent?.list.push(c);return c;
}
it('hidden controls cannot swallow clicks and only visible children reactivate',()=>{
  const panel=container(),visible=container(panel),hidden=container(panel);
  setShown(hidden,false);setShown(panel,false);
  expect(panel.input.enabled).toBe(false);expect(visible.input.enabled).toBe(false);expect(hidden.input.enabled).toBe(false);
  setShown(panel,true);
  expect(visible.input.enabled).toBe(true);expect(hidden.input.enabled).toBe(false);
  setShown(hidden,true);expect(hidden.input.enabled).toBe(true);
});
it('handles controls added after a modal was initially hidden',()=>{
  const panel=container();setShown(panel,false);const added=container(panel);
  setShown(panel,false,true);expect(added.input.enabled).toBe(false);
  setShown(panel,true);expect(added.input.enabled).toBe(true);
});
