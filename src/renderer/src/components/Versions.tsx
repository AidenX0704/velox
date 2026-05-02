import { useState } from 'react'

function Versions(): React.JSX.Element {
  const [runtime] = useState({
    product: 'Velox',
    bridge: 'Typed IPC',
    security: 'Context Isolation'
  })

  return (
    <ul className="versions">
      <li className="electron-version">{runtime.product}</li>
      <li className="chrome-version">{runtime.bridge}</li>
      <li className="node-version">{runtime.security}</li>
    </ul>
  )
}

export default Versions
