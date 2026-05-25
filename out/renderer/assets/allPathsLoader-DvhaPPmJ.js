const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./index-aj_37htV.js","./index-ZipyTDGR.css"])))=>i.map(i=>d[i]);
import { m as __esmMin, n as init_preload_helper, t as __vitePreload } from "./index-aj_37htV.js";
//#region node_modules/@blueprintjs/icons/lib/esm/paths-loaders/allPathsLoader.js
var allPathsLoader;
//#endregion
__esmMin((() => {
	init_preload_helper();
	allPathsLoader = async (name, size) => {
		const { getIconPaths } = await __vitePreload(async () => {
			const { getIconPaths } = await import(
				/* webpackChunkName: "blueprint-icons-all-paths" */
				"./index-aj_37htV.js"
).then((n) => (n.i(), n.r));
			return { getIconPaths };
		}, __vite__mapDeps([0,1]), import.meta.url);
		return getIconPaths(name, size);
	};
}))();
export { allPathsLoader };
