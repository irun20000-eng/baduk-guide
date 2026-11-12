// 3단원. 삶과 죽음 (12~15차시) + 미션 "사활 10문제"
// 살리는 문제는 흑돌이 둘러싸인 모양, 잡는 문제는 색을 바꿔 백돌이 둘러싸인 모양으로 쓴다(배우는 사람은 늘 흑).
import { fill, flipH, flipV, swapColors } from './tools.mjs';

// 둘러싸인 흑돌 모양 (위쪽 왼쪽 귀). 표시(x)는 문제의 대상 덩어리.
const U3_ONE_EYE = fill(7, ['.xO....', 'XXO....', 'OO.....']); // 한 점짜리 집 하나: 단수
const U3_TWO_EYES = fill(7, ['.x.XO..', 'XXXXO..', 'OOOO...']); // 떨어진 집 둘: 삶
const U3_WIDE_ONE = fill(7, ['..xO...', 'XXXO...', 'OOO....']); // 두 점짜리 집 하나: 죽음
const U3_STRAIGHT3 = fill(7, ['...xO..', 'XXXXO..', 'OOOO...']); // 곧은 세 집: 급소는 가운데
const U3_BENT3 = fill(7, ['..xO...', '.XXO...', 'XXO....', 'OO.....']); // 굽은 세 집: 급소는 꺾인 곳
const U3_T4 = fill(7, ['x...XO.', 'XX.XXO.', 'OXXXO..', '.OOO...']); // 네 집(T 모양): 급소는 가운데

const mark = (rows, x, y, ch) => rows.map((r, i) => (i === y ? r.slice(0, x) + ch + r.slice(x + 1) : r));

// 빅 모양: 가운데 두 빈 점을 흑과 백이 함께 쓴다.
const U3_SEKI = fill(7, ['.OX.OX.', '.OX.OX.', '.OXXOX.', '.OOOXX.']);

const LIVE_TEXT = '흑 차례예요. 급소에 두어 세모 표시한 흑돌을 살려 보세요.';
const KILL_TEXT = '흑 차례예요. 급소에 두어 세모 표시한 백돌을 잡아 보세요.';
const LIVE_RIGHT = '살았어요! 집이 따로 떨어진 두 개가 됐어요.';
const KILL_RIGHT = '급소를 차지했어요. 백은 이제 집을 두 개로 나눌 수 없어요.';
const LD_WRONG = '아쉬워요. 그 자리에 두면 상대가 급소를 차지해요.';
const LD_HINT = '빈 점들의 한가운데를 보세요.';

