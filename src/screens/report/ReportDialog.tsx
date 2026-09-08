import { useCallback, useId, useRef, useState } from 'react'

import { ApiError } from '../../api/client'
import { createReport, type ReportReason } from '../../api/endpoints/reports'
import { useDialogChrome } from '../../hooks/useDialogChrome'
import sheet from '../../styles/sheet.module.css'
import { DETAIL_MAX_LENGTH, REPORT_REASONS, reportRequest, type ReportTarget } from './report'
import s from './report.module.css'

/**
 * 접수 뒤의 화면.
 *
 * `accepted` 가 아무것도 들고 있지 않다는 점이 이 타입의 요점이다 — 서버가 `202` 에 본문을
 * 싣지 않으므로 **보여 줄 접수 번호가 존재하지 않는다** (§13-12). `duplicate` 만 문자열을
 * 드는데 그것도 우리가 지은 문장이 아니라 서버가 준 `message` 다 (F-4).
 */
type Phase =
  | { status: 'form' }
  | { status: 'submitting' }
  | { status: 'accepted' }
  | { status: 'duplicate'; message: string }

interface ReportDialogProps {
  /** 고를 수 있는 대상. Play 는 장면 · 작품 둘, Story Detail 은 작품 하나다 */
  targets: readonly [ReportTarget, ...ReportTarget[]]
  /** 접수 뒤 돌아갈 곳의 이름 — 부른 화면이 정한다 */
  returnLabel: string
  onClose: () => void
}

/**
 * 신고 — 와이어프레임 3c · 5d · 6c.
 *
 * **Desktop 중앙 400px 모달 / Mobile 하단 시트이고 컴포넌트는 하나다** (6c). 내용 · 순서 ·
 * 문구가 완전히 같으므로 폭을 CSS 가 가른다 (F-9). 별 페이지를 만들지 않는다.
 *
 * 이 화면이 **삭제한 것**이 절반이다 (5d):
 * - 접수 번호를 그리지 않는다 — 응답에 본문이 없다. 몇 건인지 알면 임계를 역산할 수 있다
 * - `alreadyReported` 선판정이 없다 — 조회 수단이 계약에 없다. 중복은 **눌러 봐야** 안다
 * - 처리 결과를 알려 주겠다고 말하지 않는다 — "결과는 개별 안내하지 않습니다" (3c)
 */
