const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./index-aj_37htV.js","./index-ZipyTDGR.css"])))=>i.map(i=>d[i]);
import { a as IconSize, d as init_dist_es2015, m as __esmMin, n as init_preload_helper, o as init_iconTypes, p as pascalCase, t as __vitePreload } from "./index-aj_37htV.js";
//#region node_modules/@blueprintjs/icons/lib/esm/paths-loaders/splitPathsBySizeLoader.js
var splitPathsBySizeLoader;
//#endregion
__esmMin((() => {
	init_dist_es2015();
	init_iconTypes();
	init_preload_helper();
	splitPathsBySizeLoader = async (name, size) => {
		const key = pascalCase(name);
		let pathsRecord;
		if (size === IconSize.STANDARD) pathsRecord = await __vitePreload(() => import(
			/* webpackChunkName: "blueprint-icons-16px-paths" */
			"./index-aj_37htV.js"
).then((n) => (n.l(), n.u)), __vite__mapDeps([0,1]), import.meta.url);
		else pathsRecord = await __vitePreload(() => import(
			/* webpackChunkName: "blueprint-icons-20px-paths" */
			"./index-aj_37htV.js"
).then((n) => (n.s(), n.c)), __vite__mapDeps([0,1]), import.meta.url);
		return pathsRecord[key];
	};
}))();
export { splitPathsBySizeLoader };