export const UNIT3 = [
  {
    id: 'L12', unit: 3, no: 12, title: '두 집이면 산다',
    goal: '따로 떨어진 두 집이 있으면 잡히지 않는 까닭을 안다',
    steps: [
      {
        type: 'explain',
        text: '돌이 둘러싸여도 안쪽에 빈 점이 있으면 그곳이 집이에요. 그런데 집이 하나뿐이면 상대가 그 자리에 두어서 따낼 수 있어요.',
        board: { rows: mark(swapColors(U3_ONE_EYE), 0, 0, '+') },
      },
      {
        type: 'move', check: 'capture',
        text: '흑 차례예요. 집이 하나뿐인 백돌을 따내 보세요.',
        right: '따냈어요! 집이 하나뿐인 돌은 이렇게 잡혀요.',
        wrong: '아쉬워요. 백돌의 마지막 활로는 안쪽에 있어요.',
        hint: '백돌 안쪽의 빈 점을 보세요.',
        board: { rows: mark(swapColors(U3_ONE_EYE), 0, 0, '*') },
      },
      {
        type: 'explain',
        text: '집이 따로 떨어져 두 개 있으면 달라요. 흑은 어느 쪽에도 둘 수 없어요. 둘 다 착수금지니까요.',
        board: { rows: mark(mark(swapColors(U3_TWO_EYES), 0, 0, '!'), 2, 0, '!') },
      },
      {
        type: 'forbidden', reason: 'suicide',
        text: '흑 차례예요. 동그라미 자리에 두어서 백돌을 잡아 보세요.',
        right: '둘 수 없어요! 한쪽 집을 메워도 다른 쪽 집이 남아 있어서 따낼 수 없기 때문이에요.',
        board: { rows: mark(swapColors(U3_TWO_EYES), 0, 0, '*') },
      },
      {
        type: 'choice', check: 'alive', yes: 0,
        text: '세모 표시한 흑돌 덩어리는 살았을까요, 죽었을까요?',
        choices: ['살았어요', '죽었어요'], answer: 0,
        right: '맞아요. 떨어진 집이 두 개라서 백이 잡을 수 없어요.',
        wrong: '안쪽 빈 점이 몇 군데로 나뉘어 있는지 세어 보세요.',
        board: { rows: U3_TWO_EYES },
      },
      {
        type: 'choice', check: 'alive', yes: 0,
        text: '이번에는 어떨까요? 세모 표시한 흑돌 덩어리는 살았을까요, 죽었을까요?',
        choices: ['살았어요', '죽었어요'], answer: 1,
        right: '맞아요. 빈 점이 두 개여도 붙어 있으면 집 하나예요.',
        wrong: '빈 점 두 개가 떨어져 있는지 붙어 있는지 살펴보세요.',
        board: { rows: U3_WIDE_ONE },
      },
      {
        type: 'choice',
        text: '둘러싸인 돌이 살려면 무엇이 필요할까요?',
        choices: ['따로 떨어진 집 두 개', '아주 넓은 집 한 개'], answer: 0,
        right: '맞아요. 그래서 "두 집이면 산다"고 해요.',
        wrong: '상대가 둘 수 없는 자리가 몇 군데 있어야 하는지 떠올려 보세요.',
      },
    ],
    summary: '따로 떨어진 집이 두 개 있으면 잡히지 않아요. 집이 하나뿐이면 잡혀요.',
  },

  {
    id: 'L13', unit: 3, no: 13, title: '옥집',
    goal: '진짜 집과 가짜 집(옥집)을 구별한다',
    steps: [
      {
        type: 'explain',
        text: '둘레가 빈틈없이 내 돌이면 진짜 집이에요. 이런 집에는 백이 들어올 수 없어요.',
        board: { rows: ['.....', '.XXX.', '.X+X.', '.XXX.', '.....'] },
      },
      {
        type: 'explain',
        text: '그런데 대각선 자리를 백이 차지하면 집처럼 보여도 가짜예요. 이런 곳을 옥집이라고 해요. 흑돌이 끊어져 있어서 나중에 스스로 메워야 해요.',
        board: { rows: ['.....', '.OXX.', '.X!X.', '.XXO.', '.....'] },
      },
      {
        type: 'choice', check: 'eye', yes: 0,
        text: '동그라미 자리는 진짜 집일까요, 옥집일까요?',
        choices: ['진짜 집', '옥집'], answer: 0,
        right: '맞아요. 가운데에서는 대각선 한 곳쯤 빼앗겨도 진짜 집이에요.',
        wrong: '대각선 네 곳 가운데 백돌이 몇 개인지 세어 보세요.',
        board: { rows: ['.....', '.OXX.', '.X*X.', '.XXX.', '.....'] },
      },
      {
        type: 'choice', check: 'eye', yes: 0,
        text: '이번에는 어떨까요? 동그라미 자리는 진짜 집일까요, 옥집일까요?',
        choices: ['진짜 집', '옥집'], answer: 1,
        right: '맞아요. 가운데에서 대각선 두 곳을 빼앗기면 옥집이에요.',
        wrong: '대각선 네 곳 가운데 백돌이 몇 개인지 세어 보세요.',
        board: { rows: ['.....', '.OXX.', '.X*X.', '.XXO.', '.....'] },
      },
      {
        type: 'choice', check: 'eye', yes: 0,
        text: '변에 있는 집이에요. 동그라미 자리는 진짜 집일까요, 옥집일까요?',
        choices: ['진짜 집', '옥집'], answer: 1,
        right: '맞아요. 변과 귀에서는 대각선 한 곳만 빼앗겨도 옥집이에요.',
        wrong: '변에서는 대각선 자리가 두 곳뿐이에요. 그중 백돌이 있는지 보세요.',
        board: { rows: ['.X*X.', '.OXX.', '.....', '.....', '.....'] },
      },
      {
        type: 'point', rule: 'false-eye', need: 'all',
        text: '흑돌에 둘러싸인 빈 점이 두 군데 있어요. 그 가운데 옥집을 찾아 눌러 보세요.',
        right: '잘 찾았어요! 대각선 두 곳에 백돌이 있어서 옥집이에요.',
        wrong: '거기는 옥집이 아니에요. 대각선에 백돌이 있는 쪽을 찾아보세요.',
        hint: '빈 점의 대각선 자리에 백돌이 놓인 쪽을 보세요.',
        board: { rows: ['.......', '.XXX...', '.X.X...', '.XXX...', '...XXO.', '...X.X.', '...OXX.'] },
      },
      {
        type: 'point', rule: 'real-eye', need: 'all',
        text: '같은 판이에요. 이번에는 진짜 집을 찾아 눌러 보세요.',
        right: '잘 찾았어요! 둘레와 대각선이 모두 흑돌이에요.',
        wrong: '거기는 진짜 집이 아니에요. 대각선까지 모두 흑돌인 쪽을 찾아보세요.',
        hint: '대각선 네 곳이 모두 흑돌인 빈 점을 찾아보세요.',
        board: { rows: ['.......', '.XXX...', '.X.X...', '.XXX...', '...XXO.', '...X.X.', '...OXX.'] },
      },
    ],
    summary: '대각선 자리를 상대에게 빼앗긴 집은 옥집이에요. 옥집은 진짜 집이 아니에요.',
  },

  {
    id: 'L14', unit: 3, no: 14, title: '급소',
    goal: '한 수로 살리거나 잡는 자리를 찾는다',
    steps: [
      {
        type: 'explain',
        text: '집 모양에는 한 수로 살고 죽는 것이 갈리는 자리가 있어요. 이런 자리를 급소라고 해요.',
        board: { rows: mark(U3_STRAIGHT3, 1, 0, '+') },
      },
      {
        type: 'move', check: 'live',
        text: '흑 차례예요. 급소에 두어 집을 두 개로 나눠 보세요.',
        right: LIVE_RIGHT, wrong: LD_WRONG, hint: LD_HINT,
        board: { rows: mark(U3_STRAIGHT3, 1, 0, '*') },
      },
      {
        type: 'move', check: 'kill',
        text: '이번에는 백돌이 같은 모양이에요. 흑 차례예요. 같은 급소에 두어 백돌을 잡아 보세요.',
        right: '급소를 차지했어요. 내가 두고 싶은 자리는 상대도 두고 싶은 자리예요.',
        wrong: LD_WRONG, hint: LD_HINT,
        board: { rows: mark(swapColors(U3_STRAIGHT3), 1, 0, '*') },
      },
      {
        type: 'move', check: 'live',
        text: '귀에서 꺾인 모양이에요. ' + LIVE_TEXT,
        right: LIVE_RIGHT, wrong: LD_WRONG, hint: '빈 점 세 개 가운데 나머지 두 점에 모두 닿는 자리를 찾아보세요.',
        board: { rows: mark(U3_BENT3, 0, 0, '*') },
      },
      {
        type: 'move', check: 'kill',
        text: '같은 모양의 백돌이에요. ' + KILL_TEXT,
        right: KILL_RIGHT, wrong: LD_WRONG, hint: '빈 점 세 개 가운데 나머지 두 점에 모두 닿는 자리를 찾아보세요.',
        board: { rows: mark(swapColors(U3_BENT3), 0, 0, '*') },
      },
      {
        type: 'move', check: 'live',
        text: '빈 점이 네 개인 모양이에요. ' + LIVE_TEXT,
        right: '살았어요! 급소 한 수로 집이 세 개나 생겼어요.',
        wrong: LD_WRONG, hint: '빈 점 네 개 가운데 나머지 세 점에 모두 닿는 자리를 찾아보세요.',
        board: { rows: mark(U3_T4, 2, 0, '*') },
      },
      {
        type: 'move', check: 'kill',
        text: '같은 모양의 백돌이에요. ' + KILL_TEXT,
        right: KILL_RIGHT, wrong: LD_WRONG, hint: '빈 점 네 개 가운데 나머지 세 점에 모두 닿는 자리를 찾아보세요.',
        board: { rows: mark(swapColors(U3_T4), 2, 0, '*') },
      },
      {
        type: 'choice',
        text: '급소는 보통 어디에 있을까요?',
        choices: ['집 모양의 한가운데', '집 모양의 맨 끝'], answer: 0,
        right: '맞아요. 한가운데에 두어야 집이 둘로 나뉘어요.',
        wrong: '지금까지 푼 문제에서 정답 자리가 어디였는지 떠올려 보세요.',
      },
    ],
    summary: '집 모양의 한가운데가 급소예요. 내가 두면 살고, 상대가 두면 죽어요.',
  },

  {
    id: 'L15', unit: 3, no: 15, title: '빅',
    goal: '서로 잡을 수 없는 모양이 있다는 것을 안다',
    steps: [
      {
        type: 'explain',
        text: '흑돌과 백돌이 서로 물려 있는데, 먼저 두는 쪽이 오히려 잡히는 모양이 있어요. 이런 모양을 빅이라고 해요.',
        board: { rows: mark(mark(U3_SEKI, 3, 0, '+'), 3, 1, '+') },
      },
      {
        type: 'move', check: 'capture',
        text: '백이 먼저 가운데에 두었어요. 흑 차례예요. 백돌을 따내 보세요.',
        right: '따냈어요! 먼저 둔 백이 스스로 단수가 되어 잡혔어요.',
        wrong: '아쉬워요. 백돌의 마지막 활로를 찾아보세요.',
        hint: '가운데에 남은 빈 점을 보세요.',
        board: { rows: mark(mark(U3_SEKI, 3, 0, 'O'), 3, 1, '*') },
      },
      {
        type: 'move', check: 'capture',
        text: '이번에는 흑이 먼저 가운데에 두었어요. 백 차례예요. 백이 되어서 흑돌을 따내 보세요.',
        right: '따냈어요! 흑이 먼저 두어도 똑같이 잡혀요.',
        wrong: '아쉬워요. 흑돌의 마지막 활로를 찾아보세요.',
        hint: '가운데에 남은 빈 점을 보세요.',
        board: { rows: mark(mark(U3_SEKI, 3, 0, 'X'), 3, 1, '*'), turn: 'W' },
      },
      {
        type: 'choice', check: 'alive', yes: 0,
        text: '그래서 둘 다 두지 않고 그대로 둬요. 세모 표시한 흑돌은 살았을까요, 죽었을까요?',
        choices: ['살았어요', '죽었어요'], answer: 0,
        right: '맞아요. 백이 먼저 두면 백이 잡히니까, 흑돌은 잡히지 않아요.',
        wrong: '백이 가운데에 먼저 두면 어떻게 됐는지 떠올려 보세요.',
        board: { rows: mark(U3_SEKI, 2, 0, 'x') },
      },
      {
        type: 'choice', check: 'owner',
        text: '빅이 된 곳의 빈 점(초록 점)은 누구의 집일까요?',
        choices: ['흑 집', '백 집', '누구의 집도 아니에요'], answer: 2,
        right: '맞아요. 빅의 빈 점은 집으로 세지 않아요.',
        wrong: '그 빈 점이 흑돌과 백돌에 모두 닿아 있는지 살펴보세요.',
        board: { rows: mark(U3_SEKI, 3, 0, '+') },
      },
      {
        type: 'choice',
        text: '빅이 됐을 때는 어떻게 하는 것이 좋을까요?',
        choices: ['먼저 두지 않고 그대로 둬요', '얼른 먼저 둬요'], answer: 0,
        right: '맞아요. 빅에서는 기다리는 쪽이 이득이에요.',
        wrong: '먼저 둔 쪽이 어떻게 됐는지 떠올려 보세요.',
      },
    ],
    summary: '빅은 먼저 두는 쪽이 잡히는 모양이에요. 둘 다 살아 있고, 사이의 빈 점은 집으로 세지 않아요.',
  },
];

