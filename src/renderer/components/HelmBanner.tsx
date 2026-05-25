import { Callout, Intent } from '@blueprintjs/core'
import type { HelmInfo } from '../../shared/types'

interface HelmBannerProps {
  helm: HelmInfo
}

export function HelmBanner({ helm }: HelmBannerProps) {
  return (
    <Callout intent={Intent.PRIMARY} icon="box" style={{ marginBottom: 8 }}>
      <span className="monospace">
        Helm: {helm.chart} (chart v{helm.version}, rev {helm.revision})
      </span>
    </Callout>
  )
}
