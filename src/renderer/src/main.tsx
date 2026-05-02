import './assets/main.css'
import '@douyinfe/semi-ui/lib/es/_base/base.css'
import '@douyinfe/semi-ui/react19-adapter'
import 'highlight.js/styles/github.css'
import 'katex/dist/katex.min.css'
import 'markdown-it-texmath/css/texmath.css'
import 'prosemirror-view/style/prosemirror.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
