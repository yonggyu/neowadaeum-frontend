import { useCallback, useEffect, useRef, useState } from 'react'

import { readReviewImage, type ManuscriptCharacter } from '../../api/endpoints/admin'
import {
  COVER_PRESENT,
  failed,
  failureOf,
  imageOf,
  isOpening,
  OPEN_COVER,
  OPEN_NOTE_EMPHASIS,
  OPEN_NOTE_LEAD,
  OPEN_PORTRAIT,
  OPENING,
  openLabel,
  shown,
  UNOPENED,
  type ReviewImageState,
} from './reviewImage'
import { failureMessage } from './twoFactor'
import styles from './adminQueue.module.css'

/**
 * 검수 상세의 이미지 자리 둘 — **커버와 초상** (9차 캔버스 `Main` · `ReviewDetail768`, #153).
 *
 * **왜 지금까지 없었나.** `3h` 에 이미지 칸이 없었고(#153 의 셋째 물음), 계약도 바이트를
 * 주는 길이 없었다 — `#134` 는 그래서 *"커버가 있다"* 는 사실만 적었다. §13-78 이
 * `readReviewImage` 를 열었고 9차 캔버스가 자리를 그렸다.
 *
 * **이 자리의 정본은 `3h` 가 아니라 9차 캔버스다** (#216). `3h` 본문에는 지금도 이미지 칸이
 * 없고 **레포 밖이라 우리가 고칠 수 없다** — 그것을 펴는 사람은 이미지가 없는 화면을 본다.
 * 근거는 `docs/canvas-9/`(`Main` · `ReviewDetail768`, #202 가 레포에 들여놓았다)이고, 이
 * 파일이 그 사실을 말하는 표지다. 순서 자체는 CLAUDE.md §Source of Truth 가 든다 —
 * **나중 배치가 그 자리를 다시 그렸으면 그쪽이 이긴다.** `3h` 의 나머지(목록 · 판정 · 단축키)
 * 는 여전히 `3h` 이며, 캔버스가 대체한 것은 **그것이 그린 자리뿐**이다.
 *
 * **왜 이것이 판정 근거인가.** 승인은 이 버전의 커버를 작품 행으로 옮긴다 (§13-74) —
 * 검수자가 보지 못한 이미지가 라이브러리에 걸린다는 뜻이다. 초상은 더 나빴다: 카드가 이름과
 * `persona` 만 그려서 **초상이 있다는 사실 자체가 화면에 없었다** (§13-78/5).
 *
 * **누를 때만 부른다** (`#86` 의 선례, §13-78/4). 패널이 뜰 때 자동으로 부르면 열어 본 적
 * 없는 원고가 **큐 길이 × 이미지 수**만큼 열람 기록에 쌓이고, 그 기록은 *"누가 무엇을
 * 봤는가"* 를 더는 답하지 못한다. 대가는 검수자가 한 번 더 누르는 것이고, §13-78/5 가
 * 경고한 반대쪽(초상이 판정에서 조용히 빠지는 것)은 **버튼이 있다는 사실 자체**로 막는다.
 *
 * **`src` 에 객체 키가 오는 경로는 없다** (I-8, S-11). 버킷이 비공개라 키로 열리는 주소가
 * 없다 — 그리는 것은 언제나 우리가 `URL.createObjectURL` 로 만든 `blob:` 이고, 키는 부르는
 * 데만 쓰인다.
 */

/**
 * 자리 하나의 상태와 그것을 여는 손.
 *
 * 훅으로 두는 이유는 **실제 사용처가 둘**이기 때문이다 (CLAUDE.md 추상화 제한 1번) — 커버와
 * 초상은 자리 모양도 문구도 다르지만 *누르면 바이트를 받아 `blob:` 을 만들고 떠날 때 거둔다*
 * 는 하나를 똑같이 한다. 두 번 적으면 그중 한쪽은 반드시 URL 을 거두지 않는다.
 *
 * **마크업은 공유하지 않는다.** 커버는 자리 안에 버튼이 서고 초상은 자리 자체가 버튼이며,
 * 아이콘도 라벨도 다르다 — 모양이 닮았다는 이유로 합치지 않는다 (CLAUDE.md 코드 품질).
 */
