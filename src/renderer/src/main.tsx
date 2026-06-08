import './assets/main.css'
import '@douyinfe/semi-ui/lib/es/_base/base.css'
import '@douyinfe/semi-ui/react19-adapter'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
