//#region \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
//#endregion
let electron = require("electron");
let path = require("path");
let _kubernetes_client_node = require("@kubernetes/client-node");
_kubernetes_client_node = __toESM(_kubernetes_client_node);
let stream = require("stream");
let fs = require("fs");
//#region node_modules/@electron-toolkit/utils/dist/index.mjs
var is = { dev: !electron.app.isPackaged };
process.platform, process.platform, process.platform;
//#endregion
//#region src/main/k8s/client.ts
var clients = /* @__PURE__ */ new Map();
function loadContexts() {
	const kc = new _kubernetes_client_node.KubeConfig();
	kc.loadFromDefault();
	const seen = /* @__PURE__ */ new Map();
	const unique = [];
	for (const ctx of kc.contexts) {
		const server = kc.clusters.find((c) => c.name === ctx.cluster)?.server ?? ctx.name;
		if (!seen.has(server)) {
			seen.set(server, ctx.name);
			unique.push(ctx.name);
		}
	}
	return unique;
}
function connectCluster(context) {
	if (clients.has(context)) return clients.get(context);
	const kc = new _kubernetes_client_node.KubeConfig();
	kc.loadFromDefault();
	kc.setCurrentContext(context);
	const client = {
		context,
		coreApi: kc.makeApiClient(_kubernetes_client_node.CoreV1Api),
		appsApi: kc.makeApiClient(_kubernetes_client_node.AppsV1Api),
		batchApi: kc.makeApiClient(_kubernetes_client_node.BatchV1Api),
		networkApi: kc.makeApiClient(_kubernetes_client_node.NetworkingV1Api),
		metricsAvailable: false
	};
	clients.set(context, client);
	return client;
}
function disconnectCluster(context) {
	clients.delete(context);
}
function getClient(context) {
	return clients.get(context);
}
function getKubeConfig(context) {
	const kc = new _kubernetes_client_node.KubeConfig();
	kc.loadFromDefault();
	kc.setCurrentContext(context);
	return kc;
}
//#endregion
//#region src/main/k8s/health.ts
var CRITICAL_STATUSES = new Set([
	"CrashLoopBackOff",
	"OOMKilled",
	"ImagePullBackOff",
	"Evicted",
	"Error",
	"CreateContainerConfigError",
	"InvalidImageName",
	"ErrImagePull"
]);
var TERMINAL_HEALTHY = new Set(["Complete", "Succeeded"]);
function scoreHealth(kind, status, ready, restarts) {
	if (CRITICAL_STATUSES.has(status)) return "critical";
	if (kind === "Job" && status === "Failed") return "critical";
	if (TERMINAL_HEALTHY.has(status)) return "healthy";
	if (status === "Running" && ready && restarts < 5) return "healthy";
	if (status === "Running" && ready && restarts >= 5) return "warning";
	if (status === "Running" && !ready) return "warning";
	if (status === "Pending") return "warning";
	return "unknown";
}
//#endregion
//#region src/main/k8s/watcher.ts
var activeWatches = /* @__PURE__ */ new Map();
function podToResource(pod, cluster) {
	const status = pod.status?.containerStatuses?.[0]?.state?.waiting?.reason ?? pod.status?.phase ?? "Unknown";
	const ready = pod.status?.conditions?.some((c) => c.type === "Ready" && c.status === "True") ?? false;
	const restarts = pod.status?.containerStatuses?.reduce((sum, c) => sum + (c.restartCount ?? 0), 0) ?? 0;
	const owner = pod.metadata?.ownerReferences?.[0];
	return {
		uid: pod.metadata?.uid ?? "",
		name: pod.metadata?.name ?? "",
		namespace: pod.metadata?.namespace ?? "",
		kind: "Pod",
		cluster,
		status,
		health: scoreHealth("Pod", status, ready, restarts),
		restarts,
		age: pod.metadata?.creationTimestamp?.toISOString() ?? "",
		node: pod.spec?.nodeName ?? "",
		labels: pod.metadata?.labels ?? {},
		ownerKind: owner?.kind,
		ownerName: owner?.name
	};
}
function deploymentToResource(dep, cluster) {
	const available = dep.status?.conditions?.find((c) => c.type === "Available");
	const readyReplicas = dep.status?.readyReplicas ?? 0;
	const desiredReplicas = dep.spec?.replicas ?? 0;
	const status = available?.status === "True" ? `${readyReplicas}/${desiredReplicas} ready` : "Progressing";
	const ready = available?.status === "True";
	return {
		uid: dep.metadata?.uid ?? "",
		name: dep.metadata?.name ?? "",
		namespace: dep.metadata?.namespace ?? "",
		kind: "Deployment",
		cluster,
		status,
		health: ready ? "healthy" : "warning",
		restarts: 0,
		age: dep.metadata?.creationTimestamp?.toISOString() ?? "",
		node: "-",
		labels: dep.metadata?.labels ?? {},
		ownerKind: void 0,
		ownerName: void 0
	};
}
function jobToResource(job, cluster) {
	const failed = job.status?.conditions?.find((c) => c.type === "Failed" && c.status === "True");
	const complete = job.status?.conditions?.find((c) => c.type === "Complete" && c.status === "True");
	const succeeded = job.status?.succeeded ?? 0;
	const desired = job.spec?.completions ?? 1;
	const status = failed ? "Failed" : complete ? `Complete (${succeeded}/${desired})` : "Running";
	return {
		uid: job.metadata?.uid ?? "",
		name: job.metadata?.name ?? "",
		namespace: job.metadata?.namespace ?? "",
		kind: "Job",
		cluster,
		status,
		health: scoreHealth("Job", failed ? "Failed" : complete ? "Complete" : "Running", false, 0),
		restarts: job.status?.failed ?? 0,
		age: job.metadata?.creationTimestamp?.toISOString() ?? "",
		node: "-",
		labels: job.metadata?.labels ?? {},
		ownerKind: void 0,
		ownerName: void 0
	};
}
async function startWatching(context, onUpdate) {
	const kc = getKubeConfig(context);
	const coreApi = kc.makeApiClient(_kubernetes_client_node.CoreV1Api);
	const appsApi = kc.makeApiClient(_kubernetes_client_node.AppsV1Api);
	const batchApi = kc.makeApiClient(_kubernetes_client_node.BatchV1Api);
	const resources = /* @__PURE__ */ new Map();
	const emitUpdate = () => {
		onUpdate([...resources.values()]);
	};
	try {
		const [pods, deployments, jobs] = await Promise.all([
			coreApi.listPodForAllNamespaces(),
			appsApi.listDeploymentForAllNamespaces(),
			batchApi.listJobForAllNamespaces()
		]);
		for (const pod of pods.items) {
			const r = podToResource(pod, context);
			resources.set(r.uid, r);
		}
		for (const dep of deployments.items) {
			const r = deploymentToResource(dep, context);
			resources.set(r.uid, r);
		}
		for (const job of jobs.items) {
			const r = jobToResource(job, context);
			resources.set(r.uid, r);
		}
		emitUpdate();
	} catch (err) {
		console.error(`Failed initial list for ${context}:`, err);
	}
	const watch = new _kubernetes_client_node.Watch(kc);
	const watches = [];
	const watchPath = async (path, toResource) => {
		const abort = new AbortController();
		watches.push({ abort });
		let retryDelay = 1e3;
		const startWatch = async () => {
			try {
				await watch.watch(path, {}, (type, obj) => {
					const r = toResource(obj);
					if (type === "DELETED") resources.delete(r.uid);
					else resources.set(r.uid, r);
					emitUpdate();
				}, () => {
					if (abort.signal.aborted) return;
					retryDelay = Math.min(retryDelay * 2, 3e4);
					setTimeout(startWatch, retryDelay);
				});
				retryDelay = 1e3;
			} catch {
				if (abort.signal.aborted) return;
				retryDelay = Math.min(retryDelay * 2, 3e4);
				setTimeout(startWatch, retryDelay);
			}
		};
		startWatch();
	};
	watchPath("/api/v1/pods", (obj) => podToResource(obj, context));
	watchPath("/apis/apps/v1/deployments", (obj) => deploymentToResource(obj, context));
	watchPath("/apis/batch/v1/jobs", (obj) => jobToResource(obj, context));
	activeWatches.set(context, watches);
}
function stopWatching(context) {
	const watches = activeWatches.get(context);
	if (watches) {
		for (const w of watches) w.abort.abort();
		activeWatches.delete(context);
	}
}
//#endregion
//#region src/main/k8s/cache.ts
var HEALTH_ORDER = {
	critical: 0,
	warning: 1,
	unknown: 2,
	healthy: 3
};
var ResourceCache = class {
	store = /* @__PURE__ */ new Map();
	set(cluster, resources) {
		this.store.set(cluster, resources);
	}
	getAll(cluster) {
		return this.store.get(cluster) ?? [];
	}
	getByNamespace(cluster, namespace) {
		return this.getAll(cluster).filter((r) => r.namespace === namespace);
	}
	getUnhealthy(cluster) {
		return this.getAll(cluster).filter((r) => r.health !== "healthy").sort((a, b) => HEALTH_ORDER[a.health] - HEALTH_ORDER[b.health]);
	}
	getAllUnhealthy() {
		const result = [];
		for (const resources of this.store.values()) result.push(...resources.filter((r) => r.health !== "healthy"));
		return result.sort((a, b) => HEALTH_ORDER[a.health] - HEALTH_ORDER[b.health]);
	}
	search(query) {
		const lower = query.toLowerCase();
		const result = [];
		for (const resources of this.store.values()) result.push(...resources.filter((r) => r.name.toLowerCase().includes(lower)));
		return result;
	}
	clear(cluster) {
		this.store.delete(cluster);
	}
	clusters() {
		return [...this.store.keys()];
	}
};
//#endregion
//#region src/main/k8s/logs.ts
async function fetchLogs(context, namespace, podName, timestamps = false) {
	const client = getClient(context);
	if (!client) throw new Error(`Not connected to ${context}`);
	const pod = await client.coreApi.readNamespacedPod({
		name: podName,
		namespace
	});
	const initContainers = pod.spec?.initContainers ?? [];
	const containers = pod.spec?.containers ?? [];
	const results = [];
	for (const container of initContainers) {
		const logs = await fetchContainerLogs(client, namespace, podName, container.name, timestamps);
		results.push({
			...logs,
			isInit: true
		});
	}
	for (const container of containers) {
		const logs = await fetchContainerLogs(client, namespace, podName, container.name, timestamps);
		results.push({
			...logs,
			isInit: false
		});
	}
	return results;
}
async function fetchContainerLogs(client, namespace, podName, containerName, timestamps) {
	const logOpts = {
		name: podName,
		namespace,
		container: containerName,
		tailLines: 200,
		timestamps
	};
	return {
		containerName,
		current: await client.coreApi.readNamespacedPodLog(logOpts).catch(() => "(no logs available)"),
		previous: await client.coreApi.readNamespacedPodLog({
			...logOpts,
			previous: true
		}).catch(() => void 0)
	};
}
var activeStreams = /* @__PURE__ */ new Map();
var streamCounter = 0;
function startLogStream(context, namespace, podName, containerName, timestamps, onChunk) {
	const streamId = `stream-${++streamCounter}`;
	const kc = getKubeConfig(context);
	const log = new _kubernetes_client_node.Log(kc);
	const passthrough = new stream.PassThrough();
	activeStreams.set(streamId, passthrough);
	passthrough.on("data", (chunk) => {
		onChunk(chunk.toString("utf-8"));
	});
	passthrough.on("error", () => {
		activeStreams.delete(streamId);
	});
	log.log(namespace, podName, containerName, passthrough, {
		follow: true,
		tailLines: 200,
		timestamps
	}).catch(() => {
		activeStreams.delete(streamId);
	});
	return streamId;
}
function stopLogStream(streamId) {
	const stream$1 = activeStreams.get(streamId);
	if (stream$1) {
		stream$1.destroy();
		activeStreams.delete(streamId);
	}
}
function stopAllLogStreams() {
	for (const [, stream$2] of activeStreams) stream$2.destroy();
	activeStreams.clear();
}
//#endregion
//#region src/main/k8s/related.ts
async function fetchRelated(context, namespace, name, kind) {
	const client = getClient(context);
	if (!client) throw new Error(`Not connected to ${context}`);
	const related = [];
	if (kind === "Pod") {
		const pod = await client.coreApi.readNamespacedPod({
			name,
			namespace
		});
		const podLabels = pod.metadata?.labels ?? {};
		try {
			const services = await client.coreApi.listNamespacedService({ namespace });
			for (const svc of services.items) {
				const selector = svc.spec?.selector ?? {};
				if (Object.entries(selector).every(([k, v]) => podLabels[k] === v)) {
					const endpoints = await client.coreApi.readNamespacedEndpoints({
						name: svc.metadata.name,
						namespace
					});
					const readyCount = endpoints.subsets?.reduce((sum, s) => sum + (s.addresses?.length ?? 0), 0) ?? 0;
					const totalCount = readyCount + (endpoints.subsets?.reduce((sum, s) => sum + (s.notReadyAddresses?.length ?? 0), 0) ?? 0);
					related.push({
						kind: "Service",
						name: svc.metadata.name,
						detail: `${readyCount}/${totalCount} endpoints ready`
					});
				}
			}
		} catch {}
		try {
			const ingresses = await client.networkApi.listNamespacedIngress({ namespace });
			for (const ing of ingresses.items) {
				const rules = ing.spec?.rules ?? [];
				for (const rule of rules) {
					const paths = rule.http?.paths ?? [];
					for (const path of paths) {
						const backend = path.backend?.service?.name;
						if (backend && related.some((r) => r.kind === "Service" && r.name === backend)) related.push({
							kind: "Ingress",
							name: ing.metadata.name,
							detail: `${rule.host ?? "*"}${path.path ?? "/"} -> ${backend}`
						});
					}
				}
			}
		} catch {}
		try {
			const configMaps = await client.coreApi.listNamespacedConfigMap({ namespace });
			const podCmRefs = /* @__PURE__ */ new Set();
			for (const env of pod.spec?.containers?.flatMap((c) => c.envFrom ?? []) ?? []) if (env.configMapRef?.name) podCmRefs.add(env.configMapRef.name);
			for (const env of pod.spec?.containers?.flatMap((c) => c.env ?? []) ?? []) if (env.valueFrom?.configMapKeyRef?.name) podCmRefs.add(env.valueFrom.configMapKeyRef.name);
			for (const vol of pod.spec?.volumes ?? []) if (vol.configMap?.name) podCmRefs.add(vol.configMap.name);
			for (const cm of configMaps.items) if (podCmRefs.has(cm.metadata.name)) {
				const keys = Object.keys(cm.data ?? {});
				const preview = keys.slice(0, 3).join(", ");
				related.push({
					kind: "ConfigMap",
					name: cm.metadata.name,
					detail: preview + (keys.length > 3 ? ` +${keys.length - 3} more` : "")
				});
			}
		} catch {}
		try {
			const secrets = await client.coreApi.listNamespacedSecret({ namespace });
			const podSecretRefs = /* @__PURE__ */ new Set();
			for (const env of pod.spec?.containers?.flatMap((c) => c.envFrom ?? []) ?? []) if (env.secretRef?.name) podSecretRefs.add(env.secretRef.name);
			for (const env of pod.spec?.containers?.flatMap((c) => c.env ?? []) ?? []) if (env.valueFrom?.secretKeyRef?.name) podSecretRefs.add(env.valueFrom.secretKeyRef.name);
			for (const vol of pod.spec?.volumes ?? []) if (vol.secret?.secretName) podSecretRefs.add(vol.secret.secretName);
			for (const secret of secrets.items) if (podSecretRefs.has(secret.metadata.name)) {
				const keyCount = Object.keys(secret.data ?? {}).length;
				related.push({
					kind: "Secret",
					name: secret.metadata.name,
					detail: `${keyCount} keys, values hidden`
				});
			}
		} catch {}
	}
	return related;
}
//#endregion
//#region src/main/k8s/metrics.ts
async function checkMetricsAvailable(context) {
	try {
		const kc = getKubeConfig(context);
		await new _kubernetes_client_node.Metrics(kc).getNodeMetrics();
		const client = getClient(context);
		if (client) client.metricsAvailable = true;
		return true;
	} catch {
		return false;
	}
}
async function fetchPodMetrics(context, namespace, podName) {
	try {
		const kc = getKubeConfig(context);
		const podMetric = (await new _kubernetes_client_node.Metrics(kc).getPodMetrics(namespace)).items.find((m) => m.metadata?.name === podName);
		if (!podMetric) return null;
		const containers = podMetric.containers ?? [];
		let totalCpu = 0;
		let totalMem = 0;
		for (const c of containers) {
			const cpu = c.usage?.cpu ?? "0";
			const mem = c.usage?.memory ?? "0";
			totalCpu += parseCpuToMillicores(cpu);
			totalMem += parseMemToMi(mem);
		}
		return {
			cpuActual: `${totalCpu}m`,
			memActual: `${totalMem}Mi`
		};
	} catch {
		return null;
	}
}
function parseCpuToMillicores(cpu) {
	if (cpu.endsWith("n")) return Math.round(parseInt(cpu) / 1e6);
	if (cpu.endsWith("m")) return parseInt(cpu);
	return Math.round(parseFloat(cpu) * 1e3);
}
function parseMemToMi(mem) {
	if (mem.endsWith("Ki")) return Math.round(parseInt(mem) / 1024);
	if (mem.endsWith("Mi")) return parseInt(mem);
	if (mem.endsWith("Gi")) return parseInt(mem) * 1024;
	return Math.round(parseInt(mem) / (1024 * 1024));
}
//#endregion
//#region src/shared/helm.ts
function parseHelmLabels(labels) {
	const managedBy = labels["app.kubernetes.io/managed-by"];
	if (managedBy !== "Helm") return null;
	const chartLabel = labels["helm.sh/chart"] ?? "";
	const lastDash = chartLabel.lastIndexOf("-");
	const hasVersion = lastDash > 0 && /^\d/.test(chartLabel.slice(lastDash + 1));
	return {
		chart: hasVersion ? chartLabel.slice(0, lastDash) : chartLabel || "unknown",
		version: hasVersion ? chartLabel.slice(lastDash + 1) : "unknown",
		revision: 0,
		managedBy
	};
}
//#endregion
//#region src/main/k8s/snapshot.ts
function generateSnapshot(detail) {
	const { resource, events, logs, resources, related, helm } = detail;
	const now = (/* @__PURE__ */ new Date()).toISOString().replace("T", " ").replace(/\.\d+Z/, " UTC");
	const lines = [
		"# Horus Debug Snapshot",
		`**Resource:** ${resource.name}`,
		`**Cluster:** ${resource.cluster}`,
		`**Namespace:** ${resource.namespace}`,
		`**Captured:** ${now}`,
		"",
		"## Status",
		`${resource.status} | ${resource.restarts} restarts | Node: ${resource.node}`,
		""
	];
	if (resource.ownerKind && resource.ownerName) {
		lines.push(`**Owner:** ${resource.ownerKind}/${resource.ownerName}`);
		lines.push("");
	}
	if (detail.conditions && detail.conditions.length > 0) {
		lines.push("## Conditions");
		for (const c of detail.conditions) {
			const reasonSuffix = c.reason ? ` (${c.reason})` : "";
			lines.push(`- ${c.type}: ${c.status}${reasonSuffix}`);
		}
		lines.push("");
	}
	if (detail.containers && detail.containers.length > 0) {
		lines.push("## Containers");
		for (const c of detail.containers) {
			const initLabel = c.isInit ? " (init)" : "";
			const readyLabel = c.ready ? "ready" : "not ready";
			const reasonSuffix = c.reason ? ` — ${c.reason}` : "";
			const exitSuffix = c.exitCode !== void 0 ? ` exit:${c.exitCode}` : "";
			lines.push(`- ${c.name}${initLabel}: ${c.state} [${readyLabel}]${reasonSuffix}${exitSuffix}`);
		}
		lines.push("");
	}
	lines.push("## Timeline");
	for (const event of events) {
		const countSuffix = event.count > 1 ? ` (x${event.count})` : "";
		const sourcePrefix = event.source ? `[${event.source}] ` : "";
		lines.push(`- ${event.timestamp}  ${sourcePrefix}${event.reason}${countSuffix}: ${event.message}`);
	}
	lines.push("");
	lines.push("## Logs");
	for (const log of logs) {
		const initLabel = log.isInit ? " (init)" : "";
		lines.push(`### Container: ${log.containerName}${initLabel}`);
		lines.push("```");
		lines.push(log.current);
		lines.push("```");
		if (log.previous) {
			lines.push("### Previous container");
			lines.push("```");
			lines.push(log.previous);
			lines.push("```");
		}
	}
	lines.push("");
	lines.push("## Resources");
	lines.push(`cpu request: ${resources.cpuRequest ?? "none"} | limit: ${resources.cpuLimit ?? "none"} | actual: ${resources.cpuActual ?? (resources.metricsAvailable ? "n/a" : "metrics unavailable")}`);
	lines.push(`mem request: ${resources.memRequest ?? "none"} | limit: ${resources.memLimit ?? "none"} | actual: ${resources.memActual ?? (resources.metricsAvailable ? "n/a" : "metrics unavailable")}`);
	lines.push("");
	lines.push("## Related Resources");
	for (const r of related) lines.push(`- ${r.kind}: ${r.name} (${r.detail})`);
	lines.push("");
	if (helm) {
		lines.push("## Helm Release");
		lines.push(`Chart: ${helm.chart} v${helm.version} | Revision: ${helm.revision}`);
		lines.push("");
	}
	return lines.join("\n");
}
//#endregion
//#region src/main/ipc.ts
function mapEvent(e) {
	return {
		timestamp: e.lastTimestamp?.toISOString() ?? e.eventTime?.toISOString() ?? "",
		type: e.type ?? "Normal",
		reason: e.reason ?? "",
		message: e.message ?? "",
		involvedObject: `${e.involvedObject?.kind?.toLowerCase()}/${e.involvedObject?.name}`,
		count: e.count ?? 1,
		source: e.source?.component ?? ""
	};
}
function toContainerStateInfo(cs, isInit) {
	if (cs.state?.running) return {
		name: cs.name,
		state: "running",
		ready: cs.ready,
		isInit
	};
	if (cs.state?.terminated) return {
		name: cs.name,
		state: "terminated",
		ready: cs.ready,
		reason: cs.state.terminated.reason,
		exitCode: cs.state.terminated.exitCode,
		isInit
	};
	return {
		name: cs.name,
		state: "waiting",
		ready: cs.ready,
		reason: cs.state?.waiting?.reason,
		isInit
	};
}
var cache = new ResourceCache();
function registerIpcHandlers(mainWindow) {
	electron.ipcMain.handle("k8s:list-contexts", () => {
		return loadContexts();
	});
	electron.ipcMain.handle("k8s:connect", async (_event, context) => {
		try {
			connectCluster(context);
			await checkMetricsAvailable(context);
			await startWatching(context, (resources) => {
				const previous = cache.getAll(context);
				for (const r of resources) if (r.health === "critical") {
					const prev = previous.find((p) => p.uid === r.uid);
					if (prev && prev.health !== "critical") new electron.Notification({
						title: `${r.kind} unhealthy`,
						body: `${r.name} in ${r.namespace} — ${r.status}`
					}).show();
				}
				cache.set(context, resources);
				const update = {
					cluster: context,
					resources,
					clusterInfo: {
						name: context,
						connected: true,
						resourceCounts: {
							total: resources.length,
							healthy: resources.filter((r) => r.health === "healthy").length,
							warning: resources.filter((r) => r.health === "warning").length,
							critical: resources.filter((r) => r.health === "critical").length
						}
					}
				};
				mainWindow.webContents.send("k8s:resource-update", update);
			});
			return {
				name: context,
				connected: true,
				resourceCounts: {
					total: 0,
					healthy: 0,
					warning: 0,
					critical: 0
				}
			};
		} catch (err) {
			return {
				name: context,
				connected: false,
				error: err.message,
				resourceCounts: {
					total: 0,
					healthy: 0,
					warning: 0,
					critical: 0
				}
			};
		}
	});
	electron.ipcMain.handle("k8s:disconnect", async (_event, context) => {
		stopAllLogStreams();
		stopWatching(context);
		disconnectCluster(context);
		cache.clear(context);
	});
	electron.ipcMain.handle("k8s:get-logs", async (_event, cluster, namespace, pod, timestamps) => {
		return fetchLogs(cluster, namespace, pod, timestamps);
	});
	electron.ipcMain.handle("k8s:get-events", async (_event, cluster, namespace, name) => {
		const client = getClient(cluster);
		if (!client) throw new Error(`Not connected to ${cluster}`);
		return (await client.coreApi.listNamespacedEvent({ namespace })).items.filter((e) => e.involvedObject?.name === name).map(mapEvent).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
	});
	electron.ipcMain.handle("k8s:get-related", async (_event, cluster, namespace, name, kind) => {
		return fetchRelated(cluster, namespace, name, kind);
	});
	electron.ipcMain.handle("k8s:helm-info", async (_event, _cluster, _namespace, labels) => {
		return parseHelmLabels(labels);
	});
	electron.ipcMain.handle("k8s:get-resource-detail", async (_event, cluster, namespace, name, kind) => {
		const resource = cache.getAll(cluster).find((r) => r.name === name && r.namespace === namespace && r.kind === kind);
		if (!resource) throw new Error(`Resource not found: ${kind}/${name}`);
		const client = getClient(cluster);
		if (!client) throw new Error(`Not connected to ${cluster}`);
		const filteredEvents = (await client.coreApi.listNamespacedEvent({ namespace })).items.filter((e) => e.involvedObject?.name === name).map(mapEvent).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
		const [logs, related, metrics] = await Promise.all([
			kind === "Pod" ? fetchLogs(cluster, namespace, name) : Promise.resolve([]),
			fetchRelated(cluster, namespace, name, kind),
			kind === "Pod" ? fetchPodMetrics(cluster, namespace, name) : Promise.resolve(null)
		]);
		let conditions;
		let containers;
		if (kind === "Pod") {
			const pod = await client.coreApi.readNamespacedPod({
				name,
				namespace
			});
			conditions = (pod.status?.conditions ?? []).map((c) => ({
				type: c.type,
				status: c.status,
				reason: c.reason,
				message: c.message
			}));
			const initStatuses = (pod.status?.initContainerStatuses ?? []).map((cs) => toContainerStateInfo(cs, true));
			const regularStatuses = (pod.status?.containerStatuses ?? []).map((cs) => toContainerStateInfo(cs, false));
			containers = [...initStatuses, ...regularStatuses];
		}
		const helm = parseHelmLabels(resource.labels);
		return {
			resource,
			events: filteredEvents,
			logs,
			resources: {
				cpuActual: metrics?.cpuActual,
				memActual: metrics?.memActual,
				metricsAvailable: client.metricsAvailable
			},
			related,
			helm: helm ?? void 0,
			conditions,
			containers
		};
	});
	electron.ipcMain.handle("k8s:export-snapshot", async (_event, detail) => {
		const markdown = generateSnapshot(detail);
		const result = await electron.dialog.showSaveDialog(mainWindow, {
			defaultPath: `horus-snapshot-${detail.resource.name}.md`,
			filters: [{
				name: "Markdown",
				extensions: ["md"]
			}]
		});
		if (!result.canceled && result.filePath) {
			(0, fs.writeFileSync)(result.filePath, markdown, "utf-8");
			return result.filePath;
		}
		return null;
	});
	electron.ipcMain.handle("k8s:get-pod-yaml", async (_event, cluster, namespace, name) => {
		const client = getClient(cluster);
		if (!client) throw new Error(`Not connected to ${cluster}`);
		const pod = await client.coreApi.readNamespacedPod({
			name,
			namespace
		});
		return JSON.stringify(pod, null, 2);
	});
	electron.ipcMain.handle("k8s:get-namespace-events", async (_event, cluster, namespace) => {
		const client = getClient(cluster);
		if (!client) throw new Error(`Not connected to ${cluster}`);
		return (await client.coreApi.listNamespacedEvent({ namespace })).items.map(mapEvent).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
	});
	electron.ipcMain.handle("k8s:start-log-stream", (_event, cluster, namespace, pod, container, timestamps) => {
		const streamId = startLogStream(cluster, namespace, pod, container, timestamps ?? false, (data) => {
			mainWindow.webContents.send("k8s:log-chunk", {
				streamId,
				data
			});
		});
		return streamId;
	});
	electron.ipcMain.handle("k8s:stop-log-stream", (_event, streamId) => {
		stopLogStream(streamId);
	});
}
//#endregion
//#region src/main/index.ts
function createWindow() {
	const win = new electron.BrowserWindow({
		width: 1200,
		height: 800,
		minWidth: 900,
		minHeight: 600,
		title: "Horus",
		webPreferences: {
			preload: (0, path.join)(__dirname, "../preload/index.js"),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: false
		}
	});
	registerIpcHandlers(win);
	win.webContents.setWindowOpenHandler(({ url }) => {
		electron.shell.openExternal(url);
		return { action: "deny" };
	});
	if (is.dev && process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL);
	else win.loadFile((0, path.join)(__dirname, "../renderer/index.html"));
	return win;
}
electron.app.whenReady().then(() => {
	createWindow();
	electron.app.on("activate", () => {
		if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});
electron.app.on("window-all-closed", () => {
	if (process.platform !== "darwin") electron.app.quit();
});
//#endregion