function useReviewImage(
  storyId: string,
  objectKey: string,
): { state: ReviewImageState; open: () => void } {
  const [state, setState] = useState<ReviewImageState>(UNOPENED)
  /*
   * 거두어야 할 `blob:` 주소와 진행 중인 요청. **ref 로 든다** — StrictMode 가 마운트 효과를
   * 두 번 돌리므로 상태에 매달아 두면 살아 있는 URL 이 개발 모드에서 즉시 취소된다
   * (`authoring/ImageSlotField` 가 같은 자리에서 같은 판단을 했다).
   */
  const urlRef = useRef<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  /*
   * 자리가 가리키는 키가 바뀌면 들고 있던 그림은 **남의 것**이 된다 — 인물이 지워지거나
   * 순서가 바뀌면 같은 자리에 다른 사람의 키가 온다. 그때 앞사람의 초상이 한 프레임이라도
   * 남으면 화면은 남의 얼굴을 이 사람의 것으로 보여 준다. 그래서 키가 바뀌면 처음으로
   * 되돌린다 — **다시 부르지는 않는다.** 부르는 것은 사람의 손 하나뿐이다 (§13-78/4).
   */
  useEffect(() => {
    setState(UNOPENED)
    return () => {
      abortRef.current?.abort()
      abortRef.current = null
      if (urlRef.current !== null) URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    }
  }, [storyId, objectKey])

  const open = useCallback(() => {
    const controller = new AbortController()
    abortRef.current?.abort()
    abortRef.current = controller
    setState(OPENING)

    void readReviewImage(storyId, objectKey, controller.signal).then(
      (bytes) => {
        if (controller.signal.aborted) return
        const url = URL.createObjectURL(bytes)
        if (urlRef.current !== null) URL.revokeObjectURL(urlRef.current)
        urlRef.current = url
        setState(shown(url))
      },
      (cause: unknown) => {
        // 취소는 실패가 아니다 — 화면이 사라졌거나 자리가 바뀐 것이고, 그것을 "못 받았다" 로
        // 적으면 검수자가 하지 않은 일이 화면에 남는다.
        if (controller.signal.aborted) return
        // 문구를 짓지 않는다 (F-4). `403` 이 역할 · IP · 2FA 중 무엇인지도 나누지 않는다 (S-6).
        setState(failed(failureMessage(cause)))
      },
    )
  }, [objectKey, storyId])

  return { state, open }
}

/**
 * 커버 자리 (아트보드 — 장르 다음, 짧은 소개 앞).
 *
 * **비율은 `--ratio-cover` 다.** 높이를 px 로 박지 않는다 (F-9) — 폭만 상수이고 높이는
 * 비율이 만든다. 그래서 390 에서도 접히는 방식이 따로 필요 없다.
 *
 * 옆의 두 문장은 1024 이상에서 자리 오른쪽, 1023 이하에서 자리 아래다 (`ReviewDetail768` —
 * *"접힐 때 바뀌는 것은 하나다"*). 폭은 그대로다.
 */
export function CoverSlot({ storyId, objectKey }: { storyId: string; objectKey: string }) {
  const { state, open } = useReviewImage(storyId, objectKey)
  const url = imageOf(state)
  const failure = failureOf(state)

  return (
    <>
      <div className={styles.coverRow}>
        {url === null ? (
          <div className={styles.coverSlot}>
            <ImageIcon />
            <p className={styles.slotNote}>{COVER_PRESENT}</p>
            <button
              type="button"
              className={styles.button}
              disabled={isOpening(state)}
              onClick={open}
            >
              {openLabel(state, OPEN_COVER)}
            </button>
          </div>
        ) : (
          // `alt` 에 객체 키를 적지 않는다 (S-11). 구역 이름과 같은 말이면 충분하다.
          <img className={styles.coverImage} src={url} alt="커버" />
        )}
        <p className={styles.coverNote}>
          {OPEN_NOTE_LEAD} <strong className={styles.noteEmphasis}>{OPEN_NOTE_EMPHASIS}</strong>
        </p>
      </div>
      {failure === null ? null : (
        <p className={styles.failure} role="alert">
          {failure}
        </p>
      )}
    </>
  )
}

