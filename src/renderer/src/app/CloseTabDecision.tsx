import { useSyncExternalStore } from 'react'
import { Button, Modal } from '../ui'
import {
  getCloseTabDecisionRequest,
  settleCloseTabDecision,
  subscribeCloseTabDecision
} from './closeTabDecisionStore'

/**
 * Controlled three-way dialog. Esc and scrim clicks mean "cancel" — never
 * "discard", which is the whole point of not using a two-button confirm.
 */
export function CloseTabDecisionHost(): React.JSX.Element | null {
  const request = useSyncExternalStore(subscribeCloseTabDecision, getCloseTabDecisionRequest)

  if (!request) {
    return null
  }

  return (
    <Modal
      visible
      title="文档尚未保存"
      onCancel={() => settleCloseTabDecision('cancel')}
      footer={
        <>
          <Button onClick={() => settleCloseTabDecision('cancel')}>取消</Button>
          <Button type="danger" onClick={() => settleCloseTabDecision('discard')}>
            不保存并关闭
          </Button>
          <Button theme="solid" type="primary" onClick={() => settleCloseTabDecision('save')}>
            保存并关闭
          </Button>
        </>
      }
    >
      {`"${request.title}" 尚未保存，请选择如何关闭。`}
    </Modal>
  )
}