export const QUIZ3 = {
  id: 'Q3', unit: 3, quiz: true, title: '사활 10문제',
  goal: '3단원에서 배운 것을 섞어서 푼다',
  steps: [
    { type: 'move', check: 'live', text: LIVE_TEXT, right: LIVE_RIGHT, wrong: LD_WRONG, hint: LD_HINT, board: { rows: flipH(mark(U3_STRAIGHT3, 1, 0, '*')) } },
    { type: 'move', check: 'kill', text: KILL_TEXT, right: KILL_RIGHT, wrong: LD_WRONG, hint: LD_HINT, board: { rows: flipV(mark(swapColors(U3_BENT3), 0, 0, '*')) } },
    { type: 'move', check: 'live', text: LIVE_TEXT, right: LIVE_RIGHT, wrong: LD_WRONG, hint: LD_HINT, board: { rows: flipV(mark(U3_T4, 2, 0, '*')) } },
    { type: 'move', check: 'kill', text: KILL_TEXT, right: KILL_RIGHT, wrong: LD_WRONG, hint: LD_HINT, board: { rows: flipV(flipH(mark(swapColors(U3_STRAIGHT3), 1, 0, '*'))) } },
    {
      type: 'choice', check: 'alive', yes: 0, text: '세모 표시한 흑돌 덩어리는 살았을까요, 죽었을까요?', choices: ['살았어요', '죽었어요'], answer: 0,
      right: '맞아요. 떨어진 집이 두 개예요.', wrong: '안쪽 빈 점이 몇 군데로 나뉘어 있는지 세어 보세요.', board: { rows: flipV(flipH(U3_TWO_EYES)) },
    },
    {
      type: 'move', check: 'capture', text: '흑 차례예요. 집이 하나뿐인 백돌을 따내 보세요.', right: '따냈어요! 집이 하나뿐인 돌은 잡혀요.',
      wrong: '아쉬워요. 백돌의 마지막 활로는 안쪽에 있어요.', hint: '백돌 안쪽의 빈 점을 보세요.', board: { rows: flipH(mark(swapColors(U3_ONE_EYE), 0, 0, '*')) },
    },
    { type: 'move', check: 'kill', text: KILL_TEXT, right: KILL_RIGHT, wrong: LD_WRONG, hint: LD_HINT, board: { rows: flipH(mark(swapColors(U3_T4), 2, 0, '*')) } },
    { type: 'move', check: 'live', text: LIVE_TEXT, right: LIVE_RIGHT, wrong: LD_WRONG, hint: LD_HINT, board: { rows: flipH(mark(U3_BENT3, 0, 0, '*')) } },
    {
      type: 'choice', check: 'alive', yes: 0, text: '세모 표시한 흑돌 덩어리는 살았을까요, 죽었을까요?', choices: ['살았어요', '죽었어요'], answer: 1,
      right: '맞아요. 붙어 있는 빈 점은 집 하나예요.', wrong: '빈 점 두 개가 떨어져 있는지 붙어 있는지 살펴보세요.', board: { rows: flipV(U3_WIDE_ONE) },
    },
    {
      type: 'point', rule: 'false-eye', need: 'all', text: '흑돌에 둘러싸인 빈 점 가운데 옥집을 찾아 눌러 보세요.', right: '잘 찾았어요! 대각선 두 곳에 백돌이 있어요.',
      wrong: '거기는 옥집이 아니에요. 대각선에 백돌이 있는 쪽을 찾아보세요.', hint: '빈 점의 대각선 자리에 백돌이 놓인 쪽을 보세요.',
      board: { rows: flipH(['.......', '.XXX...', '.X.X...', '.XXX...', '...XXO.', '...X.X.', '...OXX.']) },
    },
  ],
  summary: '두 집이면 살고, 급소는 한가운데에 있어요.',
};
