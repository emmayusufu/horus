let electron = require("electron");
//#region src/preload/index.ts
electron.contextBridge.exposeInMainWorld("horus", {
	listContexts: () => electron.ipcRenderer.invoke("k8s:list-contexts"),
	connect: (context) => electron.ipcRenderer.invoke("k8s:connect", context),
	disconnect: (context) => electron.ipcRenderer.invoke("k8s:disconnect", context),
	onResourceUpdate: (callback) => {
		const handler = (_event, update) => callback(update);
		electron.ipcRenderer.on("k8s:resource-update", handler);
		return () => electron.ipcRenderer.removeListener("k8s:resource-update", handler);
	},
	getLogs: (cluster, namespace, pod, timestamps) => electron.ipcRenderer.invoke("k8s:get-logs", cluster, namespace, pod, timestamps),
	getEvents: (cluster, namespace, name) => electron.ipcRenderer.invoke("k8s:get-events", cluster, namespace, name),
	getRelated: (cluster, namespace, name, kind) => electron.ipcRenderer.invoke("k8s:get-related", cluster, namespace, name, kind),
	getHelmInfo: (cluster, namespace, labels) => electron.ipcRenderer.invoke("k8s:helm-info", cluster, namespace, labels),
	getResourceDetail: (cluster, namespace, name, kind) => electron.ipcRenderer.invoke("k8s:get-resource-detail", cluster, namespace, name, kind),
	exportSnapshot: (detail) => electron.ipcRenderer.invoke("k8s:export-snapshot", detail),
	getPodYaml: (cluster, namespace, name) => electron.ipcRenderer.invoke("k8s:get-pod-yaml", cluster, namespace, name),
	getNamespaceEvents: (cluster, namespace) => electron.ipcRenderer.invoke("k8s:get-namespace-events", cluster, namespace),
	startLogStream: (cluster, namespace, pod, container, timestamps) => electron.ipcRenderer.invoke("k8s:start-log-stream", cluster, namespace, pod, container, timestamps),
	stopLogStream: (streamId) => electron.ipcRenderer.invoke("k8s:stop-log-stream", streamId),
	getRollout: (cluster, namespace, name) => electron.ipcRenderer.invoke("k8s:get-rollout", cluster, namespace, name),
	getNodes: (cluster) => electron.ipcRenderer.invoke("k8s:get-nodes", cluster),
	getCronJobRuns: (cluster, namespace, name) => electron.ipcRenderer.invoke("k8s:get-cronjob-runs", cluster, namespace, name),
	getResourceYaml: (cluster, namespace, name, kind) => electron.ipcRenderer.invoke("k8s:get-resource-yaml", cluster, namespace, name, kind),
	getTrafficPath: (cluster, namespace, serviceName) => electron.ipcRenderer.invoke("k8s:get-traffic-path", cluster, namespace, serviceName),
	getHPAs: (cluster, namespace) => electron.ipcRenderer.invoke("k8s:get-hpas", cluster, namespace),
	getPVCs: (cluster, namespace) => electron.ipcRenderer.invoke("k8s:get-pvcs", cluster, namespace),
	getResourceQuotas: (cluster, namespace) => electron.ipcRenderer.invoke("k8s:get-resource-quotas", cluster, namespace),
	getConfigChecks: (cluster, namespace) => electron.ipcRenderer.invoke("k8s:get-config-checks", cluster, namespace),
	getRBAC: (cluster, namespace) => electron.ipcRenderer.invoke("k8s:get-rbac", cluster, namespace),
	getNetworkPolicies: (cluster, namespace) => electron.ipcRenderer.invoke("k8s:get-network-policies", cluster, namespace),
	getSecurityScan: (cluster, namespace) => electron.ipcRenderer.invoke("k8s:get-security-scan", cluster, namespace),
	getSecretUsage: (cluster, namespace) => electron.ipcRenderer.invoke("k8s:get-secret-usage", cluster, namespace),
	deletePod: (cluster, namespace, name) => electron.ipcRenderer.invoke("k8s:delete-pod", cluster, namespace, name),
	scaleDeploy: (cluster, namespace, name, replicas) => electron.ipcRenderer.invoke("k8s:scale-deploy", cluster, namespace, name, replicas),
	startPortForward: (cluster, namespace, pod, localPort, remotePort) => electron.ipcRenderer.invoke("k8s:start-port-forward", cluster, namespace, pod, localPort, remotePort),
	stopPortForward: (id) => electron.ipcRenderer.invoke("k8s:stop-port-forward", id),
	getGlobalEvents: (cluster, query) => electron.ipcRenderer.invoke("k8s:get-global-events", cluster, query),
	analyzeRootCause: (cluster, namespace, name, kind) => electron.ipcRenderer.invoke("k8s:analyze-root-cause", cluster, namespace, name, kind),
	getTopology: (cluster, namespace) => electron.ipcRenderer.invoke("k8s:get-topology", cluster, namespace),
	getCostEstimates: (cluster) => electron.ipcRenderer.invoke("k8s:get-cost-estimates", cluster),
	getHelmReleases: (cluster) => electron.ipcRenderer.invoke("k8s:get-helm-releases", cluster),
	getSizingRecs: (cluster, namespace) => electron.ipcRenderer.invoke("k8s:get-sizing-recs", cluster, namespace),
	onLogChunk: (callback) => {
		const handler = (_event, chunk) => callback(chunk);
		electron.ipcRenderer.on("k8s:log-chunk", handler);
		return () => electron.ipcRenderer.removeListener("k8s:log-chunk", handler);
	}
});
//#endregion
