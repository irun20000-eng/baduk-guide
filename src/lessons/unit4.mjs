// 4단원. 돌 잡는 기술 (16~21차시) + 미션 "기술 섞어 풀기 10문제"
import { fill, flipH, flipV } from './tools.mjs';

const put = (rows, x, y, ch) => rows.map((r, i) => (i === y ? r.slice(0, x) + ch + r.slice(x + 1) : r));

// 양단수
const U4_DOUBLE_A = ['..X..', '..OX.', '..*OX', '.....', '.....'];
const U4_DOUBLE_B = ['.......', '.......', '.......', '.XO*...', '..XOX..', '.......', '.......'];
const U4_DOUBLE_C = ['.XX..', 'XOOX.', '..*OX', '.....', '.....'];
// 축: 세모 표시한 백돌을 오른쪽 아래로 몬다
const U4_LADDER = fill(7, ['.......', '.......', '...XX..', '..Xo...', '...*...']);
// 장문: 축머리(오른쪽 아래 백돌)가 있어서 축은 안 되고, 한 발 앞에서 막아야 한다
const U4_NET = ['.......', '.......', '...XX..', '..Xo...', '..X.*..', '.....O.', '.......'];
const U4_NET_NEXT = ['.......', '.......', '...XX..', '..XoO*.', '..X.X..', '.....O.', '.......'];
// 환격: 백의 안쪽 두 점 가운데 한 곳에 먹여친다
const U4_SNAP_EDGE = fill(7, ['o**OX..', 'OOOOX..', 'XXXXX..']);
const U4_SNAP_CORNER = fill(7, ['**oX...', 'OOOX...', 'XXXX...']);
// 촉촉수: 이어도 여전히 단수
const U4_CONNECT = fill(7, ['*o*OO..', 'XXXXXX.']);
// 수상전: 흑 두 점과 백 두 점이 활로 2개씩
const U4_RACE = fill(7, ['.......', '...OX..', '.OxxooX', '...OX..']);

const DA_TEXT = '흑 차례예요. 한 수로 백돌 두 군데를 한꺼번에 단수 쳐 보세요.';
const DA_RIGHT = '양단수예요! 백은 한쪽만 살릴 수 있어요.';
const DA_WRONG = '아쉬워요. 그 수로는 한 군데만 단수가 돼요.';
const DA_HINT = '백돌 두 덩어리에 모두 닿는 빈 점을 찾아보세요.';
const CHASE_WRONG = '아쉬워요. 그 수로는 백돌이 빠져나가요.';
const LADDER_TEXT = '흑 차례예요. 세모 표시한 백돌을 단수로 몰아 보세요. 백이 달아나면 계속 단수를 쳐서 끝까지 잡아 보세요.';
const LADDER_RIGHT = '잡았어요! 축에 걸린 돌은 달아날수록 더 많이 잡혀요.';
const LADDER_HINT = '백돌이 판 끝 쪽으로 달아나게 단수를 쳐 보세요.';
const NET_TEXT = '달아나는 길에 백돌이 있어서 축으로는 잡을 수 없어요. 흑 차례예요. 달아날 길을 한 발 앞에서 막아 보세요.';
const NET_RIGHT = '가두었어요! 이제 백돌은 어느 쪽으로 나가도 잡혀요.';
const NET_WRONG = '아쉬워요. 그 자리에 두면 백돌이 빠져나가요.';
const NET_HINT = '백돌에 바로 붙이지 말고, 대각선으로 한 칸 떨어진 자리를 찾아보세요.';
const SNAP_TEXT = '흑 차례예요. 백돌 안쪽에 한 점을 넣어 보세요. 백이 그 돌을 따내면 더 크게 되따내 보세요.';
const SNAP_RIGHT = '한 점을 내주고 훨씬 많이 따냈어요. 이것이 환격이에요.';
const SNAP_HINT = '백돌 안쪽의 빈 점에 두어 보세요.';
const YESNO_CATCH = ['잡을 수 있어요', '잡을 수 없어요'];

