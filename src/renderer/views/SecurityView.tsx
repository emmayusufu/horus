import { useState, useEffect } from 'react'
import { Card, H5, Tag, Intent, Spinner, Button, HTMLSelect } from '@blueprintjs/core'
import { useK8s } from '../hooks/useK8s'
import type { RBACBinding, NetworkPolicySummary, SecurityIssue, SecretUsage } from '../../shared/types'

interface SecurityViewProps {
  cluster: string
  namespaces: string[]
  onBack: () => void
}

export function SecurityView({ cluster, namespaces, onBack }: SecurityViewProps) {
  const k8s = useK8s()
  const [namespace, setNamespace] = useState(namespaces[0] ?? 'default')
  const [rbac, setRbac] = useState<RBACBinding[]>([])
  const [netpols, setNetpols] = useState<NetworkPolicySummary[]>([])
  const [scan, setScan] = useState<SecurityIssue[]>([])
  const [secrets, setSecrets] = useState<SecretUsage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      k8s.getRBAC(cluster, namespace).catch(() => []),
      k8s.getNetworkPolicies(cluster, namespace).catch(() => []),
      k8s.getSecurityScan(cluster, namespace).catch(() => []),
      k8s.getSecretUsage(cluster, namespace).catch(() => [])
    ]).then(([r, n, s, sec]) => {
      setRbac(r)
      setNetpols(n)
      setScan(s)
      setSecrets(sec)
    }).finally(() => setLoading(false))
  }, [cluster, namespace])

  const totalIssues = scan.reduce((sum, s) => sum + s.issues.length, 0)
  const unprotectedPods = scan.filter((s) => s.issues.includes('no network policy')).length

  return (
    <div style={{ padding: 16, overflow: 'auto', flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Button minimal icon="arrow-left" onClick={onBack} />
        <H5 style={{ margin: 0 }}>Security</H5>
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{cluster}</span>
        <HTMLSelect value={namespace} onChange={(e) => setNamespace(e.target.value)} style={{ marginLeft: 'auto' }}>
          {namespaces.map((ns) => <option key={ns} value={ns}>{ns}</option>)}
        </HTMLSelect>
      </div>

      {loading ? <Spinner style={{ margin: 40 }} /> : (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <Card className="overview-stat-card">
              <div className="overview-stat-value" style={{ color: totalIssues > 0 ? '#e5564f' : '#3d9a5f' }}>{totalIssues}</div>
              <div className="overview-stat-label">Security Issues</div>
            </Card>
            <Card className="overview-stat-card">
              <div className="overview-stat-value" style={{ color: unprotectedPods > 0 ? '#cc8d35' : '#3d9a5f' }}>{unprotectedPods}</div>
              <div className="overview-stat-label">Unprotected Pods</div>
            </Card>
            <Card className="overview-stat-card">
              <div className="overview-stat-value">{rbac.length}</div>
              <div className="overview-stat-label">Role Bindings</div>
            </Card>
            <Card className="overview-stat-card">
              <div className="overview-stat-value">{secrets.length}</div>
              <div className="overview-stat-label">Secrets</div>
            </Card>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <Card style={{ marginBottom: 12 }}>
                <H5>Security Scan</H5>
                {scan.length === 0 ? (
                  <div style={{ color: '#3d9a5f', fontSize: 13 }}>All pods pass security checks</div>
                ) : (
                  <div style={{ maxHeight: 300, overflow: 'auto' }}>
                    {scan.map((s) => (
                      <div key={s.pod} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                        <div className="monospace" style={{ fontSize: 12, marginBottom: 2 }}>{s.pod}</div>
                        {s.issues.map((issue, i) => (
                          <div key={i} style={{ fontSize: 11, color: 'var(--color-warn)', paddingLeft: 8 }}>- {issue}</div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card style={{ marginBottom: 12 }}>
                <H5>Network Policies ({netpols.length})</H5>
                {netpols.length === 0 ? (
                  <div style={{ color: '#cc8d35', fontSize: 13 }}>No network policies in this namespace</div>
                ) : (
                  <div className="monospace" style={{ fontSize: 12 }}>
                    {netpols.map((np) => (
                      <div key={np.name} style={{ display: 'flex', gap: 8, padding: '4px 0', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ flex: 1 }}>{np.name}</span>
                        <Tag minimal intent={Intent.SUCCESS}>{np.matchingPods} pods</Tag>
                        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{np.ingressRules}in {np.egressRules}eg</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            <div>
              <Card style={{ marginBottom: 12 }}>
                <H5>RBAC Bindings</H5>
                {rbac.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No role bindings</div>
                ) : (
                  <div style={{ maxHeight: 300, overflow: 'auto' }}>
                    {rbac.map((b) => (
                      <div key={b.name} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 2 }}>
                          <Tag minimal>{b.roleKind}</Tag>
                          <span className="monospace" style={{ fontSize: 12 }}>{b.role}</span>
                        </div>
                        {b.subjects.map((s, i) => (
                          <div key={i} style={{ fontSize: 11, color: 'var(--text-muted)', paddingLeft: 8 }}>
                            {s.kind}: {s.name}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card style={{ marginBottom: 12 }}>
                <H5>Secrets ({secrets.length})</H5>
                <div style={{ maxHeight: 300, overflow: 'auto' }}>
                  {secrets.map((s) => (
                    <div key={s.name} style={{ display: 'flex', gap: 8, padding: '4px 0', alignItems: 'center', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                      <span className="monospace" style={{ flex: 1 }}>{s.name}</span>
                      <Tag minimal style={{ fontSize: 10 }}>{s.type}</Tag>
                      <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                        {s.referencedBy.length > 0 ? `${s.referencedBy.length} pods` : 'unused'}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
