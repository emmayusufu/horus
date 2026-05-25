import { Card, H5, HTMLTable } from '@blueprintjs/core'

interface ResourceUsageProps {
  cpuRequest?: string
  cpuLimit?: string
  cpuActual?: string
  memRequest?: string
  memLimit?: string
  memActual?: string
  metricsAvailable: boolean
}

export function ResourceUsage(props: ResourceUsageProps) {
  const actualLabel = props.metricsAvailable ? 'n/a' : 'metrics unavailable'
  return (
    <Card style={{ marginBottom: 12 }}>
      <H5>Resources</H5>
      <HTMLTable condensed className="monospace">
        <thead>
          <tr>
            <th></th>
            <th>request</th>
            <th>limit</th>
            <th>actual</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>cpu</td>
            <td>{props.cpuRequest ?? 'none'}</td>
            <td>{props.cpuLimit ?? 'none'}</td>
            <td>{props.cpuActual ?? actualLabel}</td>
          </tr>
          <tr>
            <td>mem</td>
            <td>{props.memRequest ?? 'none'}</td>
            <td>{props.memLimit ?? 'none'}</td>
            <td>{props.memActual ?? actualLabel}</td>
          </tr>
        </tbody>
      </HTMLTable>
    </Card>
  )
}
