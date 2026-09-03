import { findingsFor, highlightSegments } from './precheck'
import { isNearLimit } from './stepFields'
import type { PrecheckHandle } from './usePrecheck'
import css from './wizard.module.css'

/**
 * 마법사의 입력 칸 하나 — 라벨 · 글자 수 · 검수 표시가 한 덩어리다 (와이어프레임 3d).
 *
 * 세 Step 이 같은 모양을 쓰기 때문에 여기 둔다. **검수 결과를 필드가 직접 그린다** — 6a 는
 * 768 이하에서 *"검수는 필드 바로 아래 인라인"* 이라고 정했고, 그 자리를 우측 패널이 대신할
 * 수 없다: 패널은 1024 부터만 있다.
 */
export interface FieldProps {
  /** 계약의 필드 경로. DOM id 도 이것이다 — 우측 패널의 "해당 필드로 이동" 이 이 id 를 찾는다 */
  field: string
  label: string
  /** 라벨 옆의 부연. 3d 는 여기에 **누구에게 보이는 값인지**를 적었다 */
  hint?: string
  value: string
  /** 글자 수 상한. 3d 가 값으로 적은 자리에만 둔다 */
  max?: number
  control: 'input' | 'textarea'
  /** 상한이 가까울 때의 안내 (3d). 문장이 필드마다 다르므로 부르는 쪽이 준다 */
  nearLimitNote?: string
  onChange: (value: string) => void
  precheck: PrecheckHandle
}

export function DraftField({
  field,
  label,
  hint,
  value,
  max,
  control,
  nearLimitNote,
  onChange,
  precheck,
}: FieldProps) {
  const found = findingsFor(precheck.findings, field)
  const blocked = found.length > 0
  const checking = precheck.isChecking(field)

  // 입력과 검수를 함께 태운다 — 검사는 0.8초 뒤에 나간다 (`usePrecheck`)
  const handle = (next: string): void => {
    onChange(next)
    precheck.check(field, next)
  }

  const shared = {
    id: field,
    className: blocked ? `${css.control} ${css.controlBlocked}` : css.control,
    value,
    maxLength: max,
    'aria-invalid': blocked,
    'aria-describedby': blocked ? `${field}--msg` : undefined,
  }

  return (
    <div className={blocked ? `${css.field} ${css.fieldBlocked}` : css.field}>
      <div className={css.fieldHead}>
        <label className={css.fieldLabel} htmlFor={field}>
          {label}
          {hint === undefined ? null : <span className={css.fieldHint}>{` · ${hint}`}</span>}
        </label>
        {/* 3d — 검사 중에는 글자 수 자리에 "확인 중". 두 값이 같은 자리를 두고 다투지 않는다 */}
        <span className={css.fieldMeta}>
          {checking ? '확인 중' : max === undefined ? '' : `${value.length} / ${max}`}
        </span>
      </div>

      {control === 'input' ? (
        <input type="text" {...shared} onChange={(event) => handle(event.target.value)} />
      ) : (
        <textarea rows={4} {...shared} onChange={(event) => handle(event.target.value)} />
      )}

      {max !== undefined && nearLimitNote !== undefined && isNearLimit(value.length, max) ? (
        <p className={css.nearLimit}>{nearLimitNote}</p>
      ) : null}

      {blocked ? (
        <div className={css.fieldFindings} id={`${field}--msg`} role="alert">
          {/*
           * 문제 구간을 원문 위에 보여 준다 (3d). `input` 안에는 밑줄을 그을 수 없으므로
           * 바로 아래 한 줄로 다시 그린다 — 사용자가 쓴 글자 말고는 아무것도 더하지 않는다.
           */}
          <p className={css.highlight}>
            {highlightSegments(
              value,
              found.map((finding) => finding.span),
            ).map((segment, index) =>
              segment.marked ? (
                <mark key={index} className={css.mark}>
                  {segment.text}
                </mark>
              ) : (
                <span key={index}>{segment.text}</span>
              ),
            )}
          </p>
          {/*
           * **서버가 준 `message` 그대로다** (F-4). `kind` 를 우리 문구로 옮기지 않고 무엇에
           * 걸렸는지도 덧붙이지 않는다 (F-5) — 그 설명이 곧 우회를 가르친다 (R8.7, S-11).
           */}
          {found.map((finding, index) => (
            <p key={index} className={css.blockedMessage}>
              {finding.message}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/**
 * 그림이 들어갈 자리 — **커버(2:3)와 초상**.
 *
 * **업로드를 만들지 않는다.** 계약에 이미지를 올리는 오퍼레이션이 없다 (`docs/openapi.yaml`
 * 의 `authoring` 태그 다섯 경로 어디에도 `multipart` 가 없고, 업로드 URL 을 주는 경로도
 * 없다). 파일 입력만 먼저 붙이면 고르는 순간 아무 데도 가지 않는 파일이 생기고, 화면은
 * 저장된 것처럼 보인다 — 비어 있는 화면이 돌아가는 것처럼 보이는 바로 그 경우다.
 *
 * 그래서 자리와 비율만 두고 **없다는 사실을 화면이 말한다.** 경로가 생기면 이 컴포넌트
 * 하나가 업로드로 바뀐다.
 */
export function ImageSlot({ label, ratio }: { label: string; ratio: 'cover' | 'portrait' }) {
  return (
    <div className={css.field}>
      <span className={css.fieldLabel}>{label}</span>
      <div className={ratio === 'cover' ? `${css.imageSlot} ${css.cover}` : css.imageSlot}>
        <span className={css.imageSlotNote}>
          {ratio === 'cover' ? '2:3 권장 · 업로드 경로 없음' : '업로드 경로 없음'}
        </span>
      </div>
    </div>
  )
}