export const UNIT4 = [
  {
    id: 'L16', unit: 4, no: 16, title: '양단수',
    goal: '한 수로 두 곳을 한꺼번에 단수 친다',
    steps: [
      {
        type: 'explain',
        text: '한 수로 두 군데를 한꺼번에 단수 치는 수가 있어요. 이것을 양단수라고 해요. 상대는 한쪽만 살릴 수 있어요.',
        board: { rows: put(U4_DOUBLE_A, 2, 2, '+') },
      },
      { type: 'move', check: 'double-atari', text: DA_TEXT, right: DA_RIGHT, wrong: DA_WRONG, hint: DA_HINT, board: { rows: U4_DOUBLE_A } },
      {
        type: 'sequence', check: 'capture', line: ['C3', 'B4', 'D2'],
        text: '끝까지 두어 볼까요? 동그라미 자리에 차례로 두어 보세요. 백이 한쪽을 살리면 다른 쪽을 따내요.',
        right: '따냈어요! 양단수를 치면 하나는 꼭 잡을 수 있어요.',
        board: { rows: put(U4_DOUBLE_A, 2, 2, '.') },
      },
      { type: 'move', check: 'double-atari', text: '조금 넓은 판이에요. ' + DA_TEXT, right: DA_RIGHT, wrong: DA_WRONG, hint: DA_HINT, board: { rows: U4_DOUBLE_B } },
      {
        type: 'move', check: 'double-atari',
        text: '이번에는 백돌 한쪽이 두 점이에요. ' + DA_TEXT,
        right: DA_RIGHT, wrong: DA_WRONG, hint: DA_HINT, board: { rows: U4_DOUBLE_C },
      },
      {
        type: 'choice',
        text: '양단수를 당한 쪽은 어떻게 될까요?',
        choices: ['한쪽만 살릴 수 있어요', '양쪽을 모두 살릴 수 있어요'], answer: 0,
        right: '맞아요. 한 번에 한 수만 둘 수 있으니까요.',
        wrong: '단수 된 곳은 두 군데인데 둘 수 있는 수는 몇 번인지 떠올려 보세요.',
      },
    ],
    summary: '한 수로 두 군데를 단수 치면 양단수예요. 하나는 꼭 잡을 수 있어요.',
  },

  {
    id: 'L17', unit: 4, no: 17, title: '축',
    goal: '계단 모양으로 몰아 잡고, 축머리를 확인한다',
    steps: [
      {
        type: 'explain',
        text: '단수를 치면 달아나고, 또 단수를 치면 또 달아나요. 이렇게 계단 모양으로 몰아서 판 끝에서 잡는 것을 축이라고 해요.',
        board: { rows: put(U4_LADDER, 3, 4, '+') },
      },
      { type: 'chase', text: LADDER_TEXT, right: LADDER_RIGHT, wrong: CHASE_WRONG, hint: LADDER_HINT, board: { rows: U4_LADDER } },
      {
        type: 'explain',
        text: '달아나는 길에 상대 돌이 있으면 축이 되지 않아요. 그 돌을 축머리라고 해요. 축으로 몰기 전에 길을 끝까지 살펴봐야 해요.',
        board: { rows: put(put(U4_LADDER, 3, 4, '.'), 5, 5, 'O'), labels: [{ at: 'F2', text: '축머리' }] },
      },
      {
        type: 'choice', check: 'chase', yes: 0,
        text: '달아나는 길에 백돌이 하나 있어요. 세모 표시한 백돌을 축으로 잡을 수 있을까요?',
        choices: YESNO_CATCH, answer: 1,
        right: '맞아요. 달아나던 백돌이 축머리와 이어져서 살아요.',
        wrong: '백돌이 계단 모양으로 달아나면 어디에 닿는지 따라가 보세요.',
        board: { rows: put(put(U4_LADDER, 3, 4, '.'), 5, 5, 'O') },
      },
      {
        type: 'choice', check: 'chase', yes: 0,
        text: '이번에는 백돌이 멀리 왼쪽 아래에 있어요. 세모 표시한 백돌을 축으로 잡을 수 있을까요?',
        choices: YESNO_CATCH, answer: 0,
        right: '맞아요. 달아나는 길에서 벗어난 돌은 축머리가 아니에요.',
        wrong: '백돌이 달아나는 길은 오른쪽 아래 방향이에요. 그 길 위에 백돌이 있는지 보세요.',
        board: { rows: put(put(U4_LADDER, 3, 4, '.'), 0, 6, 'O') },
      },
      { type: 'chase', text: '이번에는 반대쪽이에요. ' + '세모 표시한 백돌을 축으로 몰아 끝까지 잡아 보세요.', right: LADDER_RIGHT, wrong: CHASE_WRONG, hint: LADDER_HINT, board: { rows: flipH(U4_LADDER) } },
      {
        type: 'choice',
        text: '축으로 몰기 전에 꼭 확인할 것은 무엇일까요?',
        choices: ['달아나는 길에 상대 돌이 있는지', '내 돌이 모두 몇 개인지'], answer: 0,
        right: '맞아요. 축머리가 있으면 몰던 내 돌이 오히려 위험해져요.',
        wrong: '축이 되지 않게 만드는 돌의 이름을 떠올려 보세요.',
      },
    ],
    summary: '축은 계단 모양으로 몰아서 잡는 기술이에요. 몰기 전에 축머리가 있는지 살펴봐요.',
  },

  {
    id: 'L18', unit: 4, no: 18, title: '장문',
    goal: '달아날 길을 한 발 앞에서 막아 가둔다',
    steps: [
      {
        type: 'explain',
        text: '달아날 길을 한 발 앞에서 막아 가두는 수가 있어요. 이것을 장문이라고 해요. 그물을 씌우는 것과 같아요.',
        board: { rows: put(U4_NET, 4, 4, '+') },
      },
      { type: 'move', check: 'net', text: NET_TEXT, right: NET_RIGHT, wrong: NET_WRONG, hint: NET_HINT, board: { rows: U4_NET } },
      {
        type: 'chase',
        text: '백이 그물 밖으로 나가려고 해요. 흑 차례예요. 단수를 쳐서 끝까지 잡아 보세요.',
        right: '잡았어요! 그물에 걸린 돌은 나가려고 해도 잡혀요.',
        wrong: CHASE_WRONG, hint: '백돌이 나가려는 쪽을 막아 보세요.',
        board: { rows: U4_NET_NEXT },
      },
      { type: 'move', check: 'net', text: '이번에는 반대쪽이에요. 흑 차례예요. 장문으로 세모 표시한 백돌을 가둬 보세요.', right: NET_RIGHT, wrong: NET_WRONG, hint: NET_HINT, board: { rows: flipH(U4_NET) } },
      {
        type: 'choice',
        text: '장문은 어떤 수일까요?',
        choices: ['달아날 길을 한 발 앞에서 막는 수', '상대 돌에 바짝 붙여 단수 치는 수'], answer: 0,
        right: '맞아요. 붙이지 않고 한 발 떨어져서 가두는 수예요.',
        wrong: '방금 둔 정답 자리가 백돌에 붙어 있었는지 떠올려 보세요.',
      },
    ],
    summary: '장문은 달아날 길을 한 발 앞에서 막아 가두는 기술이에요. 축이 안 될 때 써요.',
  },

  {
    id: 'L19', unit: 4, no: 19, title: '환격',
    goal: '한 점을 내주고 더 크게 따낸다',
    steps: [
      {
        type: 'explain',
        text: '내 돌 한 점을 일부러 잡히게 하고, 곧바로 상대 돌을 더 크게 따내는 수가 있어요. 이것을 환격이라고 해요.',
        board: { rows: put(put(U4_SNAP_EDGE, 1, 0, '+'), 2, 0, '.') },
      },
      { type: 'chase', text: SNAP_TEXT, right: SNAP_RIGHT, wrong: CHASE_WRONG, hint: SNAP_HINT, board: { rows: U4_SNAP_EDGE } },
      { type: 'chase', text: '아래쪽 변에서도 해 볼까요? ' + '백돌 안쪽에 한 점을 넣고, 백이 따내면 되따내 보세요.', right: SNAP_RIGHT, wrong: CHASE_WRONG, hint: SNAP_HINT, board: { rows: flipV(U4_SNAP_EDGE) } },
      { type: 'chase', text: '이번에는 귀예요. ' + '백돌 안쪽에 한 점을 넣고, 백이 따내면 되따내 보세요.', right: SNAP_RIGHT, wrong: CHASE_WRONG, hint: SNAP_HINT, board: { rows: U4_SNAP_CORNER } },
      {
        type: 'choice',
        text: '환격에서 가장 먼저 하는 일은 무엇일까요?',
        choices: ['내 돌 한 점을 일부러 내줘요', '상대 돌을 곧바로 따내요'], answer: 0,
        right: '맞아요. 작게 내주고 크게 얻는 기술이에요.',
        wrong: '방금 문제에서 첫 수로 둔 흑돌이 어떻게 됐는지 떠올려 보세요.',
      },
    ],
    summary: '환격은 한 점을 내주고 더 크게 되따내는 기술이에요.',
  },

  {
    id: 'L20', unit: 4, no: 20, title: '촉촉수',
    goal: '이어도 계속 단수가 되는 모양을 안다',
    steps: [
      {
        type: 'explain',
        text: '단수가 된 돌을 이었는데도 여전히 단수인 모양이 있어요. 이것을 촉촉수라고 해요. 이으면 이을수록 더 많이 잡혀요.',
        board: { rows: fill(7, ['XOOOO+.', 'XXXXXX.']) },
      },
      {
        type: 'sequence', check: 'capture', line: ['A7', 'C7', 'F7'],
        text: '흑 차례예요. 동그라미 자리에 차례로 두어 보세요. 백이 이어도 계속 단수예요.',
        right: '따냈어요! 한 점을 살리려고 이었다가 네 점이 모두 잡혔어요.',
        board: { rows: fill(7, ['.o.OO..', 'XXXXXX.']) },
      },
      {
        type: 'chase',
        text: '이번에는 혼자 해 보세요. 흑 차례예요. 세모 표시한 백돌을 단수 쳐서 끝까지 잡아 보세요.',
        right: '잡았어요! 촉촉수에 걸린 돌은 살릴 수 없어요.',
        wrong: CHASE_WRONG, hint: '세모 표시한 백돌의 활로 두 곳 가운데 한 곳을 막아 보세요.',
        board: { rows: flipH(U4_CONNECT) },
      },
      {
        type: 'chase',
        text: '아래쪽 변이에요. 흑 차례예요. 세모 표시한 백돌을 단수 쳐서 끝까지 잡아 보세요.',
        right: '잡았어요! 이어도 소용없는 모양이었어요.',
        wrong: CHASE_WRONG, hint: '세모 표시한 백돌의 활로 두 곳 가운데 한 곳을 막아 보세요.',
        board: { rows: flipV(U4_CONNECT) },
      },
      {
        type: 'choice',
        text: '촉촉수에 걸린 돌을 이으면 어떻게 될까요?',
        choices: ['이어도 여전히 단수라서 더 많이 잡혀요', '이으면 활로가 늘어나서 살아요'], answer: 0,
        right: '맞아요. 그럴 때는 잇지 않고 버리는 편이 나아요.',
        wrong: '방금 백이 이었을 때 활로가 몇 개였는지 떠올려 보세요.',
      },
    ],
    summary: '촉촉수는 이어도 계속 단수인 모양이에요. 이을수록 더 많이 잡혀요.',
  },

  {
    id: 'L21', unit: 4, no: 21, title: '수상전',
    goal: '서로 잡으려는 싸움에서 활로 수를 비교한다',
    steps: [
      {
        type: 'explain',
        text: '흑돌과 백돌이 서로 끊고 둘러싸서, 먼저 따내는 쪽이 사는 싸움이 있어요. 이것을 수상전이라고 해요. 활로가 많은 쪽이 이겨요.',
        board: { rows: U4_RACE },
      },
      {
        type: 'count', check: 'liberties', choices: [2, 3, 4], answer: 2,
        text: '세모 표시한 흑돌 두 점의 활로는 몇 개일까요?',
        right: '맞아요. 흑돌의 활로는 2개예요.',
        board: { rows: fill(7, ['.......', '...OX..', '.OxxOOX', '...OX..']) },
      },
      {
        type: 'count', check: 'liberties', choices: [2, 3, 4], answer: 2,
        text: '세모 표시한 백돌 두 점의 활로는 몇 개일까요?',
        right: '맞아요. 백돌의 활로도 2개예요.',
        board: { rows: fill(7, ['.......', '...OX..', '.OXXooX', '...OX..']) },
      },
      {
        type: 'move', check: 'race',
        text: '활로가 2개로 같아요. 흑 차례예요. 백돌의 활로를 먼저 메워 보세요.',
        right: '맞아요. 활로 수가 같으면 먼저 두는 쪽이 이겨요.',
        wrong: '아쉬워요. 백돌의 활로를 줄여야 해요.',
        hint: '세모 표시한 백돌 옆의 빈 점을 찾아보세요.',
        board: { rows: fill(7, ['.......', '...OX*.', '.OxxooX', '...OX*.']) },
      },
      {
        type: 'sequence', check: 'capture', line: ['F6', 'C6', 'F4'],
        text: '끝까지 두어 볼까요? 동그라미 자리에 차례로 두어서 백돌을 먼저 따내 보세요.',
        right: '먼저 따냈어요! 한 수 차이로 이겼어요.',
        board: { rows: U4_RACE },
      },
      {
        type: 'choice',
        text: '흑돌의 활로는 3개, 백돌의 활로는 2개예요. 백이 먼저 두면 누가 이길까요?',
        choices: ['흑', '백'], answer: 0,
        right: '맞아요. 활로가 하나 더 많으면 나중에 두어도 이겨요.',
        wrong: '서로 한 수씩 활로를 메워 가며 세어 보세요.',
        board: { rows: fill(7, ['.......', '...OX..', '..xxooX', '...OX..']) },
      },
      {
        type: 'choice',
        text: '수상전에서 가장 먼저 할 일은 무엇일까요?',
        choices: ['내 돌과 상대 돌의 활로를 세어 봐요', '아무 데나 빨리 둬요'], answer: 0,
        right: '맞아요. 활로를 세어 보면 이길 수 있는 싸움인지 알 수 있어요.',
        wrong: '수상전에서 이기는 쪽이 어떻게 정해지는지 떠올려 보세요.',
      },
    ],
    summary: '수상전은 활로가 많은 쪽이 이겨요. 활로 수가 같으면 먼저 두는 쪽이 이겨요.',
  },
];

