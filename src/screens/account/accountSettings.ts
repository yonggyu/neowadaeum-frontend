import type { ConsentTerm, ConsentType } from '../../api/endpoints/auth'

/**
 * 계정 설정에서 화면이 아니라 **말**인 부분 (와이어프레임 5b · 6d).
 *
 * 이 화면은 지운 것이 절반이다. 여기 없는 것이 규칙이라는 뜻이므로 적어 둔다 — 알림 ·
 * 내 데이터 내려받기 · 진행 기록 전체 삭제, 그리고 상단 사용자 정보 블록. 마지막 것은
 * 취향이 아니라 **읽을 경로가 없어서**다: `MeResponse` 는 `displayName` · `role` ·
 * `status` 셋뿐이고 `playerRef` · 이메일 · 소셜 식별자 · 생년월일은 오지 않는다 (F-6, §13-7).
 *
 * **표시명은 되돌아왔다** (backend #271, 정정본 §13-55). 5차가 닉네임 변경을 철거한 근거는
 * *"읽을 경로가 없어서"* 였고, `PATCH /api/v1/me` 가 열리면서 그 근거가 사라졌다 — 오히려
 * 지금은 **쓰는 경로가 여기 하나뿐**이다. ADR 은 이슈 #87 에 있다.
 *
 * 진행 기록 삭제는 사라진 것이 아니라 **개별 세션 삭제로 옮겨 갔다** — My Stories 세션
 * 카드의 확인 Modal 이 그 자리다 (3g · 1i).
 */

/** 사용자가 본문을 열어 보는 약관 셋. `age` 는 사용자가 읽는 문서가 아니다 (§13-24). */
export type PolicyType = Exclude<ConsentType, 'age'>

/**
 * 설정 화면의 한 줄.
 *
 * **판본이 없다.** `5b` 가 `v1.2` 같은 표기를 지웠다 — 사용자가 *동의한* 판본을 읽을 경로가
 * 없어서, 여기 그리면 지금 게시된 판본을 내가 동의한 판본처럼 보여 주게 된다. `documentUrl`
 * 은 `null` 일 수 있고 그때는 **주소를 지어내지 않는다** (S-11).
 */
export interface PolicyLink {
  readonly type: PolicyType
  readonly label: string
  readonly documentUrl: string | null
}

/**
 * 줄에 붙는 이름.
 *
 * 동의 화면의 라벨(`consent.ts`)과 문자열이 겹치지만 같은 것이 아니다 — 저쪽은 체크박스에
 * 붙는 `[필수] …` 이고 이쪽은 문서를 여는 줄이다. 모양이 비슷하다는 이유로 합치지 않는다.
 */
const POLICY_LABELS: Readonly<Record<PolicyType, string>> = {
  tos: '이용약관',
  privacy: '개인정보처리방침',
  ai_notice: 'AI 생성물 이용 안내',
}

/**
 * `GET /consents` 가 준 목록을 설정 화면의 줄들로.
 *
 * `required` 로 거르지 않는다 — 여기서 묻는 것은 *가입에 동의가 필요한가*가 아니라 *읽을 수
 * 있는 문서인가*다. 순서는 서버의 것을 그대로 쓴다 (`tos → privacy → ai_notice → age`).
 */
export function policyLinks(terms: readonly ConsentTerm[]): PolicyLink[] {
  return terms
    .filter((term): term is ConsentTerm & { consentType: PolicyType } => term.consentType !== 'age')
    .map((term) => ({
      type: term.consentType,
      label: POLICY_LABELS[term.consentType],
      documentUrl: term.documentUrl,
    }))
}

/**
 * 탈퇴 확인의 한 줄. 굵게 읽히는 자리를 데이터로 들고 있다 — 5b·6d 가 강조한 곳이 곧
 * **말해도 되는 사실**이라, 어디를 굵게 하는가가 디자인이 아니라 내용이다.
 */
export interface WithdrawNoticeLine {
  readonly before: string
  readonly emphasis?: string
  readonly after?: string
}

/**
 * 탈퇴 확인 문구 — 5b · 6d 의 세 줄 그대로.
 *
 * **"즉시 삭제됩니다" 라고 쓰지 않는다.** `DELETE /api/v1/me` 가 하는 일은 회원 상태를
 * `withdrawn` 으로 옮기는 것까지이고(R12.5), 실제 파기와 공개 UGC 강등은 파기 배치가 뒤에
 * 수행한다 (B-61, §13-9). 화면이 "지워졌습니다" 라고 말하면 그 사이의 사실과 어긋난다.
 *
 * 반대로 **다시 로그인할 수 없다는 것은 확실하다** — 탈퇴한 계정은 토큰을 재발급받지
 * 못한다. 그래서 이 한 줄만 단정한다. 나머지 둘은 결과를 단정하지 않는 형태로 남긴다:
 * 이어갈 수 없다(사용자가 겪는 일) · 순차적으로 처리된다(언제인지 말하지 않는다).
 */
export const WITHDRAW_NOTICE: readonly WithdrawNoticeLine[] = [
  { before: '탈퇴 처리 후 ', emphasis: '다시 로그인할 수 없습니다' },
  { before: '진행 중이던 이야기는 이어갈 수 없습니다' },
  { before: '공개한 작품과 데이터는 ', emphasis: '순차적으로 처리', after: '됩니다' },
]

/** 한 줄을 이어 붙인 문장. 강조가 어디든 **읽히는 말은 하나**라는 것을 테스트가 붙잡는다. */
export function withdrawNoticeText(line: WithdrawNoticeLine): string {
  return `${line.before}${line.emphasis ?? ''}${line.after ?? ''}`
}

/**
 * 화면에 보이는 표시명 — `@연우`. 없으면 `null` 이고 그때 화면이 "설정하기" 로 그린다.
 *
 * **`@` 는 값에 없다** (backend #287). 화면이 붙이는 표기이고, 값에 두면 `yeonwoo` 와
 * `@yeonwoo` 가 서로 다른 값이면서 같게 보인다 — 계약이 그 이유로 `@` 로 시작하는 값을
 * 거절한다.
 *
 * `screens/library/author.ts` 의 `authorHandle` 이 같은 표기 규칙을 쓴다. **합치지 않았다** —
 * 저쪽이 답하는 질문은 *이 작품의 작성자를 무엇으로 부르는가*(`authorType` 이 함께 걸린다)
 * 이고 이쪽은 *내가 정한 이름이 무엇인가*다. 두 줄짜리 문자열 규칙을 위해 슬라이스를 가로지르는
 * 공용 모듈을 만들면 그것이 잘못된 추상화다.
 */
export function displayNameHandle(displayName: string | null): string | null {
  const name = displayName?.trim() ?? ''
  return name === '' ? null : `@${name}`
}

/**
 * 지금 보낼 수 있는 값인가 — **빈 것만 막는다.**
 *
 * **길이·허용 문자를 화면이 판정하지 않는다.** 규칙의 정본은 서버 도메인이고 계약이 그 자리에
 * 적었다: *"화면 검증은 편의이지 계약이 아니다."* 여기에 2~12자를 옮겨 적으면 정본이 둘이 되고,
 * 갈라지는 날 한쪽이 통과시킨 이름을 다른 쪽이 거절한다. 거절은 `400` 으로 오고 화면은 서버의
 * `message` 를 그대로 낸다 (F-4).
 *
 * 빈 값만 막는 이유는 다르다 — 보낼 것이 없는 요청이라 서버에 물어볼 필요가 없다.
 */
export function canSubmitDisplayName(input: string): boolean {
  return input.trim() !== ''
}