export function ReportDialog({ targets, returnLabel, onClose }: ReportDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const detailId = useId()

  const [targetIndex, setTargetIndex] = useState(0)
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [detail, setDetail] = useState('')
  const [phase, setPhase] = useState<Phase>({ status: 'form' })
  const [failure, setFailure] = useState<string | null>(null)
  const [confirmingClose, setConfirmingClose] = useState(false)

  const target = targets[targetIndex] ?? targets[0]

  /**
   * Esc · 배경 클릭은 닫되 **사유를 고른 뒤에는 확인을 묻는다** (6c).
   *
   * ✕ 와 취소는 곧바로 닫는다. 6c 가 확인을 붙인 자리를 그 둘로 못박은 이유는 **실수로 눌리는
   * 길**이 그것뿐이기 때문이다 — 누르려고 누른 버튼에 매번 되묻는 것은 확인이 아니라 방해다.
   */
  const requestClose = useCallback(() => {
    if (phase.status === 'form' && reason !== null) {
      setConfirmingClose(true)
      return
    }
    onClose()
  }, [phase.status, reason, onClose])

  useDialogChrome(dialogRef, requestClose)

  function submit(): void {
    if (reason === null) {
      return
    }
    setPhase({ status: 'submitting' })
    setFailure(null)
    createReport(reportRequest(target, reason, detail)).then(
      () => setPhase({ status: 'accepted' }),
      (cause: unknown) => {
        // 중복만 다른 판으로 간다. 나머지는 폼에 남긴다 — 쓴 것을 지우지 않기 위해서다.
        if (cause instanceof ApiError && cause.errorCode === 'ALREADY_EXISTS') {
          setPhase({ status: 'duplicate', message: cause.message })
          return
        }
        setPhase({ status: 'form' })
        setFailure(cause instanceof Error ? cause.message : String(cause))
      },
    )
  }

  // 접수와 중복은 **같은 판이다.** 표시와 두 줄만 다르고 접수 번호가 들어갈 자리가 없다.
  // 중복의 첫 줄은 서버가 준 `message` 그대로이고 (F-4) 둘째 줄만 어느 대상이었는지 잇는다.
  const result =
    phase.status === 'accepted'
      ? { mark: '✓', title: '신고가 접수되었습니다.', body: '검토 후 조치되며, 결과는 개별 안내하지 않습니다.' }
      : phase.status === 'duplicate'
        ? { mark: '!', title: phase.message, body: `같은 ${target.noun}은 한 번만 신고할 수 있습니다.` }
        : null

  return (
    <div
      className={sheet.overlay}
      onClick={(event) => {
        if (event.target === event.currentTarget) requestClose()
      }}
    >
      <div
        ref={dialogRef}
        className={sheet.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className={sheet.head}>
          <h2 id={titleId} className={sheet.title}>
            {result === null ? '신고하기' : '신고'}
          </h2>
          <button type="button" className={sheet.close} onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>

        {result !== null ? (
          <div className={s.result} role="status">
            <span className={s.mark} aria-hidden="true">
              {result.mark}
            </span>
            <p className={s.resultTitle}>{result.title}</p>
            <p className={s.resultBody}>{result.body}</p>
            <button
              type="button"
              className={`${sheet.button} ${sheet.primary} ${s.resultAction}`}
              onClick={onClose}
            >
              {returnLabel}
            </button>
          </div>
        ) : (
          <div className={s.body}>
            <p className={s.groupLabel}>무엇을 신고할까요</p>
            {targets.length === 1 ? (
              <p className={s.single}>
                {target.label}
                <span className={s.hint}>{target.hint}</span>
              </p>
            ) : (
              <div className={s.targets}>
                {targets.map((option, index) => (
                  <button
                    key={option.type}
                    type="button"
                    className={s.target}
                    aria-pressed={index === targetIndex}
                    onClick={() => setTargetIndex(index)}
                  >
                    {option.label}
                    <span className={s.hint}>{option.hint}</span>
                  </button>
                ))}
              </div>
            )}
            {/*
             * 고른 대상만 나간다는 사실까지만 말한다. 신고가 운영에서 어떻게 다루어지는지는
             * 적지 않는다 — 그 문장은 곧 임계를 향한 안내가 된다 (S-11 · F-5).
             */}
            <p className={s.note}>장면과 작품은 서로 다른 신고입니다. 고른 대상만 접수됩니다.</p>

            <p className={s.groupLabel} id={`${titleId}-reasons`}>
              사유
            </p>
            {/*
             * `fieldset`/`legend` 가 아니라 radiogroup 이다 — legend 는 grid 항목이 되지 않아
             * 6c 의 Desktop 2×2 를 만들 수 없다. 동그라미는 진짜 radio 이므로 화살표 키
             * 이동과 그룹 낭독은 그대로다.
             */}
            <div className={s.reasons} role="radiogroup" aria-labelledby={`${titleId}-reasons`}>
              {REPORT_REASONS.map((option) => (
                <label key={option.value} className={s.reason}>
                  <input
                    type="radio"
                    className={s.radio}
                    name={`${titleId}-reason`}
                    value={option.value}
                    checked={reason === option.value}
                    onChange={() => setReason(option.value)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>

            <label className={s.groupLabel} htmlFor={detailId}>
              상세 내용 (선택)
            </label>
            <textarea
              id={detailId}
              className={s.detail}
              rows={3}
              maxLength={DETAIL_MAX_LENGTH}
              value={detail}
              onChange={(event) => setDetail(event.target.value)}
            />
            <p className={s.counter}>
              {detail.length} / {DETAIL_MAX_LENGTH}
            </p>

            {/* 실패 문구는 서버 `message` 다 (F-4). 무엇이 걸렸는지 덧붙이지 않는다 (F-5) */}
            {failure !== null ? (
              <p className={s.failure} role="alert">
                {failure}
              </p>
            ) : null}

            {confirmingClose ? (
              <div className={sheet.actions} role="alertdialog" aria-label="신고 닫기 확인">
                <p className={s.confirmText}>쓰던 신고를 닫을까요?</p>
                <button type="button" className={sheet.button} onClick={() => setConfirmingClose(false)}>
                  계속 쓰기
                </button>
                <button type="button" className={`${sheet.button} ${sheet.primary}`} onClick={onClose}>
                  닫기
                </button>
              </div>
            ) : (
              <div className={sheet.actions}>
                <button type="button" className={sheet.button} onClick={onClose}>
                  취소
                </button>
                <button
                  type="button"
                  className={`${sheet.button} ${sheet.primary}`}
                  disabled={reason === null || phase.status === 'submitting'}
                  onClick={submit}
                >
                  {phase.status === 'submitting' ? '접수 중…' : '신고 접수'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