export const QUIZ4 = {
  id: 'Q4', unit: 4, quiz: true, title: '기술 섞어 풀기 10문제',
  goal: '4단원에서 배운 기술을 섞어서 푼다',
  steps: [
    { type: 'move', check: 'double-atari', text: DA_TEXT, right: DA_RIGHT, wrong: DA_WRONG, hint: DA_HINT, board: { rows: flipH(U4_DOUBLE_A) } },
    { type: 'chase', text: '세모 표시한 백돌을 축으로 몰아 끝까지 잡아 보세요.', right: LADDER_RIGHT, wrong: CHASE_WRONG, hint: LADDER_HINT, board: { rows: flipV(U4_LADDER) } },
    { type: 'move', check: 'net', text: '축머리가 있어요. 흑 차례예요. 장문으로 세모 표시한 백돌을 가둬 보세요.', right: NET_RIGHT, wrong: NET_WRONG, hint: NET_HINT, board: { rows: flipV(U4_NET) } },
    { type: 'chase', text: SNAP_TEXT, right: SNAP_RIGHT, wrong: CHASE_WRONG, hint: SNAP_HINT, board: { rows: flipH(U4_SNAP_CORNER) } },
    {
      type: 'move', check: 'race', text: '수상전이에요. 흑 차례예요. 백돌의 활로를 먼저 메워 보세요.', right: '맞아요. 활로 수가 같으면 먼저 두는 쪽이 이겨요.',
      wrong: '아쉬워요. 백돌의 활로를 줄여야 해요.', hint: '세모 표시한 백돌 옆의 빈 점을 찾아보세요.',
      board: { rows: flipH(fill(7, ['.......', '...OX*.', '.OxxooX', '...OX*.'])) },
    },
    { type: 'move', check: 'double-atari', text: DA_TEXT, right: DA_RIGHT, wrong: DA_WRONG, hint: DA_HINT, board: { rows: flipV(U4_DOUBLE_B) } },
    {
      type: 'choice', check: 'chase', yes: 0, text: '달아나는 길에 백돌이 있어요. 세모 표시한 백돌을 축으로 잡을 수 있을까요?', choices: YESNO_CATCH, answer: 1,
      right: '맞아요. 축머리가 있어서 축이 되지 않아요.', wrong: '백돌이 계단 모양으로 달아나면 어디에 닿는지 따라가 보세요.',
      board: { rows: flipH(put(put(U4_LADDER, 3, 4, '.'), 5, 5, 'O')) },
    },
    {
      type: 'chase', text: '흑 차례예요. 세모 표시한 백돌을 단수 쳐서 끝까지 잡아 보세요.', right: '잡았어요! 이어도 소용없는 촉촉수였어요.',
      wrong: CHASE_WRONG, hint: '세모 표시한 백돌의 활로 두 곳 가운데 한 곳을 막아 보세요.', board: { rows: flipV(flipH(U4_CONNECT)) },
    },
    { type: 'move', check: 'net', text: '축머리가 있어요. 흑 차례예요. 장문으로 세모 표시한 백돌을 가둬 보세요.', right: NET_RIGHT, wrong: NET_WRONG, hint: NET_HINT, board: { rows: flipV(flipH(U4_NET)) } },
    { type: 'chase', text: '세모 표시한 백돌을 축으로 몰아 끝까지 잡아 보세요.', right: LADDER_RIGHT, wrong: CHASE_WRONG, hint: LADDER_HINT, board: { rows: flipV(flipH(U4_LADDER)) } },
  ],
  summary: '양단수, 축, 장문, 환격, 촉촉수, 수상전을 모두 써 봤어요.',
};