/**
 * 인물 하나 — **초상 자리가 카드 안에 있다** (아트보드).
 *
 * 밖에 따로 늘어놓지 않는다. 검수자가 판정하는 것은 *이 인물의 초상*이고, 카드 밖으로 빼면
 * 인물이 여럿일 때 어느 얼굴이 누구의 것인지 화면이 말하지 않는다.
 *
 * **초상이 없는 인물이 정상이다** (계약 — 그때 `portraitImageKey` 가 `null`). 그때는 자리를
 * 두지 않는다: 빈 칸을 그리면 *올렸는데 안 보인다* 로 읽히고, 여는 자리를 두면 **갈 수 없는
 * 곳으로 가는 문**이 된다 (`B-2` 의 규칙).
 */
export function CharacterEntry({
  storyId,
  character,
}: {
  storyId: string
  character: ManuscriptCharacter
}) {
  /*
   * 초상이 없는 인물은 자리를 열지 않으므로 **훅도 돌지 않는다.** 한 컴포넌트에서 조건으로
   * 가르면 훅 규칙이 깨지고, 열지 않는 인물까지 요청을 들고 있게 된다.
   */
  if (character.portraitImageKey === null) {
    return (
      <div className={styles.entry}>
        <CharacterBody character={character} />
      </div>
    )
  }
  return (
    <PortraitCharacter
      storyId={storyId}
      character={character}
      objectKey={character.portraitImageKey}
    />
  )
}

/**
 * 초상이 있는 인물 — **자리 자체가 버튼이다** (아트보드).
 *
 * 커버처럼 자리 안에 버튼을 두지 않는다: 72px 폭에 48px 짜리 버튼이 들어가면 아이콘도 말도
 * 설 자리가 없다. 자리가 버튼이면 누르는 면이 72×90 이라 터치 대상으로도 넉넉하다.
 *
 * 실패는 **카드 아래**에 적는다 — 72px 자리 안에 넣으면 서버가 한 말의 절반만 보인다 (F-4).
 */
function PortraitCharacter({
  storyId,
  character,
  objectKey,
}: {
  storyId: string
  character: ManuscriptCharacter
  objectKey: string
}) {
  const { state, open } = useReviewImage(storyId, objectKey)
  const url = imageOf(state)
  const failure = failureOf(state)

  return (
    <div className={styles.entry}>
      <div className={styles.characterRow}>
        {url === null ? (
          <button
            type="button"
            className={styles.portraitSlot}
            disabled={isOpening(state)}
            onClick={open}
          >
            <PersonIcon />
            <span className={styles.slotNote}>{openLabel(state, OPEN_PORTRAIT)}</span>
          </button>
        ) : (
          // `alt` 에 객체 키를 적지 않는다 (S-11). 이름은 옆 줄이 이미 말한다.
          <img className={styles.portraitImage} src={url} alt="초상" />
        )}
        <CharacterBody character={character} />
      </div>
      {failure === null ? null : (
        <p className={styles.failure} role="alert">
          {failure}
        </p>
      )}
    </div>
  )
}

/** 인물 카드의 글자 쪽. 초상이 있든 없든 같은 것을 적는다. */
function CharacterBody({ character }: { character: ManuscriptCharacter }) {
  return (
    <div className={styles.characterBody}>
      <p className={styles.entryHead}>{character.name}</p>
      {/* `persona` 를 감추지 않는다 — 매 턴 모델에게 들어가는 문장이다 (§13-61) */}
      <p className={styles.prose}>{character.persona}</p>
    </div>
  )
}

/* 아이콘 둘은 아트보드의 것이다. 장식이므로 접근성 트리에서 감춘다 — 옆의 말이 자리를 말한다 */

/*
 * **같은 액자를 `authoring/ImageSlotField` 의 `SlotGlyph` 도 적는다 — 합치지 않는다** (#225).
 * 뜻은 같아도 말하는 상태가 다르다 — 저기는 *비어 있음(고르세요)*, 여기는 *커버가 있는데
 * 아직 열지 않았음*. 도형의 주인은 위(#216)와 같은 **캔버스**다 — `docs/canvas-9/Main.dc.html`
 * 과 `ReviewDetail768.dc.html` 의 커버 판. 크기도 아트보드가 각자 골랐다: 여기 24, 저기 20.
 */
function ImageIcon() {
  return (
    <svg
      className={styles.slotIcon}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="M21 15l-5-4-4.5 4-2-1.5L3 18" />
    </svg>
  )
}

function PersonIcon() {
  return (
    <svg
      className={styles.slotIcon}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5" />
    </svg>
  )
}
