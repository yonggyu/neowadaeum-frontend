import { useId, useRef, useState, type ReactNode } from 'react'

import { useDialogChrome } from '../hooks/useDialogChrome'
import css from './confirm.module.css'

interface ConfirmDialogProps {
  title: string
  /** 무엇을 잃는지. 줄 하나이거나(1i · 3g) 목록 셋이다(5b) — 부른 화면이 그린다 */
  children: ReactNode
  confirmLabel: string
  /** 누른 뒤의 문구. 지우는 중 · 처리 중처럼 그 동작의 말이라 화면마다 다르다 */
  pendingLabel: string
  cancelLabel: string
  /**
   * 되돌릴 수 없는 그 요청.
   *
   * **성공 뒤의 일은 부른 화면이 한다** — 닫거나(세션·원고) 목록을 다시 받거나 떠난다(탈퇴).
   * 여기서 닫아 버리면 화면마다 다른 뒷일이 이 컴포넌트로 올라온다.
   */
  onConfirm: () => Promise<void>
  onCancel: () => void
}

/**
 * 되돌릴 수 없는 동작 앞의 확인 — Desktop 420px 중앙 모달 / Mobile 전체화면 (6d).
 *
 * **왜 이제야 하나로 만들었나.** CLAUDE.md 는 *"실제 사용처가 둘 이상 존재한다"* 를 추상화
 * 도입 조건으로 두었고, 사용처가 하나일 때 만들었다면 그건 추측이었다. 지금은 셋이다 —
 * 회원 탈퇴(5b · 6d) · 세션 삭제(1i · 3g) · 원고 삭제(3g). 셋의 마크업이 닮아서가 아니라
 * **같은 한 문장을 따르기 때문에** 하나다: *"되돌릴 수 없는 동작이라 시트로 띄우지 않는다"*(6d).
 *
 * **신고는 여기 오지 않는다.** 6c 가 신고를 Mobile 하단 시트로 정했다 — 같은 자리에 뜨지도
 * 않고 사유 선택이라는 자기 상태가 있다. boolean prop 하나로 두 형태를 넣으면 그 순간
 * 이 컴포넌트가 두 책임을 갖는다. 신고와 겹치는 것은 **껍데기**(Esc · 초점 가둠 · 스크롤
 * 잠금 · `aria-modal`)이고, 그것은 `useDialogChrome` 이 이미 들고 있어 둘 다 그것을 쓴다.
 *
 * **공개 중지(3f)는 합치지 않았다.** 그 화면의 확인은 라디오 폼의 같은 버튼을 한 번 더
 * 누르는 것이고, 3f 는 그 자리에 모달을 그리지 않았다. 무엇보다 되돌릴 수 있다 — 다시
 * 넓히려면 검수를 처음부터 받을 뿐이다. 모양이 비슷하다는 이유로 합치지 않는다.
 */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  pendingLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const [submitting, setSubmitting] = useState(false)
  const [failure, setFailure] = useState<unknown>(null)

  // 보내는 중에는 Esc 로 닫지 않는다 — 판만 사라지고 요청은 그대로 간다. 취소 버튼이
  // 그동안 비활성인 것과 같은 이유이며, 닫는 길이 둘로 갈리면 한쪽만 지켜진다.
  useDialogChrome(dialogRef, () => {
    if (!submitting) {
      onCancel()
    }
  })

  async function confirm(): Promise<void> {
    setSubmitting(true)
    setFailure(null)
    try {
      await onConfirm()
    } catch (error) {
      setFailure(error)
      setSubmitting(false)
    }
  }

  return (
    <div className={css.overlay}>
      {/*
       * `alertdialog` 다 — 되돌릴 수 없는 동작을 묻는 판이라는 것이 이 role 의 뜻이고,
       * 제목을 `aria-labelledby` 로 이어 두면 화면 낭독기가 판이 열린 순간 그것을 읽는다.
       */}
      <div
        ref={dialogRef}
        className={css.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <h2 id={titleId} className={css.title}>
          {title}
        </h2>
        <div className={css.body}>{children}</div>

        {/*
         * 판 안의 실패는 화면 상태가 아니라 이 조작의 결과다 — 전면 오류 블록을 넣으면 확인
         * 버튼이 밀려난다. 서버의 `message` 만 그대로 낸다 (F-4). 어디까지 진행됐는지 화면이
         * 추측해 말하지 않는다.
         */}
        {failure !== null ? (
          <p className={css.failure} role="alert">
            {failure instanceof Error ? failure.message : String(failure)}
          </p>
        ) : null}

        {/*
         * DOM 순서는 **취소 먼저**다. 6d 의 Desktop 행 순서(돌아가기 좌 · 탈퇴합니다 우)와
         * 같고, 되돌릴 수 없는 쪽이 키보드 첫 초점이 되지 않는다. Mobile 은 5b 처럼 확인이
         * 위에 오도록 CSS 가 뒤집는다.
         */}
        <div className={css.actions}>
          <button type="button" className={css.button} onClick={onCancel} disabled={submitting}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`${css.button} ${css.destructive}`}
            onClick={() => void confirm()}
            disabled={submitting}
          >
            {submitting ? pendingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
